package com.empresa.routrack.data.repository

import com.empresa.routrack.data.crypto.AuditChainManager
import com.empresa.routrack.data.local.dao.BitacoraAuditoriaDao
import com.empresa.routrack.data.local.dao.JornadaDao
import com.empresa.routrack.data.local.entity.BitacoraAuditoriaEntity
import com.empresa.routrack.data.local.entity.JornadaEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Pruebas unitarias para ShiftRepository.
 * Valida el ciclo de vida de los turnos, validación de jornadas simultáneas y sellado de auditoría.
 */
class ShiftRepositoryTest {

    private val secretKey = "TEST_SECRET_KEY_SHIFT_2026".toByteArray()
    private val sellerId = "vendedor-uuid-456"

    private lateinit var fakeJornadaDao: FakeJornadaDao
    private lateinit var fakeAuditoriaDao: FakeBitacoraAuditoriaDao
    private lateinit var repository: ShiftRepositoryImpl

    @Before
    fun setUp() {
        fakeJornadaDao = FakeJornadaDao()
        fakeAuditoriaDao = FakeBitacoraAuditoriaDao()
        repository = ShiftRepositoryImpl(
            jornadaDao = fakeJornadaDao,
            auditoriaDao = fakeAuditoriaDao,
            secretKeyProvider = { secretKey }
        )
    }

    @Test
    fun testStartShiftSuccessfullyCreatesActiveShiftAndAuditSeed() = runBlocking {
        val result = repository.startShift(sellerId)

        assertTrue("El inicio de turno debe ser exitoso", result.isSuccess)
        val jornada = result.getOrNull()
        assertNotNull(jornada)
        assertEquals(sellerId, jornada?.vendedorId)
        assertEquals(JornadaEntity.ESTADO_EN_CURSO, jornada?.estado)

        // Verificar jornada activa
        val activa = repository.getActiveShift()
        assertNotNull(activa)
        assertEquals(jornada?.id, activa?.id)

        // Verificar evento inicial en bitácora
        val eventos = fakeAuditoriaDao.getEventosPorJornada(jornada!!.id)
        assertEquals(1, eventos.size)
        assertEquals(BitacoraAuditoriaEntity.EVENTO_JORNADA_INICIADA, eventos.first().tipoEvento)

        val isValidChain = AuditChainManager.verifyChain(eventos, secretKey)
        assertTrue("La semilla inicial debe ser matemáticamente válida", isValidChain)
    }

    @Test
    fun testStartShiftFailsIfAlreadyAnActiveShiftExists() = runBlocking {
        val firstResult = repository.startShift(sellerId)
        assertTrue(firstResult.isSuccess)

        // Intento de iniciar segundo turno concurrente
        val secondResult = repository.startShift(sellerId)
        assertTrue("No debe permitir iniciar un segundo turno activo", secondResult.isFailure)
    }

    @Test
    fun testEndShiftSuccessfullyClosesShiftAndChainsFinalHash() = runBlocking {
        val startResult = repository.startShift(sellerId)
        val jornada = startResult.getOrNull()!!

        val endResult = repository.endShift(jornada.id, totalPoints = 42)
        assertTrue("La finalización debe ser exitosa", endResult.isSuccess)
        val cerrada = endResult.getOrNull()!!
        assertEquals(JornadaEntity.ESTADO_FINALIZADA, cerrada.estado)
        assertNotNull(cerrada.horaFin)

        // Verificar los dos eventos encadenados en bitácora
        val eventos = fakeAuditoriaDao.getEventosPorJornada(jornada.id)
        assertEquals(2, eventos.size)
        assertEquals(BitacoraAuditoriaEntity.EVENTO_JORNADA_INICIADA, eventos[0].tipoEvento)
        assertEquals(BitacoraAuditoriaEntity.EVENTO_JORNADA_FINALIZADA, eventos[1].tipoEvento)

        val isValidChain = AuditChainManager.verifyChain(eventos, secretKey)
        assertTrue("La cadena completa con inicio y cierre debe ser válida", isValidChain)
    }

    // --- FAKE DE JORNADA DAO ---

    private class FakeJornadaDao : JornadaDao {
        private val list = CopyOnWriteArrayList<JornadaEntity>()
        private val activeFlow = MutableStateFlow<JornadaEntity?>(null)

        override suspend fun insert(jornada: JornadaEntity) {
            list.add(jornada)
            if (jornada.estado == JornadaEntity.ESTADO_EN_CURSO) {
                activeFlow.value = jornada
            }
        }

        override suspend fun update(jornada: JornadaEntity) {
            val idx = list.indexOfFirst { it.id == jornada.id }
            if (idx != -1) {
                list[idx] = jornada
                if (jornada.estado != JornadaEntity.ESTADO_EN_CURSO && activeFlow.value?.id == jornada.id) {
                    activeFlow.value = null
                }
            }
        }

        override suspend fun getById(id: String): JornadaEntity? = list.find { it.id == id }

        override suspend fun getJornadaActiva(): JornadaEntity? =
            list.firstOrNull { it.estado == JornadaEntity.ESTADO_EN_CURSO }

        override fun observeJornadaActiva(): Flow<JornadaEntity?> = activeFlow.asStateFlow()

        override suspend fun getJornadasPendientesSincronizacion(): List<JornadaEntity> =
            list.filter { !it.sincronizado }

        override suspend fun getPendientesSincronizacion(limite: Int): List<JornadaEntity> =
            list.filter { !it.sincronizado }.take(limite)

        override suspend fun finalizarJornada(id: String, horaFin: String, estado: String) {
            val idx = list.indexOfFirst { it.id == id }
            if (idx != -1) {
                val updated = list[idx].copy(horaFin = horaFin, estado = estado)
                list[idx] = updated
                if (activeFlow.value?.id == id) {
                    activeFlow.value = null
                }
            }
        }

        override suspend fun marcarSincronizada(id: String) {
            val idx = list.indexOfFirst { it.id == id }
            if (idx != -1) {
                list[idx] = list[idx].copy(sincronizado = true)
            }
        }

        override suspend fun deleteById(id: String) {
            list.removeAll { it.id == id }
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

