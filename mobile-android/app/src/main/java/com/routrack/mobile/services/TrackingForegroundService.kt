package com.routrack.mobile.services

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
import com.empresa.routrack.data.local.entity.BitacoraAuditoriaEntity
import com.empresa.routrack.data.repository.RepositoryProvider
import com.empresa.routrack.data.repository.TrackingRepository
import com.empresa.routrack.ui.MainActivity
import com.routrack.mobile.security.AntiTamperingManager
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityRecognitionClient
import com.google.android.gms.location.DetectedActivity
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

/**
 * Servicio en Primer Plano persistente para la captura adaptativa de geolocalización.
 *
 * Características Clave:
 * 1. Cumplimiento Normativo (LOPDP Ecuador): Notificación permanente obligatoria transparente en barra de estado.
 * 2. Optimización de Batería (RNF-01): Integración con ActivityRecognitionClient para variar dinámicamente
 *    la tasa de muestreo según el movimiento del vendedor (Quieto, Caminando, En Vehículo).
 * 3. Persistencia Cifrada con Firma HMAC: Persiste en Room mediante TrackingRepository con encadenamiento criptográfico.
 * 4. Cese Inmediato: Al detenerse el servicio se desvinculan los sensores y cesa de inmediato la recolección.
 */
open class TrackingForegroundService : Service() {

    companion object {
        const val ACTION_START_TRACKING = "com.routrack.mobile.action.START_TRACKING"
        const val ACTION_STOP_TRACKING = "com.routrack.mobile.action.STOP_TRACKING"
        const val ACTION_CHANGE_INTERVAL = "com.routrack.mobile.action.CHANGE_INTERVAL"

        const val EXTRA_JORNADA_ID = "extra_jornada_id"
        const val EXTRA_VENDEDOR_ID = "extra_vendedor_id"
        const val EXTRA_ACTIVITY_TYPE = "extra_activity_type"

        private const val NOTIFICATION_ID = 5001
        private const val CHANNEL_ID = "routrack_adaptive_tracking_channel"
        private const val CHANNEL_NAME = "ROUTRACK Rastreo de Jornada"

        private val _isTracking = MutableStateFlow(false)
        val isTracking = _isTracking.asStateFlow()

        private val _lastLocation = MutableStateFlow<Location?>(null)
        val lastLocation = _lastLocation.asStateFlow()

        private val _currentDetectedActivity = MutableStateFlow(DetectedActivity.UNKNOWN)
        val currentDetectedActivity = _currentDetectedActivity.asStateFlow()

        private val _activeJornadaId = MutableStateFlow<String?>(null)
        val activeJornadaId = _activeJornadaId.asStateFlow()

        /**
         * Inicia el rastreo en primer plano para una jornada laboral específica.
         */
        fun startTracking(context: Context, jornadaId: String, vendedorId: String) {
            val intent = Intent(context, TrackingForegroundService::class.java).apply {
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

        /**
         * Detiene inmediatamente el rastreo y cesa la recolección de coordenadas GPS.
         */
        fun stopTracking(context: Context) {
            val intent = Intent(context, TrackingForegroundService::class.java).apply {
                action = ACTION_STOP_TRACKING
            }
            context.startService(intent)
        }

        /**
         * Notifica un cambio en la actividad física del usuario detectada por ActivityRecognition.
         */
        fun onActivityTransitionChanged(context: Context, activityType: Int) {
            val intent = Intent(context, TrackingForegroundService::class.java).apply {
                action = ACTION_CHANGE_INTERVAL
                putExtra(EXTRA_ACTIVITY_TYPE, activityType)
            }
            context.startService(intent)
        }
    }

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var activityRecognitionClient: ActivityRecognitionClient
    private lateinit var trackingRepository: TrackingRepository
    private var currentJornadaId: String = ""
    private var currentVendedorId: String = ""
    private var activityPendingIntent: PendingIntent? = null
    private var currentActivityType: Int = DetectedActivity.UNKNOWN

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
        trackingRepository = RepositoryProvider.getTrackingRepository(applicationContext)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        activityRecognitionClient = ActivityRecognition.getClient(this)
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
            ACTION_CHANGE_INTERVAL -> {
                val newActivity = intent.getIntExtra(EXTRA_ACTIVITY_TYPE, DetectedActivity.UNKNOWN)
                if (_isTracking.value && newActivity != currentActivityType) {
                    currentActivityType = newActivity
                    _currentDetectedActivity.value = newActivity
                    reconfigureLocationUpdates(newActivity)
                }
            }
        }

        return START_STICKY
    }

    /**
     * Inicia el servicio en primer plano y publica la notificación obligatoria persistente (LOPDP).
     */
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

        // Registrar evento SERVICE_STARTED en la bitácora criptográfica
        recordAuditEvent(
            tipoEvento = BitacoraAuditoriaEntity.EVENTO_SERVICE_STARTED,
            metadataJson = "{\"action\":\"START\",\"vendedorId\":\"$currentVendedorId\"}"
        )

        // 1. Suscribirse a transiciones de actividad para adaptación de batería
        subscribeToActivityTransitions()

        // 2. Iniciar captura de ubicación con el perfil inicial
        reconfigureLocationUpdates(currentActivityType)
    }

    /**
     * Detiene el servicio y cesa de forma inmediata toda captura de ubicación y sensores.
     */
    private fun stopForegroundTracking() {
        // Cese inmediato de recolección de geolocalización
        try {
            fusedLocationClient.removeLocationUpdates(locationCallback)
        } catch (_: Exception) {
        }

        // Desuscribir reconocimiento de actividad
        unsubscribeFromActivityTransitions()

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

    /**
     * Adapta la tasa de refresco y precisión del GPS según la actividad física detectada (RNF-01).
     */
    private fun reconfigureLocationUpdates(activityType: Int) {
        if (!_isTracking.value) return

        val locationRequest = buildAdaptiveLocationRequest(activityType)

        try {
            // Remueve solicitud previa y aplica la nueva en caliente
            fusedLocationClient.removeLocationUpdates(locationCallback)
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
        } catch (_: SecurityException) {
            // Manejado si se revocó el permiso de ubicación en runtime
        }
    }

    /**
     * Construye un LocationRequest optimizado según la actividad detectada:
     * - STILL (Detenido): Intervalo largo (90s, min 25m) para máximo ahorro de batería.
     * - WALKING / ON_FOOT: Intervalo medio (20s, min 10m).
     * - IN_VEHICLE: Intervalo rápido de alta precisión (10s, min 15m).
     * - DEFAULT / UNKNOWN: Intervalo balanceado (15s, min 10m).
     */
    fun buildAdaptiveLocationRequest(activityType: Int): LocationRequest {
        return when (activityType) {
            DetectedActivity.STILL -> {
                LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, 90_000L)
                    .setMinUpdateIntervalMillis(30_000L)
                    .setMinUpdateDistanceMeters(25.0f)
                    .setWaitForAccurateLocation(false)
                    .build()
            }
            DetectedActivity.WALKING, DetectedActivity.ON_FOOT -> {
                LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, 20_000L)
                    .setMinUpdateIntervalMillis(10_000L)
                    .setMinUpdateDistanceMeters(10.0f)
                    .setWaitForAccurateLocation(false)
                    .build()
            }
            DetectedActivity.IN_VEHICLE -> {
                LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10_000L)
                    .setMinUpdateIntervalMillis(5_000L)
                    .setMinUpdateDistanceMeters(15.0f)
                    .setWaitForAccurateLocation(false)
                    .build()
            }
            else -> {
                LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 15_000L)
                    .setMinUpdateIntervalMillis(5_000L)
                    .setMinUpdateDistanceMeters(10.0f)
                    .setWaitForAccurateLocation(false)
                    .build()
            }
        }
    }

    private fun processLocationUpdate(location: Location) {
        if (currentJornadaId.isEmpty()) return

        _lastLocation.value = location

        // Inspección y auditoría de Fake GPS / Desvíos de reloj > 60s (TASK-011)
        val securityAudit = AntiTamperingManager.inspectAndAuditLocation(
            location = location,
            shiftId = currentJornadaId,
            trackingRepository = trackingRepository,
            scope = serviceScope
        )

        serviceScope.launch {
            // Persistencia en Room mediante TrackingRepository con encadenamiento HMAC
            trackingRepository.recordLocation(
                shiftId = currentJornadaId,
                latitud = location.latitude,
                longitud = location.longitude,
                precision = location.accuracy,
                altitud = if (location.hasAltitude()) location.altitude else null,
                velocidad = if (location.hasSpeed()) location.speed else null,
                timestamp = location.time,
                isMock = securityAudit.isMock
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
            trackingRepository.recordAuditEvent(
                shiftId = currentJornadaId,
                eventType = tipoEvento,
                metadataJson = metadataJson,
                timestamp = customTimestamp
            )
        }
    }

    private fun subscribeToActivityTransitions() {
        try {
            val intent = Intent(this, ActivityTransitionReceiver::class.java).apply {
                action = ActivityTransitionReceiver.ACTION_ACTIVITY_TRANSITION
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            activityPendingIntent = PendingIntent.getBroadcast(this, 3001, intent, flags)

            activityRecognitionClient.requestActivityTransitionUpdates(
                ActivityTransitionReceiver.buildTransitionRequest(),
                activityPendingIntent!!
            )
        } catch (_: SecurityException) {
            // Manejado si ACTIVITY_RECOGNITION no fue concedido en runtime
        } catch (_: Exception) {
        }
    }

    private fun unsubscribeFromActivityTransitions() {
        activityPendingIntent?.let {
            try {
                activityRecognitionClient.removeActivityTransitionUpdates(it)
            } catch (_: Exception) {
            }
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
            .setSubText("Monitoreo continuo en curso")
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

