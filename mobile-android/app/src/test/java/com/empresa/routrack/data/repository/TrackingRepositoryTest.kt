package com.empresa.routrack.data.repository

import com.empresa.routrack.data.crypto.AuditChainManager
import com.empresa.routrack.data.local.dao.BitacoraAuditoriaDao
import com.empresa.routrack.data.local.dao.UbicacionGpsDao
import com.empresa.routrack.data.local.entity.BitacoraAuditoriaEntity
import com.empresa.routrack.data.local.entity.UbicacionGpsEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Pruebas unitarias de TrackingRepository.
 * Valida la concurrencia atómica, el encadenamiento HMAC-SHA256 y la resiliencia offline.
 */
class TrackingRepositoryTest {

    private val secretKey = "TEST_SECRET_KEY_ROUTRACK_2026".toByteArray()
    private val shiftId = "shift-uuid-999"

    // Fakes en memoria thread-safe para aislar la lógica del repositorio
    private lateinit var fakeUbicacionDao: FakeUbicacionGpsDao
    private lateinit var fakeAuditoriaDao: FakeBitacoraAuditoriaDao
    private lateinit var repository: TrackingRepositoryImpl

    @Before
    fun setUp() {
        fakeUbicacionDao = FakeUbicacionGpsDao()
        fakeAuditoriaDao = FakeBitacoraAuditoriaDao()
        repository = TrackingRepositoryImpl(
            ubicacionDao = fakeUbicacionDao,
            auditoriaDao = fakeAuditoriaDao,
            secretKeyProvider = { secretKey }
        )
    }

    @Test
    fun testRecordLocationInsertsBothGpsAndAuditChainAtomically() = runBlocking {
        val result = repository.recordLocation(
            shiftId = shiftId,
            latitud = -0.180653,
            longitud = -78.467834,
            precision = 4.2f,
            altitud = 2850.0,
            velocidad = 1.2f,
            timestamp = 1700000000000L
        )

        assertTrue("El registro debe ser exitoso", result.isSuccess)
        val location = result.getOrNull()
        assertNotNull(location)
        assertEquals(shiftId, location?.jornadaId)

        // Verificar que en la bitácora exista el evento con hash encadenado
        val eventos = fakeAuditoriaDao.getEventosPorJornada(shiftId)
        assertEquals(1, eventos.size)
        val evento = eventos.first()
        assertEquals(BitacoraAuditoriaEntity.EVENTO_CAPTURA_GPS, evento.tipoEvento)
        assertNotNull(evento.hashActual)
        assertTrue(evento.hashActual.isNotEmpty())
    }

    @Test
    fun testConcurrentLocationRecordingsMaintainValidHmacChain() = runBlocking {
        val totalPoints = 20
        val jobs = List(totalPoints) { index ->
            launch {
                repository.recordLocation(
                    shiftId = shiftId,
                    latitud = -0.180000 + (index * 0.001),
                    longitud = -78.460000 + (index * 0.001),
                    precision = 5.0f,
                    timestamp = 1700000000000L + (index * 1000)
                )
            }
        }
        jobs.forEach { it.join() }

        assertEquals(totalPoints, fakeUbicacionDao.countPorJornada(shiftId))
        val eventos = fakeAuditoriaDao.getEventosPorJornada(shiftId)
        assertEquals(totalPoints, eventos.size)

        // Verificar que la cadena completa sea criptográficamente válida sin carreras
        val isValidChain = AuditChainManager.verifyChain(eventos, secretKey)
        assertTrue("La cadena de auditoría generada concurrentemente debe ser matemáticamente válida", isValidChain)
    }

    @Test
    fun testOfflineResilienceWithPendingSyncAndBatchMarking() = runBlocking {
        // Simular acumulación de puntos sin red
        for (i in 1..5) {
            repository.recordLocation(
                shiftId = shiftId,
                latitud = -0.200000 + (i * 0.0005),
                longitud = -78.500000 + (i * 0.0005),
                precision = 3.0f,
                timestamp = 1700000000000L + (i * 15000)
            )
        }

        // Consultar lote pendiente de sincronización
        val pendientes = repository.getPendingLocations(limit = 100)
        assertEquals(5, pendientes.size)

        // Confirmar sincronización en lote
        val ids = pendientes.map { it.id }
        val markResult = repository.markLocationsAsSynced(ids)
        assertTrue(markResult.isSuccess)

        val restantes = repository.getPendingLocations(limit = 100)
        assertEquals(0, restantes.size)
    }

    @Test
    fun testReactiveFlowsEmitUpdatedLocationCount() = runBlocking {
        val initialCount = repository.observeLocationCount(shiftId).first()
        assertEquals(0, initialCount)

        repository.recordLocation(
            shiftId = shiftId,
            latitud = -0.180653,
            longitud = -78.467834,
            precision = 4.0f
        )

        val updatedCount = repository.observeLocationCount(shiftId).first()
        assertEquals(1, updatedCount)
    }

    // --- FAKES PARA TEST UNITARIOS AISLADOS ---

    private class FakeUbicacionGpsDao : UbicacionGpsDao {
        private val list = CopyOnWriteArrayList<UbicacionGpsEntity>()
        private val countFlow = MutableStateFlow(0)
        private val lastLocFlow = MutableStateFlow<UbicacionGpsEntity?>(null)

        override suspend fun insert(ubicacion: UbicacionGpsEntity) {
            list.add(ubicacion)
            countFlow.value = list.count { it.jornadaId == ubicacion.jornadaId }
            lastLocFlow.value = ubicacion
        }

        override suspend fun insertAll(ubicaciones: List<UbicacionGpsEntity>) {
            list.addAll(ubicaciones)
            if (ubicaciones.isNotEmpty()) {
                val jId = ubicaciones.first().jornadaId
                countFlow.value = list.count { it.jornadaId == jId }
                lastLocFlow.value = ubicaciones.last()
            }
        }

        override suspend fun getById(id: String): UbicacionGpsEntity? = list.find { it.id == id }

        override fun observeUbicacionesPorJornada(jornadaId: String): Flow<List<UbicacionGpsEntity>> =
            MutableStateFlow(list.filter { it.jornadaId == jornadaId })

        override suspend fun getUbicacionesPorJornada(jornadaId: String): List<UbicacionGpsEntity> =
            list.filter { it.jornadaId == jornadaId }

        override fun observeUltimaUbicacion(jornadaId: String): Flow<UbicacionGpsEntity?> = lastLocFlow.asStateFlow()

        override suspend fun getUltimaUbicacion(jornadaId: String): UbicacionGpsEntity? =
            list.filter { it.jornadaId == jornadaId }.maxByOrNull { it.timestampCaptura }

        override fun observeTotalPuntosPorJornada(jornadaId: String): Flow<Int> = countFlow.asStateFlow()

        override suspend fun countPorJornada(jornadaId: String): Int = list.count { it.jornadaId == jornadaId }

        override suspend fun countTotal(): Int = list.size

        override suspend fun getPendientesSincronizacion(): List<UbicacionGpsEntity> =
            list.filter { !it.sincronizado }

        override suspend fun getPendientesSincronizacion(limite: Int): List<UbicacionGpsEntity> =
            list.filter { !it.sincronizado }.take(limite)

        override suspend fun getPendientesPorJornada(jornadaId: String): List<UbicacionGpsEntity> =
            list.filter { it.jornadaId == jornadaId && !it.sincronizado }

        override suspend fun getPendientesPorJornada(jornadaId: String, limite: Int): List<UbicacionGpsEntity> =
            list.filter { it.jornadaId == jornadaId && !it.sincronizado }.take(limite)

        override suspend fun marcarSincronizadas(ids: List<String>) {
            val toUpdate = list.filter { it.id in ids }
            toUpdate.forEach { item ->
                val index = list.indexOf(item)
                if (index != -1) {
                    list[index] = item.copy(sincronizado = true)
                }
            }
        }

        override suspend fun purgarSincronizadasAntiguas(umbralTimestamp: Long): Int {
            val toRemove = list.filter { it.sincronizado && it.timestampCaptura < umbralTimestamp }
            list.removeAll(toRemove)
            return toRemove.size
        }

        override suspend fun deletePorJornada(jornadaId: String) {
            list.removeAll { it.jornadaId == jornadaId }
        }
    }

    private class FakeBitacoraAuditoriaDao : BitacoraAuditoriaDao {
        private val list = CopyOnWriteArrayList<BitacoraAuditoriaEntity>()

        override suspend fun insert(evento: BitacoraAuditoriaEntity) {
            list.add(evento)
        }

        override suspend fun insertAll(eventos: List<BitacoraAuditoriaEntity>) {
            list.addAll(eventos)
        }

        override suspend fun getById(id: String): BitacoraAuditoriaEntity? = list.find { it.id == id }

        override suspend fun getUltimoEventoPorJornada(jornadaId: String): BitacoraAuditoriaEntity? =
            list.filter { it.jornadaId == jornadaId }.maxByOrNull { it.timestampEvento }

        override suspend fun getEventosPorJornada(jornadaId: String): List<BitacoraAuditoriaEntity> =
            list.filter { it.jornadaId == jornadaId }.sortedBy { it.timestampEvento }

        override fun observeEventosPorJornada(jornadaId: String): Flow<List<BitacoraAuditoriaEntity>> =
            MutableStateFlow(list.filter { it.jornadaId == jornadaId })

        override suspend fun getPendientesSincronizacion(): List<BitacoraAuditoriaEntity> =
            list.filter { !it.sincronizado }

        override suspend fun getPendientesSincronizacion(limite: Int): List<BitacoraAuditoriaEntity> =
            list.filter { !it.sincronizado }.take(limite)

        override suspend fun getPendientesPorJornada(jornadaId: String): List<BitacoraAuditoriaEntity> =
            list.filter { it.jornadaId == jornadaId && !it.sincronizado }

        override suspend fun getPendientesPorJornada(jornadaId: String, limite: Int): List<BitacoraAuditoriaEntity> =
            list.filter { it.jornadaId == jornadaId && !it.sincronizado }.take(limite)

        override suspend fun marcarSincronizados(ids: List<String>) {
            val toUpdate = list.filter { it.id in ids }
            toUpdate.forEach { item ->
                val index = list.indexOf(item)
                if (index != -1) {
                    list[index] = item.copy(sincronizado = true)
                }
            }
        }

        override suspend fun deletePorJornada(jornadaId: String) {
            list.removeAll { it.jornadaId == jornadaId }
        }
    }
}

