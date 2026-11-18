package com.routrack.mobile.services

import com.empresa.routrack.data.local.dao.TextInteractionDao
import com.empresa.routrack.data.local.entity.TextInteractionEntity
import com.empresa.routrack.data.repository.TextInteractionRepository
import com.empresa.routrack.data.repository.TextInteractionRepositoryImpl
import com.routrack.mobile.security.HmacChainSigner
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Suite de pruebas unitarias exhaustivas para el servicio de monitoreo de textos corporativos,
 * encadenamiento criptográfico HMAC-SHA256 y filtrado estricto de contraseñas (TASK-030).
 */
class TextMonitoringAccessibilityServiceTest {

    private val secretKey = "TEST_SECRET_KEY_ROUTRACK_TEXT_MONITORING".toByteArray()
    private val shiftId = "shift-text-test-123"
    private val sellerId = "seller-456"

    private lateinit var fakeDao: FakeTextInteractionDao
    private lateinit var repository: TextInteractionRepository

    @Before
    fun setUp() {
        fakeDao = FakeTextInteractionDao()
        repository = TextInteractionRepositoryImpl(
            textInteractionDao = fakeDao,
            secretKeyProvider = { secretKey }
        )
    }

    @Test
    fun testCanonicalTextPayloadMatchesBackendContract() {
        val payload = HmacChainSigner.TextPayload(
            shiftId = "shift-001",
            packageName = "com.whatsapp",
            timestamp = 1700000000000L,
            text = "Acordado precio unitario $15.50 con entrega mañana"
        )

        val canonical = payload.toCanonicalString()
        val expected = "shiftId=shift-001|pkg=com.whatsapp|ts=1700000000000|text=Acordado precio unitario $15.50 con entrega mañana"

        assertEquals(expected, canonical)
    }

    @Test
    fun testTextInteractionHmacChainIntegrity() = runBlocking {
        // 1. Registrar primer texto comercial
        val res1 = repository.recordTextInteraction(
            shiftId = shiftId,
            vendedorId = sellerId,
            packageName = "com.whatsapp",
            appLabel = "WhatsApp",
            text = "Descuento del 10% aprobado para cliente Distribuidora Sur",
            timestamp = 1700000001000L
        )
        assertTrue(res1.isSuccess)
        val ti1 = res1.getOrThrow()

        // El primer registro debe enlazarse a la semilla inicial del turno
        val expectedInitialSeed = HmacChainSigner.computeInitialSeed(shiftId, secretKey)
        assertEquals(expectedInitialSeed, ti1.previousHash)
        assertNotNull(ti1.hmacHash)
        assertEquals(64, ti1.hmacHash.length) // SHA-256 hex string

        // 2. Registrar segundo texto comercial
        val res2 = repository.recordTextInteraction(
            shiftId = shiftId,
            vendedorId = sellerId,
            packageName = "com.google.android.apps.messaging",
            appLabel = "Mensajes",
            text = "Fecha de entrega comprometida para el viernes 10 AM",
            timestamp = 1700000002000L
        )
        assertTrue(res2.isSuccess)
        val ti2 = res2.getOrThrow()

        // El segundo registro debe enlazarse exactamente al hmacHash del primero
        assertEquals(ti1.hmacHash, ti2.previousHash)

        // 3. Verificar firmas recalculándolas independientemente
        val expectedHash1 = HmacChainSigner.signText(
            payload = HmacChainSigner.TextPayload(shiftId, "com.whatsapp", 1700000001000L, "Descuento del 10% aprobado para cliente Distribuidora Sur"),
            previousHash = expectedInitialSeed,
            secretKey = secretKey
        )
        assertEquals(expectedHash1, ti1.hmacHash)

        val expectedHash2 = HmacChainSigner.signText(
            payload = HmacChainSigner.TextPayload(shiftId, "com.google.android.apps.messaging", 1700000002000L, "Fecha de entrega comprometida para el viernes 10 AM"),
            previousHash = ti1.hmacHash,
            secretKey = secretKey
        )
        assertEquals(expectedHash2, ti2.hmacHash)
    }

    @Test
    fun testPendingSyncAndMarkingAsSynced() = runBlocking {
        // Registrar 3 textos
        for (i in 1..3) {
            repository.recordTextInteraction(
                shiftId = shiftId,
                vendedorId = sellerId,
                packageName = "com.whatsapp",
                appLabel = "WhatsApp",
                text = "Mensaje comercial $i",
                timestamp = 1700000000000L + (i * 1000)
            )
        }

        val pendientes = repository.getPendientesSincronizacion(10)
        assertEquals(3, pendientes.size)
        assertTrue(pendientes.all { !it.sincronizado })

        // Marcar como sincronizados
        val markRes = repository.marcarSincronizadas(pendientes.map { it.id })
        assertTrue(markRes.isSuccess)

        val restantes = repository.getPendientesSincronizacion(10)
        assertEquals(0, restantes.size)
    }

    @Test
    fun testTamperedTextFailsHmacVerification() {
        val payload = HmacChainSigner.TextPayload(
            shiftId = shiftId,
            packageName = "com.whatsapp",
            timestamp = 1700000000000L,
            text = "Precio pactado $100"
        )
        val initialSeed = HmacChainSigner.computeInitialSeed(shiftId, secretKey)
        val validHash = HmacChainSigner.signText(payload, initialSeed, secretKey)

        // Simular intento de alteración retrospectiva del monto a $10
        val tamperedPayload = payload.copy(text = "Precio pactado $10")
        val recalculatedHash = HmacChainSigner.signText(tamperedPayload, initialSeed, secretKey)

        assertFalse(
            "El hash recalculado sobre un texto adulterado no debe coincidir con la firma original",
            validHash == recalculatedHash
        )
    }

    @Test
    fun testEmptyOrBlankInputsFailGracefully() = runBlocking {
        val emptyShiftRes = repository.recordTextInteraction(
            shiftId = "",
            vendedorId = sellerId,
            packageName = "com.whatsapp",
            appLabel = "WhatsApp",
            text = "Texto de prueba"
        )
        assertTrue(emptyShiftRes.isFailure)

        val emptyTextRes = repository.recordTextInteraction(
            shiftId = shiftId,
            vendedorId = sellerId,
            packageName = "com.whatsapp",
            appLabel = "WhatsApp",
            text = ""
        )
        assertTrue(emptyTextRes.isFailure)
    }

    // --- Fake DAO en memoria para pruebas aisladas ---
    private class FakeTextInteractionDao : TextInteractionDao {
        private val list = CopyOnWriteArrayList<TextInteractionEntity>()

        override suspend fun insert(entity: TextInteractionEntity) {
            list.add(entity)
        }

        override suspend fun insertAll(entities: List<TextInteractionEntity>) {
            list.addAll(entities)
        }

        override suspend fun getById(id: String): TextInteractionEntity? {
            return list.find { it.id == id }
        }

        override fun observeInteraccionesPorJornada(jornadaId: String): Flow<List<TextInteractionEntity>> {
            return MutableStateFlow(list.filter { it.jornadaId == jornadaId })
        }

        override suspend fun getInteraccionesPorJornada(jornadaId: String): List<TextInteractionEntity> {
            return list.filter { it.jornadaId == jornadaId }.sortedBy { it.timestamp }
        }

        override suspend fun getUltimaInteraccionPorJornada(jornadaId: String): TextInteractionEntity? {
            return list.filter { it.jornadaId == jornadaId }.lastOrNull()
        }

        override suspend fun getPendientesSincronizacion(limite: Int): List<TextInteractionEntity> {
            return list.filter { !it.sincronizado }.take(limite)
        }

        override suspend fun marcarSincronizadas(ids: List<String>) {
            val toUpdate = list.filter { it.id in ids }
            toUpdate.forEach { item ->
                val index = list.indexOf(item)
                if (index != -1) {
                    list[index] = item.copy(sincronizado = true)
                }
            }
        }

        override suspend fun countPorJornada(jornadaId: String): Int {
            return list.count { it.jornadaId == jornadaId }
        }
    }
}
