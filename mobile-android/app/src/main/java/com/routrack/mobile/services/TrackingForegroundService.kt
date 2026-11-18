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

        // Constantes Cinemáticas de Muestreo Reactivo (TASK-033)
        const val BEARING_CHANGE_THRESHOLD_DEGREES = 15.0f
        const val MIN_CORNER_DISTANCE_METERS = 5.0f
        const val MIN_VEHICLE_DISTANCE_METERS = 15.0f
        const val MIN_WALKING_DISTANCE_METERS = 10.0f
        const val MIN_STILL_DISTANCE_METERS = 25.0f
        const val MIN_SPEED_FOR_BEARING_MPS = 0.8f
        const val MAX_HEARTBEAT_INTERVAL_MS = 60_000L

        private val _isTracking = MutableStateFlow(false)
        val isTracking = _isTracking.asStateFlow()

        private val _lastLocation = MutableStateFlow<Location?>(null)
        val lastLocation = _lastLocation.asStateFlow()

        private val _currentDetectedActivity = MutableStateFlow(DetectedActivity.UNKNOWN)
        val currentDetectedActivity = _currentDetectedActivity.asStateFlow()

        private val _activeJornadaId = MutableStateFlow<String?>(null)
        val activeJornadaId = _activeJornadaId.asStateFlow()

        private val _activeVendedorId = MutableStateFlow<String?>(null)
        val activeVendedorId = _activeVendedorId.asStateFlow()

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

        /**
         * Calcula la distancia geodésica exacta entre dos coordenadas WGS84 utilizando la fórmula de Haversine.
         */
        fun calculateHaversineDistanceMeters(
            lat1: Double, lon1: Double,
            lat2: Double, lon2: Double
        ): Double {
            val earthRadius = 6371000.0 // Radio terrestre en metros
            val dLat = Math.toRadians(lat2 - lat1)
            val dLon = Math.toRadians(lon2 - lon1)
            val a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2)
            val c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a))
            return earthRadius * c
        }

        /**
         * Calcula el rumbo geodésico inicial (bearing / azimut) en grados [0.0, 360.0) desde el punto previo al actual.
         */
        fun calculateBearing(
            prevLat: Double, prevLng: Double,
            newLat: Double, newLng: Double
        ): Float {
            val phi1 = Math.toRadians(prevLat)
            val phi2 = Math.toRadians(newLat)
            val deltaLambda = Math.toRadians(newLng - prevLng)

            val y = Math.sin(deltaLambda) * Math.cos(phi2)
            val x = Math.cos(phi1) * Math.sin(phi2) -
                    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda)

            val initialBearing = Math.toDegrees(Math.atan2(y, x))
            return (((initialBearing + 360.0) % 360.0)).toFloat()
        }

        /**
         * Calcula la diferencia angular mínima entre dos rumbos (bearing delta) en el rango [0.0, 180.0].
         * Maneja correctamente la discontinuidad en el norte (360° / 0°).
         */
        fun calculateBearingDelta(bearingA: Float, bearingB: Float): Float {
            val diff = Math.abs(((bearingB - bearingA + 540.0) % 360.0) - 180.0)
            return diff.toFloat()
        }

        /**
         * Algoritmo cinemático adaptativo de muestreo por rumbo y distancia (TASK-033).
         * Determina si una coordenada recibida amerita ser persistida en base de datos local y firmada con HMAC,
         * o si debe descartarse para preservar la batería del dispositivo móvil (< 5-7% por jornada de 8h).
         */
        fun shouldSampleLocation(
            newLocation: Location,
            lastSampled: Location?,
            activityType: Int
        ): Boolean {
            // 1. El primer punto de la jornada siempre se registra
            if (lastSampled == null) return true

            val distance = calculateHaversineDistanceMeters(
                lastSampled.latitude, lastSampled.longitude,
                newLocation.latitude, newLocation.longitude
            )
            val timeDeltaMs = Math.max(1L, newLocation.time - lastSampled.time)

            // Determinar orientación actual del desplazamiento
            val currentBearing = if (newLocation.hasBearing() && newLocation.bearing > 0f) {
                newLocation.bearing
            } else if (distance >= 1.0) {
                calculateBearing(
                    lastSampled.latitude, lastSampled.longitude,
                    newLocation.latitude, newLocation.longitude
                )
            } else {
                null
            }

            // Determinar orientación previa del desplazamiento
            val previousBearing = if (lastSampled.hasBearing() && lastSampled.bearing > 0f) {
                lastSampled.bearing
            } else {
                null
            }

            // Calcular diferencia angular si se cuenta con ambos rumbos
            val bearingDelta = if (currentBearing != null && previousBearing != null) {
                calculateBearingDelta(previousBearing, currentBearing)
            } else {
                0.0f
            }

            return when (activityType) {
                DetectedActivity.IN_VEHICLE -> {
                    // Detección de giro reactivo en esquinas viales (Δθ >= 15° y distancia mínima de 5m)
                    if (bearingDelta >= BEARING_CHANGE_THRESHOLD_DEGREES && distance >= MIN_CORNER_DISTANCE_METERS) {
                        true
                    }
                    // Desplazamiento lineal continuo en avenida o carretera (>= 15 metros)
                    else if (distance >= MIN_VEHICLE_DISTANCE_METERS) {
                        true
                    }
                    // Heartbeat temporal ante semáforo prolongado o congestión vehicular
                    else if (timeDeltaMs >= 30_000L && distance >= 3.0) {
                        true
                    } else {
                        false
                    }
                }
                DetectedActivity.STILL -> {
                    // Estado detenido: Solo registrar si el vendedor superó la geocerca de parada (>= 25m)
                    // o tras intervalo prolongado de latencia (90s) para confirmar presencia sin drenar batería
                    if (distance >= MIN_STILL_DISTANCE_METERS) {
                        true
                    } else if (timeDeltaMs >= 90_000L) {
                        true
                    } else {
                        false
                    }
                }
                DetectedActivity.WALKING, DetectedActivity.ON_FOOT -> {
                    // Desplazamiento peatonal: giros de esquina a pie o paso peatonal (>= 10m)
                    if (bearingDelta >= 25.0f && distance >= MIN_CORNER_DISTANCE_METERS) {
                        true
                    } else if (distance >= MIN_WALKING_DISTANCE_METERS) {
                        true
                    } else if (timeDeltaMs >= 30_000L) {
                        true
                    } else {
                        false
                    }
                }
                else -> {
                    // Perfil balanceado por defecto ante actividad desconocida
                    if (bearingDelta >= BEARING_CHANGE_THRESHOLD_DEGREES && distance >= MIN_CORNER_DISTANCE_METERS) {
                        true
                    } else if (distance >= 10.0f) {
                        true
                    } else if (timeDeltaMs >= 20_000L) {
                        true
                    } else {
                        false
                    }
                }
            }
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

    // Estado local para el filtro cinemático adaptativo (TASK-033)
    private var lastSampledLocation: Location? = null
    private var lastSampledBearing: Float? = null

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
                    _activeVendedorId.value = vendedorId
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
        _activeVendedorId.value = null
        lastSampledLocation = null
        lastSampledBearing = null

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

        // Algoritmo de Muestreo Cinemático Adaptativo (TASK-033):
        // Evalúa cambios angulares de orientación (Δθ >= 15° en esquinas), avance vial y ahorro de batería (RNF-01)
        val shouldSample = shouldSampleLocation(
            newLocation = location,
            lastSampled = lastSampledLocation,
            activityType = currentActivityType
        )

        if (!shouldSample) {
            // Se descartan coordenadas redundantes intermedias para mantener el consumo de batería < 5-7%
            return
        }

        val previousSample = lastSampledLocation
        lastSampledLocation = location

        // Cálculo o propagación de rumbo (bearing) y velocidad instantánea
        val effectiveBearing: Float? = if (location.hasBearing() && location.bearing > 0f) {
            location.bearing
        } else if (previousSample != null) {
            val dist = calculateHaversineDistanceMeters(
                previousSample.latitude, previousSample.longitude,
                location.latitude, location.longitude
            )
            if (dist >= 1.0) {
                calculateBearing(
                    previousSample.latitude, previousSample.longitude,
                    location.latitude, location.longitude
                )
            } else {
                lastSampledBearing
            }
        } else {
            null
        }

        lastSampledBearing = effectiveBearing

        val effectiveSpeed: Float? = if (location.hasSpeed()) {
            location.speed
        } else if (previousSample != null) {
            val dist = calculateHaversineDistanceMeters(
                previousSample.latitude, previousSample.longitude,
                location.latitude, location.longitude
            )
            val timeDeltaMs = location.time - previousSample.time
            if (timeDeltaMs > 0) {
                (dist / (timeDeltaMs / 1000.0)).toFloat()
            } else {
                null
            }
        } else {
            null
        }

        serviceScope.launch {
            // Persistencia en Room mediante TrackingRepository con encadenamiento HMAC
            trackingRepository.recordLocation(
                shiftId = currentJornadaId,
                latitud = location.latitude,
                longitud = location.longitude,
                precision = location.accuracy,
                altitud = if (location.hasAltitude()) location.altitude else null,
                velocidad = effectiveSpeed,
                bearing = effectiveBearing,
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

