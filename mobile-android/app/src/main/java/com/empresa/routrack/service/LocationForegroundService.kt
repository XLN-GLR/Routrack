package com.empresa.routrack.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.empresa.routrack.data.crypto.AuditChainManager
import com.empresa.routrack.data.crypto.KeyStoreManager
import com.empresa.routrack.data.local.RoutrackDatabase
import com.empresa.routrack.data.local.entity.BitacoraAuditoriaEntity
import com.empresa.routrack.data.local.entity.UbicacionGpsEntity
import com.empresa.routrack.ui.MainActivity
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationAvailability
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * Servicio en Primer Plano persistente para la captura de geolocalización continua.
 *
 * Cumplimiento Normativo (LOPDP Ecuador y Políticas de Android):
 * - Mantiene una notificación fija y transparente en la barra de estado indicando el monitoreo activo.
 * - Solo recolecta coordenadas mientras el turno está formalmente en curso.
 * - Registra cada coordenada en Room y asegura la integridad con la cadena HMAC-SHA256.
 */
class LocationForegroundService : Service() {

    companion object {
        const val ACTION_START_TRACKING = "com.empresa.routrack.action.START_TRACKING"
        const val ACTION_STOP_TRACKING = "com.empresa.routrack.action.STOP_TRACKING"

        const val EXTRA_JORNADA_ID = "extra_jornada_id"
        const val EXTRA_VENDEDOR_ID = "extra_vendedor_id"

        private const val NOTIFICATION_ID = 4001
        private const val CHANNEL_ID = "routrack_tracking_channel"
        private const val CHANNEL_NAME = "ROUTRACK Monitoreo de Jornada"

        private val _isTracking = MutableStateFlow(false)
        val isTracking = _isTracking.asStateFlow()

        private val _lastLocation = MutableStateFlow<Location?>(null)
        val lastLocation = _lastLocation.asStateFlow()

        private val _activeJornadaId = MutableStateFlow<String?>(null)
        val activeJornadaId = _activeJornadaId.asStateFlow()

        fun startTracking(context: Context, jornadaId: String, vendedorId: String) {
            val intent = Intent(context, LocationForegroundService::class.java).apply {
                action = ACTION_START_TRACKING
                putExtra(EXTRA_JORNADA_ID, jornadaId)
                putExtra(EXTRA_VENDEDOR_ID, vendedorId)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopTracking(context: Context) {
            val intent = Intent(context, LocationForegroundService::class.java).apply {
                action = ACTION_STOP_TRACKING
            }
            context.startService(intent)
        }
    }

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var database: RoutrackDatabase
    private lateinit var keyStoreManager: KeyStoreManager
    private var currentJornadaId: String = ""
    private var currentVendedorId: String = ""

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            for (location in result.locations) {
                processLocationUpdate(location)
            }
        }

        override fun onLocationAvailability(availability: LocationAvailability) {
            if (!availability.isLocationAvailable && currentJornadaId.isNotEmpty()) {
                recordAuditEvent(
                    tipoEvento = BitacoraAuditoriaEntity.EVENTO_GPS_DISABLED,
                    metadataJson = "{\"gps_available\":false,\"timestamp\":${System.currentTimeMillis()}}"
                )
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        keyStoreManager = KeyStoreManager.getInstance(applicationContext)
        val passphrase = try {
            keyStoreManager.getDatabasePassphrase()
        } catch (_: Exception) {
            null
        }
        database = RoutrackDatabase.getInstance(applicationContext, passphrase)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: return START_NOT_STICKY

        when (action) {
            ACTION_START_TRACKING -> {
                val jornadaId = intent.getStringExtra(EXTRA_JORNADA_ID).orEmpty()
                val vendedorId = intent.getStringExtra(EXTRA_VENDEDOR_ID).orEmpty()

                if (jornadaId.isNotEmpty()) {
                    currentJornadaId = jornadaId
                    currentVendedorId = vendedorId
                    _activeJornadaId.value = jornadaId
                    startForegroundTracking()
                }
            }
            ACTION_STOP_TRACKING -> {
                stopForegroundTracking()
            }
        }

        return START_STICKY
    }

    private fun startForegroundTracking() {
        val notification = buildPersistentNotification()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        _isTracking.value = true

        // Registrar evento SERVICE_STARTED en la bitácora
        recordAuditEvent(
            tipoEvento = BitacoraAuditoriaEntity.EVENTO_SERVICE_STARTED,
            metadataJson = "{\"action\":\"START\",\"vendedorId\":\"$currentVendedorId\"}"
        )

        // Configurar solicitud de ubicación con balanceo de consumo de batería
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 15_000L)
            .setMinUpdateIntervalMillis(5_000L)
            .setMinUpdateDistanceMeters(5.0f)
            .setWaitForAccurateLocation(false)
            .build()

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
        } catch (e: SecurityException) {
            // Manejado si se revoca el permiso durante la ejecución
        }
    }

    private fun stopForegroundTracking() {
        try {
            fusedLocationClient.removeLocationUpdates(locationCallback)
        } catch (_: Exception) {
        }

        if (currentJornadaId.isNotEmpty()) {
            recordAuditEvent(
                tipoEvento = BitacoraAuditoriaEntity.EVENTO_SERVICE_STOPPED,
                metadataJson = "{\"action\":\"STOP\",\"vendedorId\":\"$currentVendedorId\"}"
            )
        }

        _isTracking.value = false
        _activeJornadaId.value = null

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun processLocationUpdate(location: Location) {
        if (currentJornadaId.isEmpty()) return

        _lastLocation.value = location

        serviceScope.launch {
            val locationId = UUID.randomUUID().toString()
            val isMock = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                location.isMock
            } else {
                @Suppress("DEPRECATION")
                location.isFromMockProvider
            }

            val entity = UbicacionGpsEntity(
                id = locationId,
                jornadaId = currentJornadaId,
                latitud = location.latitude,
                longitud = location.longitude,
                altitud = if (location.hasAltitude()) location.altitude else null,
                precision = location.accuracy,
                velocidad = if (location.hasSpeed()) location.speed else null,
                timestampCaptura = location.time,
                sincronizado = false
            )

            // 1. Guardar coordenada en Room
            database.ubicacionGpsDao().insert(entity)

            // 2. Encadenar evento en bitácora de auditoría
            val metadata = buildString {
                append("{\"lat\":").append(location.latitude)
                append(",\"lng\":").append(location.longitude)
                append(",\"accuracy\":").append(location.accuracy)
                append(",\"isMock\":").append(isMock)
                append("}")
            }

            recordAuditEvent(
                tipoEvento = BitacoraAuditoriaEntity.EVENTO_CAPTURA_GPS,
                metadataJson = metadata,
                customTimestamp = location.time
            )
        }
    }

    private fun recordAuditEvent(
        tipoEvento: String,
        metadataJson: String,
        customTimestamp: Long = System.currentTimeMillis()
    ) {
        if (currentJornadaId.isEmpty()) return

        serviceScope.launch {
            val secretKey = getAuditSecretKey()
            val ultimoEvento = database.bitacoraAuditoriaDao().getUltimoEventoPorJornada(currentJornadaId)

            val hashPrevio = ultimoEvento?.hashActual
                ?: AuditChainManager.calculateInitialHash(currentJornadaId, secretKey)

            val hashActual = AuditChainManager.calculateHash(
                tipoEvento = tipoEvento,
                timestampEvento = customTimestamp,
                metadataJson = metadataJson,
                hashPrevio = hashPrevio,
                secretKey = secretKey
            )

            val auditEntity = BitacoraAuditoriaEntity(
                id = UUID.randomUUID().toString(),
                jornadaId = currentJornadaId,
                tipoEvento = tipoEvento,
                metadataJson = metadataJson,
                timestampEvento = customTimestamp,
                hashPrevio = hashPrevio,
                hashActual = hashActual,
                sincronizado = false
            )

            database.bitacoraAuditoriaDao().insert(auditEntity)
        }
    }

    private fun getAuditSecretKey(): ByteArray {
        return try {
            keyStoreManager.getDatabasePassphrase()
        } catch (_: Exception) {
            "ROUTRACK_LOCAL_DEFAULT_SECRET_KEY".toByteArray()
        }
    }

    private fun buildPersistentNotification(): Notification {
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("ROUTRACK")
            .setContentText("ROUTRACK: Seguimiento de jornada activo")
            .setSubText("Monitoreo en curso")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notificación persistente de seguimiento de ubicación para cumplimiento LOPDP"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        stopForegroundTracking()
        serviceScope.cancel()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
