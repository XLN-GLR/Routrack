package com.routrack.mobile.security

import android.location.Location
import android.os.Build
import android.os.SystemClock
import com.empresa.routrack.data.repository.TrackingRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.math.abs

/**
 * Gestor de seguridad y detección de manipulación en el dispositivo Android (Anti-Tampering).
 *
 * Responsabilidades:
 * 1. Detección de Fake GPS / Mock Location Providers:
 *    Identifica si una coordenada fue inyectada artificialmente por software de emulación
 *    y asegura que se marque inequívocamente como 'is_mock = true' (Criterio de Aceptación 1).
 * 2. Detección de Anomalías Temporales (Clock Skew / Time Anomaly):
 *    Compara el reloj del sistema (System.currentTimeMillis()) contra la referencia temporal
 *    atómica de red/satelital (location.time) y el reloj monotónico del hardware (SystemClock.elapsedRealtime()).
 *    Si el desvío excede los 60 segundos, genera un evento de auditoría de advertencia (Criterio de Aceptación 2).
 */
object AntiTamperingManager {

    /** Umbral máximo de tolerancia temporal antes de declarar manipulación de reloj (60 segundos) */
    const val CLOCK_SKEW_THRESHOLD_SECONDS = 60L
    const val CLOCK_SKEW_THRESHOLD_MILLIS = CLOCK_SKEW_THRESHOLD_SECONDS * 1000L

    const val EVENT_MOCK_LOCATION_DETECTED = "MOCK_LOCATION_DETECTED"
    const val EVENT_TIME_ANOMALY_DETECTED = "TIME_ANOMALY_DETECTED"

    private val _mockLocationDetectedCount = MutableStateFlow(0)
    val mockLocationDetectedCount = _mockLocationDetectedCount.asStateFlow()

    private val _lastDetectedClockSkewSeconds = MutableStateFlow<Long?>(null)
    val lastDetectedClockSkewSeconds = _lastDetectedClockSkewSeconds.asStateFlow()

    /** Referencia base de calibración: (location.time - elapsedRealtime) */
    @Volatile
    private var calibratedTimeBaseMillis: Long? = null

    /**
     * Resultado inmutable de la inspección de integridad de una coordenada.
     */
    data class LocationSecurityAudit(
        val isMock: Boolean,
        val clockSkewSeconds: Long,
        val isTimeAnomalous: Boolean,
        val metadataJson: String
    )

    /**
     * Determina si una coordenada fue generada por un proveedor simulado (Mock Location / Fake GPS).
     */
    fun isMockLocation(location: Location): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            location.isMock
        } else {
            @Suppress("DEPRECATION")
            location.isFromMockProvider
        }
    }

    /**
     * Calcula el desfase en segundos entre el tiempo del sistema y una referencia temporal confiable (GPS/NTP).
     */
    fun calculateClockSkewSeconds(systemTimeMillis: Long, referenceTimeMillis: Long): Long {
        return abs(systemTimeMillis - referenceTimeMillis) / 1000L
    }

    /**
     * Evalúa si un desfase temporal supera el umbral límite de 60 segundos.
     */
    fun isClockSkewAnomalous(
        skewSeconds: Long,
        thresholdSeconds: Long = CLOCK_SKEW_THRESHOLD_SECONDS
    ): Boolean {
        return skewSeconds > thresholdSeconds
    }

    /**
     * Calibra la base de tiempo monotónico utilizando un fix satelital confiable.
     */
    fun calibrateTimeBase(locationGpsTimeMillis: Long, elapsedRealtimeMillis: Long = SystemClock.elapsedRealtime()) {
        calibratedTimeBaseMillis = locationGpsTimeMillis - elapsedRealtimeMillis
    }

    /**
     * Calcula el tiempo esperado actual a partir del reloj monotónico de hardware.
     */
    fun getExpectedTimeFromMonotonicClock(currentElapsedMillis: Long = SystemClock.elapsedRealtime()): Long? {
        val base = calibratedTimeBaseMillis ?: return null
        return base + currentElapsedMillis
    }

    /**
     * Inspecciona una ubicación capturada, determina anomalías de Fake GPS y reloj,
     * y registra de forma asíncrona los eventos de auditoría correspondientes si se detectan violaciones.
     */
    fun inspectAndAuditLocation(
        location: Location,
        shiftId: String,
        trackingRepository: TrackingRepository,
        scope: CoroutineScope = CoroutineScope(Dispatchers.IO),
        systemTimeMillis: Long = System.currentTimeMillis(),
        elapsedRealtimeMillis: Long = SystemClock.elapsedRealtime()
    ): LocationSecurityAudit {
        val isMock = isMockLocation(location)

        // Calibrar base monotónica si no existe
        if (calibratedTimeBaseMillis == null && !isMock && location.time > 0) {
            calibrateTimeBase(location.time, elapsedRealtimeMillis)
        }

        // Evaluar discrepancia contra tiempo satelital
        val gpsTime = if (location.time > 0) location.time else systemTimeMillis
        val directSkewSeconds = calculateClockSkewSeconds(systemTimeMillis, gpsTime)

        // Evaluar discrepancia contra reloj monotónico si está calibrado
        val expectedMonotonic = getExpectedTimeFromMonotonicClock(elapsedRealtimeMillis)
        val monotonicSkewSeconds = expectedMonotonic?.let {
            calculateClockSkewSeconds(systemTimeMillis, it)
        } ?: directSkewSeconds

        val effectiveSkewSeconds = maxOf(directSkewSeconds, monotonicSkewSeconds)
        val isTimeAnomalous = isClockSkewAnomalous(effectiveSkewSeconds)

        _lastDetectedClockSkewSeconds.value = effectiveSkewSeconds

        val metadata = buildString {
            append("{\"lat\":").append(location.latitude)
            append(",\"lng\":").append(location.longitude)
            append(",\"isMock\":").append(isMock)
            append(",\"systemTime\":").append(systemTimeMillis)
            append(",\"gpsTime\":").append(gpsTime)
            append(",\"skewSeconds\":").append(effectiveSkewSeconds)
            append(",\"isTimeAnomalous\":").append(isTimeAnomalous)
            append("}")
        }

        // 1. Si es Mock Location, registrar evento de auditoría
        if (isMock) {
            _mockLocationDetectedCount.value += 1
            if (shiftId.isNotEmpty()) {
                scope.launch {
                    trackingRepository.recordAuditEvent(
                        shiftId = shiftId,
                        eventType = EVENT_MOCK_LOCATION_DETECTED,
                        metadataJson = metadata,
                        timestamp = systemTimeMillis
                    )
                }
            }
        }

        // 2. Si el desfase de tiempo es > 60s, registrar evento de auditoría de advertencia
        if (isTimeAnomalous && shiftId.isNotEmpty()) {
            scope.launch {
                trackingRepository.recordAuditEvent(
                    shiftId = shiftId,
                    eventType = EVENT_TIME_ANOMALY_DETECTED,
                    metadataJson = metadata,
                    timestamp = systemTimeMillis
                )
            }
        }

        return LocationSecurityAudit(
            isMock = isMock,
            clockSkewSeconds = effectiveSkewSeconds,
            isTimeAnomalous = isTimeAnomalous,
            metadataJson = metadata
        )
    }

    /**
     * Resetea el estado interno (utilizado principalmente para aislamiento en suites de prueba).
     */
    fun resetState() {
        _mockLocationDetectedCount.value = 0
        _lastDetectedClockSkewSeconds.value = null
        calibratedTimeBaseMillis = null
    }
}
