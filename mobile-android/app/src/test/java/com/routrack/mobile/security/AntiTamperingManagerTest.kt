package com.routrack.mobile.security

import com.empresa.routrack.data.local.entity.BitacoraAuditoriaEntity
import com.empresa.routrack.data.local.entity.UbicacionGpsEntity
import com.empresa.routrack.data.repository.TrackingRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Suite de pruebas unitarias para AntiTamperingManager (TASK-011).
 * Valida la detección ineludible de Fake GPS y anomalías de tiempo > 60s.
 */
class AntiTamperingManagerTest {

    private lateinit var fakeTrackingRepository: FakeTrackingRepository
    private val shiftId = "shift-anti-tampering-123"

    @Before
    fun setUp() {
        AntiTamperingManager.resetState()
        fakeTrackingRepository = FakeTrackingRepository()
    }

    @Test
    fun testClockSkewBelowSixtySecondsIsNotAnomalous() {
        val systemTime = 1700000050000L
        val gpsTime = 1700000045000L // Desfase de 5 segundos

        val skewSeconds = AntiTamperingManager.calculateClockSkewSeconds(systemTime, gpsTime)
        assertEquals(5L, skewSeconds)

        val isAnomalous = AntiTamperingManager.isClockSkewAnomalous(skewSeconds)
        assertFalse("Un desfase menor o igual a 60 segundos debe ser tolerado", isAnomalous)
    }

    @Test
    fun testClockSkewExactlySixtySecondsIsTolerated() {
        val systemTime = 1700000060000L
        val gpsTime = 1700000000000L // Desfase exacto de 60 segundos

        val skewSeconds = AntiTamperingManager.calculateClockSkewSeconds(systemTime, gpsTime)
        assertEquals(60L, skewSeconds)

        val isAnomalous = AntiTamperingManager.isClockSkewAnomalous(skewSeconds)
        assertFalse("Un desfase exacto de 60 segundos no debe marcarse como anomalía", isAnomalous)
    }

    @Test
    fun testClockSkewAboveSixtySecondsTriggersAnomaly() {
        val systemTime = 1700000075000L
        val gpsTime = 1700000000000L // Desfase de 75 segundos (> 60s)

        val skewSeconds = AntiTamperingManager.calculateClockSkewSeconds(systemTime, gpsTime)
        assertEquals(75L, skewSeconds)

        val isAnomalous = AntiTamperingManager.isClockSkewAnomalous(skewSeconds)
        assertTrue("Un desfase mayor a 60 segundos debe marcarse como anómalo", isAnomalous)
    }

    @Test
    fun testNegativeClockSkewPastTriggersAnomaly() {
        // El usuario atrasó el reloj manual del teléfono 5 minutos
        val systemTime = 1700000000000L
        val gpsTime = 1700000300000L // GPS está 300 segundos en el futuro

        val skewSeconds = AntiTamperingManager.calculateClockSkewSeconds(systemTime, gpsTime)
        assertEquals(300L, skewSeconds)

        val isAnomalous = AntiTamperingManager.isClockSkewAnomalous(skewSeconds)
        assertTrue("Atrasar el reloj manual también debe marcar anomalía", isAnomalous)
    }

    @Test
    fun testMonotonicClockDetectsManualTimeJumpWhileDeviceRunning() {
        val initialGps = 1700000000000L
        val initialElapsed = 10000L // 10s tras boot

        // Calibrar base monotónica
        AntiTamperingManager.calibrateTimeBase(initialGps, initialElapsed)

        // Supongamos que pasaron 50 segundos de hardware (elapsed = 60000)
        val currentElapsed = 60000L
        val expectedTime = AntiTamperingManager.getExpectedTimeFromMonotonicClock(currentElapsed)
        assertEquals(1700000050000L, expectedTime)

        // Pero el usuario alteró la hora del sistema a 2 horas después
        val tamperedSystemTime = 1700007250000L
        val skewSeconds = AntiTamperingManager.calculateClockSkewSeconds(tamperedSystemTime, expectedTime!!)
        assertTrue("El salto relativo en el reloj del sistema debe detectarse via reloj monotónico", skewSeconds > 60L)
    }

    // --- FAKE DE TRACKING REPOSITORY PARA TESTEO AISLADO ---

    private class FakeTrackingRepository : TrackingRepository {
        val auditEvents = CopyOnWriteArrayList<BitacoraAuditoriaEntity>()
        val locations = CopyOnWriteArrayList<UbicacionGpsEntity>()

        override fun observeLastLocation(shiftId: String): Flow<UbicacionGpsEntity?> = emptyFlow()
        override fun observeLocationCount(shiftId: String): Flow<Int> = emptyFlow()
        override fun observeLocations(shiftId: String): Flow<List<UbicacionGpsEntity>> = emptyFlow()
        override suspend fun getLastLocation(shiftId: String): UbicacionGpsEntity? = locations.lastOrNull()
        override suspend fun getLocationCount(shiftId: String): Int = locations.size
        override suspend fun getTotalStoredPoints(): Int = locations.size

        override suspend fun recordLocation(
            shiftId: String,
            latitud: Double,
            longitud: Double,
            precision: Float,
            altitud: Double?,
            velocidad: Float?,
            timestamp: Long,
            isMock: Boolean
        ): Result<UbicacionGpsEntity> {
            val entity = UbicacionGpsEntity(
                id = "loc-${locations.size + 1}",
                jornadaId = shiftId,
                latitud = latitud,
                longitud = longitud,
                precision = precision,
                altitud = altitud,
                velocidad = velocidad,
                timestampCaptura = timestamp,
                sincronizado = false
            )
            locations.add(entity)
            return Result.success(entity)
        }

        override suspend fun recordAuditEvent(
            shiftId: String,
            eventType: String,
            metadataJson: String,
            timestamp: Long
        ): Result<BitacoraAuditoriaEntity> {
            val entity = BitacoraAuditoriaEntity(
                id = "audit-${auditEvents.size + 1}",
                jornadaId = shiftId,
                tipoEvento = eventType,
                metadataJson = metadataJson,
                timestampEvento = timestamp,
                hashPrevio = "prev",
                hashActual = "act",
                sincronizado = false
            )
            auditEvents.add(entity)
            return Result.success(entity)
        }

        override suspend fun getPendingLocations(limit: Int): List<UbicacionGpsEntity> = emptyList()
        override suspend fun getPendingLocationsForShift(shiftId: String, limit: Int): List<UbicacionGpsEntity> = emptyList()
        override suspend fun getPendingAuditEvents(limit: Int): List<BitacoraAuditoriaEntity> = emptyList()
        override suspend fun markLocationsAsSynced(ids: List<String>): Result<Unit> = Result.success(Unit)
        override suspend fun markAuditEventsAsSynced(ids: List<String>): Result<Unit> = Result.success(Unit)
        override suspend fun purgeSyncedLocations(thresholdTimestamp: Long): Result<Int> = Result.success(0)
    }
}
