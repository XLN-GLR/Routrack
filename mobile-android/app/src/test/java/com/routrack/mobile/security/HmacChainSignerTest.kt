package com.routrack.mobile.security

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Suite de pruebas unitarias exhaustivas para HmacChainSigner (TASK-009).
 * Valida la reproducibilidad determinista, efecto avalancha y detección ineludible de manipulaciones.
 */
class HmacChainSignerTest {

    private val secretKey = "CLAVE_SECRETA_ROUTRACK_HMAC_TEST_2026".toByteArray()
    private val shiftId = "shift-uuid-abc-123"

    private lateinit var initialSeed: String

    @Before
    fun setUp() {
        initialSeed = HmacChainSigner.computeInitialSeed(shiftId, secretKey)
    }

    @Test
    fun testDeterministicAndReproducibleHmacGeneration() {
        val payload = "shiftId=shift-1|lat=-0.180653|lng=-78.467834|acc=4.5|ts=1700000000000"
        val prevHash = "0000000000000000000000000000000000000000000000000000000000000000"

        val hash1 = HmacChainSigner.signRaw(payload, prevHash, secretKey)
        val hash2 = HmacChainSigner.signRaw(payload, prevHash, secretKey)

        assertNotNull(hash1)
        assertEquals("El cómputo de HMAC debe ser estrictamente determinista y reproducible", hash1, hash2)
        assertEquals("El hash SHA-256 debe tener exactamente 64 caracteres hexadecimales", 64, hash1.length)
        assertTrue("El hash debe componerse únicamente de caracteres hexadecimales en minúsculas", hash1.matches(Regex("^[0-9a-f]{64}$")))
    }

    @Test
    fun testInitialSeedCalculationMatchesExpectedFormat() {
        assertNotNull(initialSeed)
        assertEquals(64, initialSeed.length)
        assertTrue(initialSeed.matches(Regex("^[0-9a-f]{64}$")))

        // Verificar que con otra jornada la semilla es completamente diferente
        val otherSeed = HmacChainSigner.computeInitialSeed("shift-uuid-xyz-789", secretKey)
        assertNotEquals("Semillas de turnos distintos deben ser distintas", initialSeed, otherSeed)
    }

    @Test
    fun testSequentialPointChainingSucceeds() {
        val points = listOf(
            HmacChainSigner.PointPayload(shiftId, -0.180653, -78.467834, 4.0f, 2850.0, 1.2f, 1700000000000L),
            HmacChainSigner.PointPayload(shiftId, -0.180700, -78.467900, 3.8f, 2851.0, 1.5f, 1700000015000L),
            HmacChainSigner.PointPayload(shiftId, -0.180750, -78.467950, 4.1f, 2852.0, 1.3f, 1700000030000L),
            HmacChainSigner.PointPayload(shiftId, -0.180800, -78.468000, 3.5f, 2853.0, 1.6f, 1700000045000L),
            HmacChainSigner.PointPayload(shiftId, -0.180850, -78.468050, 3.9f, 2854.0, 1.4f, 1700000060000L)
        )

        var prevHash = initialSeed
        val chain = mutableListOf<Pair<String, String>>()

        for (point in points) {
            val hash = HmacChainSigner.signPoint(point, prevHash, secretKey)
            chain.add(Pair(point.toCanonicalString(), hash))
            prevHash = hash
        }

        assertEquals(5, chain.size)
        val isValid = HmacChainSigner.verifyChain(chain, initialSeed, secretKey)
        assertTrue("La cadena legítima de 5 puntos debe superar la verificación", isValid)
    }

    @Test
    fun testTamperingWithSingleCoordinateInvalidatesChain() {
        val point1 = HmacChainSigner.PointPayload(shiftId, -0.180653, -78.467834, 4.0f, 2850.0, 1.2f, 1700000000000L)
        val point2 = HmacChainSigner.PointPayload(shiftId, -0.180700, -78.467900, 3.8f, 2851.0, 1.5f, 1700000015000L)

        val hash1 = HmacChainSigner.signPoint(point1, initialSeed, secretKey)
        val hash2 = HmacChainSigner.signPoint(point2, hash1, secretKey)

        // Intento de manipulación de latitud en el primer punto (-0.180653 -> -0.180654)
        val tamperedPoint1 = point1.copy(latitude = -0.180654)
        val tamperedChain = listOf(
            Pair(tamperedPoint1.toCanonicalString(), hash1),
            Pair(point2.toCanonicalString(), hash2)
        )

        val isValid = HmacChainSigner.verifyChain(tamperedChain, initialSeed, secretKey)
        assertFalse("Cualquier alteración en coordenadas debe invalidar la cadena", isValid)
    }

    @Test
    fun testTamperingWithTimestampInvalidatesChain() {
        val point = HmacChainSigner.PointPayload(shiftId, -0.180653, -78.467834, 4.0f, timestamp = 1700000000000L)
        val hash = HmacChainSigner.signPoint(point, initialSeed, secretKey)

        // Alteración de apenas 1 milisegundo en el timestamp
        val tamperedPoint = point.copy(timestamp = 1700000000001L)
        val isSignatureValid = HmacChainSigner.verifySignature(
            canonicalPayload = tamperedPoint.toCanonicalString(),
            previousHash = initialSeed,
            claimedHash = hash,
            secretKey = secretKey
        )

        assertFalse("Un desfase temporal de 1 ms debe romper la firma", isSignatureValid)
    }

    @Test
    fun testTamperingWithIsMockFlagInvalidatesChain() {
        val legitimatePoint = HmacChainSigner.PointPayload(
            shiftId = shiftId,
            latitude = -0.180653,
            longitude = -78.467834,
            accuracy = 4.0f,
            timestamp = 1700000000000L,
            isMock = false
        )
        val hash = HmacChainSigner.signPoint(legitimatePoint, initialSeed, secretKey)

        // Si se intenta enmascarar un mock point como legítimo
        val spoofedPoint = legitimatePoint.copy(isMock = true)
        val isSignatureValid = HmacChainSigner.verifySignature(
            canonicalPayload = spoofedPoint.toCanonicalString(),
            previousHash = initialSeed,
            claimedHash = hash,
            secretKey = secretKey
        )

        assertFalse("La alteración del flag isMock debe invalidar la firma", isSignatureValid)
    }

    @Test
    fun testTamperingWithPreviousHashBreaksContinuity() {
        val point1 = HmacChainSigner.PointPayload(shiftId, -0.180653, -78.467834, 4.0f, timestamp = 1700000000000L)
        val point2 = HmacChainSigner.PointPayload(shiftId, -0.180700, -78.467900, 3.8f, timestamp = 1700000015000L)

        val hash1 = HmacChainSigner.signPoint(point1, initialSeed, secretKey)
        val hash2 = HmacChainSigner.signPoint(point2, hash1, secretKey)

        // Reemplazar hash1 por un hash inventado en el eslabón 1
        val fakeHash1 = "1111111111111111111111111111111111111111111111111111111111111111"
        val brokenChain = listOf(
            Pair(point1.toCanonicalString(), fakeHash1),
            Pair(point2.toCanonicalString(), hash2)
        )

        val isValid = HmacChainSigner.verifyChain(brokenChain, initialSeed, secretKey)
        assertFalse("Inyectar un hash falso debe quebrar la verificación de la cadena", isValid)
    }

    @Test
    fun testDifferentSecretKeyFailsVerification() {
        val point = HmacChainSigner.PointPayload(shiftId, -0.180653, -78.467834, 4.0f, timestamp = 1700000000000L)
        val hash = HmacChainSigner.signPoint(point, initialSeed, secretKey)

        val wrongKey = "OTRA_CLAVE_DISTINTA_ROUTRACK_2026".toByteArray()
        val isSignatureValid = HmacChainSigner.verifySignature(
            canonicalPayload = point.toCanonicalString(),
            previousHash = initialSeed,
            claimedHash = hash,
            secretKey = wrongKey
        )

        assertFalse("La verificación con clave incorrecta debe ser rechazada", isSignatureValid)
    }

    @Test
    fun testEventPayloadChaining() {
        val event1 = HmacChainSigner.EventPayload(
            shiftId = shiftId,
            eventType = "JORNADA_INICIADA",
            timestamp = 1700000000000L,
            metadataJson = "{\"vendedor\":\"vend-1\"}"
        )
        val event2 = HmacChainSigner.EventPayload(
            shiftId = shiftId,
            eventType = "CHECK_IN_VISITA",
            timestamp = 1700000060000L,
            metadataJson = "{\"cliente\":\"cli-100\"}"
        )
        val event3 = HmacChainSigner.EventPayload(
            shiftId = shiftId,
            eventType = "JORNADA_FINALIZADA",
            timestamp = 1700000120000L,
            metadataJson = "{\"totalPuntos\":1}"
        )

        val h1 = HmacChainSigner.signEvent(event1, initialSeed, secretKey)
        val h2 = HmacChainSigner.signEvent(event2, h1, secretKey)
        val h3 = HmacChainSigner.signEvent(event3, h2, secretKey)

        val chain = listOf(
            Pair(event1.toCanonicalString(), h1),
            Pair(event2.toCanonicalString(), h2),
            Pair(event3.toCanonicalString(), h3)
        )

        assertTrue("La cadena de eventos heterogéneos debe verificarse legítimamente",
            HmacChainSigner.verifyChain(chain, initialSeed, secretKey)
        )
    }

    @Test
    fun testReorderingOrDroppingElementsFailsVerification() {
        val p1 = HmacChainSigner.PointPayload(shiftId, -0.180000, -78.460000, 4.0f, timestamp = 1700000000000L)
        val p2 = HmacChainSigner.PointPayload(shiftId, -0.180100, -78.460100, 4.0f, timestamp = 1700000015000L)
        val p3 = HmacChainSigner.PointPayload(shiftId, -0.180200, -78.460200, 4.0f, timestamp = 1700000030000L)

        val h1 = HmacChainSigner.signPoint(p1, initialSeed, secretKey)
        val h2 = HmacChainSigner.signPoint(p2, h1, secretKey)
        val h3 = HmacChainSigner.signPoint(p3, h2, secretKey)

        // Inversión de orden entre p2 y p3
        val invertedChain = listOf(
            Pair(p1.toCanonicalString(), h1),
            Pair(p3.toCanonicalString(), h3),
            Pair(p2.toCanonicalString(), h2)
        )
        assertFalse("El desorden temporal o espacial debe quebrar la verificación",
            HmacChainSigner.verifyChain(invertedChain, initialSeed, secretKey)
        )

        // Eliminación del eslabón intermedio (drop p2)
        val droppedChain = listOf(
            Pair(p1.toCanonicalString(), h1),
            Pair(p3.toCanonicalString(), h3)
        )
        assertFalse("La eliminación de un eslabón debe quebrar la verificación",
            HmacChainSigner.verifyChain(droppedChain, initialSeed, secretKey)
        )
    }
}

