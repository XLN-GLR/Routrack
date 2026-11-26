package com.empresa.routrack.service

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.empresa.routrack.data.local.entity.BitacoraAuditoriaEntity
import com.empresa.routrack.data.repository.RepositoryProvider
import com.empresa.routrack.data.repository.TrackingRepository
import com.empresa.routrack.ui.MainActivity
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationAvailability
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.routrack.mobile.security.AntiTamperingManager
import com.routrack.mobile.workers.SyncScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Servicio en Primer Plano persistente para la captura de geolocalización continua.
 *
 * Cumplimiento Normativo (LOPDP Ecuador y Políticas de Android):
 * - Mantiene una notificación fija y transparente en la barra de estado indicando el monitoreo activo.
 * - Solo recolecta coordenadas mientras el turno está formalmente en curso.
 * - Integra doble motor de captura (FusedLocationProviderClient + LocationManager nativo GPS/Red)
 *   para garantizar señal tanto en exteriores satelitales como en interiores.
 * - Desacoplado de Room mediante TrackingRepository para inserción atómica y resiliencia offline.
 */
class LocationForegroundService : Service() {

    companion object {
        private const val TAG = "LocationFgService"
        const val ACTION_START_TRACKING = "com.empresa.routrack.action.START_TRACKING"
        const val ACTION_STOP_TRACKING = "com.empresa.routrack.action.STOP_TRACKING"

        const val EXTRA_JORNADA_ID = "extra_jornada_id"
        const val EXTRA_VENDEDOR_ID = "extra_vendedor_id"

        private const val NOTIFICATION_ID = 4001
        private const val CHANNEL_ID = "routrack_tracking_channel"
        private const val CHANNEL_NAME = "ROUTRACK Monitoreo de Jornada"
        private const val MIN_DEDUP_INTERVAL_MS = 3_000L

        private val _isTracking = MutableStateFlow(false)
        val isTracking = _isTracking.asStateFlow()

        private val _lastLocation = MutableStateFlow<Location?>(null)
        val lastLocation = _lastLocation.asStateFlow()

        private val _activeJornadaId = MutableStateFlow<String?>(null)
        val activeJornadaId = _activeJornadaId.asStateFlow()

        private val _activeVendedorId = MutableStateFlow<String?>(null)
        val activeVendedorId = _activeVendedorId.asStateFlow()

        private val _batteryLevel = MutableStateFlow(100)
        val batteryLevel = _batteryLevel.asStateFlow()

        private val _locationDiagnostic = MutableStateFlow<String?>(null)
        val locationDiagnostic = _locationDiagnostic.asStateFlow()

        fun getBatteryPercentage(context: Context): Int {
            return try {
                val bm = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
                val cap = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
                val level = if (cap in 0..100) cap else {
                    val filter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
                    val batteryStatus = context.registerReceiver(null, filter)
                    val l = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
                    val s = batteryStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
                    if (l >= 0 && s > 0) (l * 100) / s else 100
                }
                _batteryLevel.value = level
                level
            } catch (_: Throwable) {
                100
            }
        }

        fun startTracking(context: Context, jornadaId: String, vendedorId: String) {
            val intent = Intent(context, LocationForegroundService::class.java).apply {
                action = ACTION_START_TRACKING
                putExtra(EXTRA_JORNADA_ID, jornadaId)
                putExtra(EXTRA_VENDEDOR_ID, vendedorId)
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (t: Throwable) {
                Log.e(TAG, "No fue posible iniciar LocationForegroundService", t)
                _locationDiagnostic.value = "Error al iniciar servicio GPS: ${t.localizedMessage}"
            }
        }

        fun stopTracking(context: Context) {
            val intent = Intent(context, LocationForegroundService::class.java).apply {
                action = ACTION_STOP_TRACKING
            }
            try {
                context.startService(intent)
            } catch (t: Throwable) {
                Log.w(TAG, "Aviso al detener servicio: ${t.localizedMessage}")
            }
        }
    }

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var trackingRepository: TrackingRepository
    private lateinit var syncRepository: com.routrack.mobile.data.repository.SyncRepository
    private var liveSyncJob: kotlinx.coroutines.Job? = null
    private var locationManager: LocationManager? = null
    private var currentJornadaId: String = ""
    private var currentVendedorId: String = ""

    @Volatile
    private var lastPersistedWallTimeMs: Long = 0L

    @Volatile
    private var lastPersistedLat: Double = Double.NaN

    @Volatile
    private var lastPersistedLng: Double = Double.NaN

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            for (location in result.locations) {
                processLocationUpdate(location)
            }
        }

        override fun onLocationAvailability(availability: LocationAvailability) {
            if (!availability.isLocationAvailable && currentJornadaId.isNotEmpty()) {
                _locationDiagnostic.value = "Señal satelital temporalmente indisponible; esperando proveedor GPS/Red..."
                recordAuditEvent(
                    tipoEvento = BitacoraAuditoriaEntity.EVENTO_GPS_DISABLED,
                    metadataJson = "{\"gps_available\":false,\"timestamp\":${System.currentTimeMillis()}}"
                )
            }
        }
    }

    private val nativeLocationListener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
            processLocationUpdate(location)
        }

        @Deprecated("Deprecated in Android API 29")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {
            // Requerido por compatibilidad con API 26-28
        }

        override fun onProviderEnabled(provider: String) {
            Log.i(TAG, "Proveedor nativo habilitado: $provider")
            if (currentJornadaId.isNotEmpty() && _lastLocation.value == null) {
                _locationDiagnostic.value = "Proveedor $provider habilitado. Adquiriendo posición..."
            }
        }

        override fun onProviderDisabled(provider: String) {
            Log.w(TAG, "Proveedor nativo deshabilitado: $provider")
            if (provider == LocationManager.GPS_PROVIDER && currentJornadaId.isNotEmpty()) {
                _locationDiagnostic.value = "GPS satelital desactivado en ajustes; intentando por red..."
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        trackingRepository = RepositoryProvider.getTrackingRepository(applicationContext)
        syncRepository = RepositoryProvider.getSyncRepository(applicationContext)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        locationManager = getSystemService(Context.LOCATION_SERVICE) as? LocationManager
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

    private fun hasFinePermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun hasAnyLocationPermission(): Boolean {
        return hasFinePermission() || ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun startForegroundTracking() {
        val notification = buildPersistentNotification()

        if (!hasAnyLocationPermission()) {
            Log.e(TAG, "Sin permisos de ubicación para iniciar ForegroundService")
            _locationDiagnostic.value = "Permiso de ubicación no concedido. Concede Ubicación Precisa en Ajustes."
            try {
                startForeground(NOTIFICATION_ID, notification)
            } catch (_: Throwable) {
            }
            stopForegroundTracking()
            return
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (se: SecurityException) {
            Log.e(TAG, "SecurityException al promover a ForegroundService tipo location", se)
            _locationDiagnostic.value = "Android bloqueó el inicio en primer plano. Verifica el permiso de ubicación."
            stopSelf()
            return
        }

        _isTracking.value = true
        _activeJornadaId.value = currentJornadaId
        _activeVendedorId.value = currentVendedorId
        getBatteryPercentage(this)
        _locationDiagnostic.value = "Buscando señal GPS y triangulación de red..."

        // Registrar evento SERVICE_STARTED en bitácora y luego programar sync
        recordAuditEvent(
            tipoEvento = BitacoraAuditoriaEntity.EVENTO_SERVICE_STARTED,
            metadataJson = "{\"action\":\"START\",\"vendedorId\":\"$currentVendedorId\"}",
            triggerImmediateSync = true
        )

        // Evaluar si al menos un proveedor físico del dispositivo está encendido
        val lm = locationManager
        val gpsEnabled = try { lm?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true } catch (_: Throwable) { false }
        val networkEnabled = try { lm?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true } catch (_: Throwable) { false }

        if (!gpsEnabled && !networkEnabled) {
            _locationDiagnostic.value = "La Ubicación del teléfono está apagada. Enciéndela en la barra superior de Android."
        } else if (!hasFinePermission()) {
            _locationDiagnostic.value = "Solo tienes Ubicación Aproximada. Activa 'Ubicación Precisa' en Ajustes."
        }

        // 1. Obtener última ubicación conocida en caché de Google Play Services (bloque aislado)
        try {
            fusedLocationClient.lastLocation
                .addOnSuccessListener { cachedLocation ->
                    if (cachedLocation != null && currentJornadaId.isNotEmpty()) {
                        processLocationUpdate(cachedLocation)
                    }
                }
                .addOnFailureListener { err ->
                    Log.w(TAG, "Fused lastLocation falló: ${err.localizedMessage}")
                }
        } catch (t: Throwable) {
            Log.w(TAG, "Excepción en Fused lastLocation", t)
        }

        // 2. Fallback inmediato con caché de LocationManager nativo (cada proveedor aislado)
        if (lm != null) {
            if (hasFinePermission()) {
                try {
                    lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)?.let { gpsLoc ->
                        if (currentJornadaId.isNotEmpty()) processLocationUpdate(gpsLoc)
                    }
                } catch (t: Throwable) {
                    Log.w(TAG, "Aviso getLastKnownLocation GPS: ${t.localizedMessage}")
                }
            }
            try {
                lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)?.let { netLoc ->
                    if (currentJornadaId.isNotEmpty()) processLocationUpdate(netLoc)
                }
            } catch (t: Throwable) {
                Log.w(TAG, "Aviso getLastKnownLocation NETWORK: ${t.localizedMessage}")
            }
            try {
                lm.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER)?.let { passiveLoc ->
                    if (currentJornadaId.isNotEmpty()) processLocationUpdate(passiveLoc)
                }
            } catch (t: Throwable) {
                Log.w(TAG, "Aviso getLastKnownLocation PASSIVE: ${t.localizedMessage}")
            }
        }

        // 3. Solicitud activa única inmediata (tanto alta precisión como balanceada por WiFi/Antena)
        try {
            val activePriority = if (hasFinePermission()) {
                Priority.PRIORITY_HIGH_ACCURACY
            } else {
                Priority.PRIORITY_BALANCED_POWER_ACCURACY
            }
            fusedLocationClient.getCurrentLocation(activePriority, null)
                .addOnSuccessListener { activeLoc ->
                    if (activeLoc != null && currentJornadaId.isNotEmpty()) {
                        processLocationUpdate(activeLoc)
                    }
                }
                .addOnFailureListener { err ->
                    Log.w(TAG, "getCurrentLocation($activePriority) falló: ${err.localizedMessage}")
                }

            fusedLocationClient.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null)
                .addOnSuccessListener { balancedLoc ->
                    if (balancedLoc != null && currentJornadaId.isNotEmpty()) {
                        processLocationUpdate(balancedLoc)
                    }
                }
        } catch (t: Throwable) {
            Log.w(TAG, "Excepción en getCurrentLocation", t)
        }

        // 4. Suscripción continua en FusedLocationProviderClient
        try {
            val continuousPriority = if (hasFinePermission()) {
                Priority.PRIORITY_HIGH_ACCURACY
            } else {
                Priority.PRIORITY_BALANCED_POWER_ACCURACY
            }
            val locationRequest = LocationRequest.Builder(continuousPriority, 10_000L)
                .setMinUpdateIntervalMillis(4_000L)
                .setMinUpdateDistanceMeters(0.0f)
                .setMaxUpdateDelayMillis(0L)
                .setWaitForAccurateLocation(false)
                .build()

            fusedLocationClient.removeLocationUpdates(locationCallback)
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            ).addOnFailureListener { err ->
                Log.e(TAG, "Error registrando Fused requestLocationUpdates: ${err.localizedMessage}")
            }
        } catch (se: SecurityException) {
            Log.e(TAG, "SecurityException en Fused requestLocationUpdates", se)
            _locationDiagnostic.value = "Permiso de ubicación revocado o insuficiente."
        } catch (t: Throwable) {
            Log.e(TAG, "Error inesperado en Fused requestLocationUpdates", t)
        }

        // 5. Suscripción paralela nativa con LocationManager del sistema operativo (respaldo directo sin Play Services)
        if (lm != null) {
            try {
                lm.removeUpdates(nativeLocationListener)
            } catch (_: Throwable) {
            }

            if (hasFinePermission() && lm.allProviders.contains(LocationManager.GPS_PROVIDER)) {
                try {
                    lm.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER,
                        10_000L,
                        0f,
                        nativeLocationListener,
                        Looper.getMainLooper()
                    )
                } catch (t: Throwable) {
                    Log.w(TAG, "No se pudo suscribir a GPS_PROVIDER nativo: ${t.localizedMessage}")
                }
            }

            if (lm.allProviders.contains(LocationManager.NETWORK_PROVIDER)) {
                try {
                    lm.requestLocationUpdates(
                        LocationManager.NETWORK_PROVIDER,
                        10_000L,
                        0f,
                        nativeLocationListener,
                        Looper.getMainLooper()
                    )
                } catch (t: Throwable) {
                    Log.w(TAG, "No se pudo suscribir a NETWORK_PROVIDER nativo: ${t.localizedMessage}")
                }
            }
        }

        // Programar sincronización periódica de respaldo
        try {
            SyncScheduler.schedulePeriodicSync(applicationContext)
        } catch (_: Throwable) {
        }

        // Iniciar bucle de sincronización en caliente continua (cada 12s) para tiempo real fehaciente
        startLiveSyncLoop()
    }

    private fun startLiveSyncLoop() {
        liveSyncJob?.cancel()
        liveSyncJob = serviceScope.launch {
            delay(2_000L)
            while (isActive && _isTracking.value) {
                val activeShift = currentJornadaId
                if (activeShift.isNotEmpty()) {
                    val now = System.currentTimeMillis()
                    // Actualizar nivel de batería en cada iteración del bucle
                    getBatteryPercentage(applicationContext)

                    // Si el celular está inmóvil por más de 25s, emitir latido en reposo con velocidad 0.0 km/h
                    if (lastPersistedWallTimeMs > 0 && (now - lastPersistedWallTimeMs) >= 25_000L &&
                        !lastPersistedLat.isNaN() && !lastPersistedLng.isNaN()
                    ) {
                        try {
                            lastPersistedWallTimeMs = now
                            trackingRepository.recordLocation(
                                shiftId = activeShift,
                                latitud = lastPersistedLat,
                                longitud = lastPersistedLng,
                                precision = _lastLocation.value?.accuracy ?: 5.0f,
                                altitud = _lastLocation.value?.altitude,
                                velocidad = 0.0f,
                                bearing = _lastLocation.value?.bearing,
                                timestamp = now,
                                isMock = false
                            )
                        } catch (e: Throwable) {
                            Log.w(TAG, "Latido de reposo falló: ${e.message}")
                        }
                    }

                    try {
                        val pending = syncRepository.getPendingCount()
                        if (pending > 0) {
                            syncRepository.syncPendingBatch(100)
                        }
                    } catch (e: Throwable) {
                        Log.w(TAG, "Sync en vivo en segundo plano postergado: ${e.message}")
                    }
                }
                delay(12_000L)
            }
        }
    }

    private fun stopForegroundTracking() {
        liveSyncJob?.cancel()
        liveSyncJob = null

        try {
            fusedLocationClient.removeLocationUpdates(locationCallback)
        } catch (_: Exception) {
        }

        try {
            locationManager?.removeUpdates(nativeLocationListener)
        } catch (_: Exception) {
        }

        if (currentJornadaId.isNotEmpty()) {
            recordAuditEvent(
                tipoEvento = BitacoraAuditoriaEntity.EVENTO_SERVICE_STOPPED,
                metadataJson = "{\"action\":\"STOP\",\"vendedorId\":\"$currentVendedorId\"}",
                triggerImmediateSync = true
            )
        }

        currentJornadaId = ""
        currentVendedorId = ""
        _isTracking.value = false
        _activeJornadaId.value = null
        _activeVendedorId.value = null
        _lastLocation.value = null
        _locationDiagnostic.value = null
        lastPersistedWallTimeMs = 0L

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun processLocationUpdate(location: Location) {
        val activeShiftId = currentJornadaId
        if (activeShiftId.isEmpty()) return

        // Actualizar UI y nivel de batería inmediatamente
        _lastLocation.value = location
        getBatteryPercentage(this)
        val providerLabel = location.provider ?: "Fused"
        _locationDiagnostic.value = "Señal adquirida vía $providerLabel (±${location.accuracy.toInt()} m)"

        // Descartar lecturas con precisión sumamente degradada si ya tenemos posición previa confiable
        if (location.accuracy > 35.0f && !lastPersistedLat.isNaN() && !lastPersistedLng.isNaN()) {
            return
        }

        // Deduplicación anti-rebote para evitar duplicados simultáneos entre Fused y LocationManager
        val nowWallMs = System.currentTimeMillis()
        val isDuplicateBurst =
            (nowWallMs - lastPersistedWallTimeMs) < MIN_DEDUP_INTERVAL_MS &&
                lastPersistedLat == location.latitude &&
                lastPersistedLng == location.longitude
        if (isDuplicateBurst) return

        val prevLat = lastPersistedLat
        val prevLng = lastPersistedLng
        val prevTimeMs = lastPersistedWallTimeMs

        // Filtro cinemático de suavizado (EMA) y detección rigurosa de reposo a 0.0 km/h
        var targetLat = location.latitude
        var targetLng = location.longitude
        var distMeters = 0f
        var calculatedSpeed: Float? = null

        if (!prevLat.isNaN() && !prevLng.isNaN() && prevTimeMs > 0) {
            val distArray = FloatArray(1)
            Location.distanceBetween(prevLat, prevLng, location.latitude, location.longitude, distArray)
            distMeters = distArray[0]

            // Si el desplazamiento es menor a 3.0 metros, el teléfono está quieto (ruido estático de satélites)
            if (distMeters < 3.0f) {
                // Si ya se registró un punto hace menos de 15 segundos, omitir para no saturar Room
                if ((nowWallMs - prevTimeMs) < 15_000L) {
                    return
                }
                // Si pasaron 15s o más sin moverse, emitir punto de reposo exacto a 0.0 km/h fijando coordenadas
                targetLat = prevLat
                targetLng = prevLng
                calculatedSpeed = 0.0f
            } else {
                // Desplazamiento real (> 3.0m): Suavizado cinemático (EMA) para amortiguar zigzags
                if (distMeters in 3.0f..40.0f) {
                    val alpha = if (location.accuracy <= 10.0f) 0.80 else 0.65
                    targetLat = prevLat + (location.latitude - prevLat) * alpha
                    targetLng = prevLng + (location.longitude - prevLng) * alpha
                }

                // Cálculo cinemático de velocidad para movimiento real
                if (location.hasSpeed()) {
                    val s = location.speed
                    calculatedSpeed = if (s < 0.35f) 0.0f else s // Umbral peatonal (< 1.2 km/h es estático)
                } else {
                    val deltaSec = (nowWallMs - prevTimeMs) / 1000f
                    if (deltaSec in 2f..120f) {
                        val derived = distMeters / deltaSec
                        calculatedSpeed = if (derived < 0.35f) 0.0f else derived
                    }
                }
            }
        } else {
            // Primer punto capturado de la jornada
            if (location.hasSpeed()) {
                val s = location.speed
                calculatedSpeed = if (s < 0.35f) 0.0f else s
            }
        }

        lastPersistedWallTimeMs = nowWallMs
        lastPersistedLat = targetLat
        lastPersistedLng = targetLng

        val securityAudit = AntiTamperingManager.inspectAndAuditLocation(
            location = location,
            shiftId = activeShiftId,
            trackingRepository = trackingRepository,
            scope = serviceScope
        )

        val safeTimestamp = if (location.time > 1_700_000_000_000L) location.time else nowWallMs

        serviceScope.launch {
            trackingRepository.recordLocation(
                shiftId = activeShiftId,
                latitud = targetLat,
                longitud = targetLng,
                precision = location.accuracy,
                altitud = if (location.hasAltitude()) location.altitude else null,
                velocidad = calculatedSpeed,
                bearing = if (location.hasBearing()) location.bearing else null,
                timestamp = safeTimestamp,
                isMock = securityAudit.isMock
            )
            // Sincronización en caliente inmediata al persistir en Room
            try {
                syncRepository.syncPendingBatch(100)
            } catch (_: Throwable) {
                try {
                    SyncScheduler.enqueueImmediateSync(applicationContext)
                } catch (_: Throwable) {
                }
            }
        }
    }

    private fun recordAuditEvent(
        tipoEvento: String,
        metadataJson: String,
        customTimestamp: Long = System.currentTimeMillis(),
        triggerImmediateSync: Boolean = false
    ) {
        val activeShiftId = currentJornadaId
        if (activeShiftId.isEmpty()) return

        serviceScope.launch {
            trackingRepository.recordAuditEvent(
                shiftId = activeShiftId,
                eventType = tipoEvento,
                metadataJson = metadataJson,
                timestamp = customTimestamp
            )
            if (triggerImmediateSync) {
                try {
                    SyncScheduler.enqueueImmediateSync(applicationContext)
                } catch (_: Throwable) {
                }
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
