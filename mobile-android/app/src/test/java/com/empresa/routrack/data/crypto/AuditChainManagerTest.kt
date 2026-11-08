package com.empresa.routrack.data.crypto

import com.empresa.routrack.data.local.entity.BitacoraAuditoriaEntity
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.UUID

/**
 * Pruebas unitarias para validar la integridad matemática de AuditChainManager.
 * Verifica el encadenamiento determinista HMAC-SHA256 y la detección fehaciente de adulteraciones.
 */
class AuditChainManagerTest {

    private val secretKey = "ROUTRACK_AUDIT_SECRET_KEY_TEST_2026"
    private val jornadaId = "jornada-test-uuid-12345"

    @Test
    fun testAuditChainWithThreeConsecutiveEventsSucceeds() {
        val seedHash = AuditChainManager.calculateInitialHash(jornadaId, secretKey)
        assertNotNull(seedHash)
        assertTrue(seedHash.length == 64)

        // Evento 1: Inicio de Jornada
        val t1 = 1700000000000L
        val meta1 = "{\"vendedorId\":\"vend-01\",\"inicio\":\"08:00:00\"}"
        val h1 = AuditChainManager.calculateHash(
            tipoEvento = BitacoraAuditoriaEntity.EVENTO_JORNADA_INICIADA,
            timestampEvento = t1,
            metadataJson = meta1,
            hashPrevio = seedHash,
            secretKey = secretKey
        )
        val event1 = BitacoraAuditoriaEntity(
            id = UUID.randomUUID().toString(),
            jornadaId = jornadaId,
            tipoEvento = BitacoraAuditoriaEntity.EVENTO_JORNADA_INICIADA,
            metadataJson = meta1,
            timestampEvento = t1,
            hashPrevio = seedHash,
            hashActual = h1
        )

        // Evento 2: Captura GPS
        val t2 = 1700000015000L
        val meta2 = "{\"lat\":-0.180653,\"lng\":-78.467834,\"accuracy\":4.5}"
        val h2 = AuditChainManager.calculateHash(
            tipoEvento = BitacoraAuditoriaEntity.EVENTO_CAPTURA_GPS,
            timestampEvento = t2,
            metadataJson = meta2,
            hashPrevio = h1,
            secretKey = secretKey
        )
        val event2 = BitacoraAuditoriaEntity(
            id = UUID.randomUUID().toString(),
            jornadaId = jornadaId,
            tipoEvento = BitacoraAuditoriaEntity.EVENTO_CAPTURA_GPS,
            metadataJson = meta2,
            timestampEvento = t2,
            hashPrevio = h1,
            hashActual = h2
        )

        // Evento 3: Fin de Jornada
        val t3 = 1700000030000L
        val meta3 = "{\"horaFin\":\"17:30:00\",\"totalPuntos\":1}"
        val h3 = AuditChainManager.calculateHash(
            tipoEvento = BitacoraAuditoriaEntity.EVENTO_JORNADA_FINALIZADA,
            timestampEvento = t3,
            metadataJson = meta3,
            hashPrevio = h2,
            secretKey = secretKey
        )
        val event3 = BitacoraAuditoriaEntity(
            id = UUID.randomUUID().toString(),
            jornadaId = jornadaId,
            tipoEvento = BitacoraAuditoriaEntity.EVENTO_JORNADA_FINALIZADA,
            metadataJson = meta3,
            timestampEvento = t3,
            hashPrevio = h2,
            hashActual = h3
        )

        val chain = listOf(event1, event2, event3)

        // Validar la cadena completa
        val isValid = AuditChainManager.verifyChain(chain, secretKey)
        assertTrue("La cadena legítima de 3 eventos debe ser matemáticamente válida", isValid)
    }

    @Test
    fun testTamperedPayloadFailsVerification() {
        val seedHash = AuditChainManager.calculateInitialHash(jornadaId, secretKey)

        val t1 = 1700000000000L
        val meta1 = "{\"lat\":-0.180000,\"lng\":-78.460000}"
        val h1 = AuditChainManager.calculateHash(
            tipoEvento = BitacoraAuditoriaEntity.EVENTO_CAPTURA_GPS,
            timestampEvento = t1,
            metadataJson = meta1,
            hashPrevio = seedHash,
            secretKey = secretKey
        )
        val event1 = BitacoraAuditoriaEntity(
            id = UUID.randomUUID().toString(),
            jornadaId = jornadaId,
            tipoEvento = BitacoraAuditoriaEntity.EVENTO_CAPTURA_GPS,
            metadataJson = meta1,
            timestampEvento = t1,
            hashPrevio = seedHash,
            hashActual = h1
        )

        val t2 = 1700000015000L
        val meta2 = "{\"lat\":-0.181000,\"lng\":-78.461000}"
        val h2 = AuditChainManager.calculateHash(
            tipoEvento = BitacoraAuditoriaEntity.EVENTO_CAPTURA_GPS,
            timestampEvento = t2,
            metadataJson = meta2,
            hashPrevio = h1,
            secretKey = secretKey
        )
        val event2 = BitacoraAuditoriaEntity(
            id = UUID.randomUUID().toString(),
            jornadaId = jornadaId,
            tipoEvento = BitacoraAuditoriaEntity.EVENTO_CAPTURA_GPS,
            metadataJson = meta2,
            timestampEvento = t2,
            hashPrevio = h1,
            hashActual = h2
        )

        // Adulterar maliciosamente la coordenada en el evento 2 sin recalcular hash
        val tamperedEvent2 = event2.copy(
            metadataJson = "{\"lat\":-0.199999,\"lng\":-78.461000}"
        )

        val tamperedChain = listOf(event1, tamperedEvent2)
        val isValid = AuditChainManager.verifyChain(tamperedChain, secretKey)

        assertFalse("La alteración de coordenadas debe invalidar la verificación de la cadena", isValid)
    }

    @Test
    fun testTamperedTimestampFailsVerification() {
        val seedHash = AuditChainManager.calculateInitialHash(jornadaId, secretKey)

        val t1 = 1700000000000L
        val meta1 = "{\"evento\":\"test\"}"
        val h1 = AuditChainManager.calculateHash(
            tipoEvento = BitacoraAuditoriaEntity.EVENTO_SERVICE_STARTED,
            timestampEvento = t1,
            metadataJson = meta1,
            hashPrevio = seedHash,
            secretKey = secretKey
        )
        val event1 = BitacoraAuditoriaEntity(
            id = UUID.randomUUID().toString(),
            jornadaId = jornadaId,
            tipoEvento = BitacoraAuditoriaEntity.EVENTO_SERVICE_STARTED,
            metadataJson = meta1,
            timestampEvento = t1,
            hashPrevio = seedHash,
            hashActual = h1
        )

        // Adulterar el timestamp
        val tamperedEvent1 = event1.copy(timestampEvento = t1 + 5000L)

        val isValid = AuditChainManager.verifyChain(listOf(tamperedEvent1), secretKey)
        assertFalse("La alteración del timestamp debe invalidar el hash de auditoría", isValid)
    }

    @Test
    fun testBrokenChainLinkFailsVerification() {
        val seedHash = AuditChainManager.calculateInitialHash(jornadaId, secretKey)

        val t1 = 1700000000000L
        val meta1 = "{\"step\":1}"
        val h1 = AuditChainManager.calculateHash(
            tipoEvento = BitacoraAuditoriaEntity.EVENTO_SERVICE_STARTED,
            timestampEvento = t1,
            metadataJson = meta1,
            hashPrevio = seedHash,
            secretKey = secretKey
        )
        val event1 = BitacoraAuditoriaEntity(
            id = UUID.randomUUID().toString(),
            jornadaId = jornadaId,
            tipoEvento = BitacoraAuditoriaEntity.EVENTO_SERVICE_STARTED,
            metadataJson = meta1,
            timestampEvento = t1,
            hashPrevio = seedHash,
            hashActual = h1
        )

        val t2 = 1700000015000L
        val meta2 = "{\"step\":2}"
        val fakePrevHash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        val h2 = AuditChainManager.calculateHash(
            tipoEvento = BitacoraAuditoriaEntity.EVENTO_SERVICE_STOPPED,
            timestampEvento = t2,
            metadataJson = meta2,
            hashPrevio = fakePrevHash,
            secretKey = secretKey
        )
        val event2 = BitacoraAuditoriaEntity(
            id = UUID.randomUUID().toString(),
            jornadaId = jornadaId,
            tipoEvento = BitacoraAuditoriaEntity.EVENTO_SERVICE_STOPPED,
            metadataJson = meta2,
            timestampEvento = t2,
            hashPrevio = fakePrevHash,
            hashActual = h2
        )

        val brokenChain = listOf(event1, event2)
        val isValid = AuditChainManager.verifyChain(brokenChain, secretKey)

        assertFalse("Una discontinuidad entre hashActual y hashPrevio debe fallar la verificación", isValid)
    }
}
