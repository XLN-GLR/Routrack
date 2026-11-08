package com.routrack.mobile.security

import java.nio.charset.StandardCharsets
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Componente criptográfico especializado para el cálculo y verificación de firmas
 * HMAC-SHA256 encadenadas (Hash Chaining / Cadena de Custodia Inmutable).
 *
 * Especificación Matemática (docs/SECURITY.md § 6):
 * 1. Semilla de Turno:
 *    Hash_0 = HMAC-SHA256("ROUTRACK-SHIFT-INIT|" + ShiftID, SecretKey)
 * 2. Encadenamiento Secuencial (n >= 1):
 *    Hash_n = HMAC-SHA256(Payload_n + "|" + Hash_{n-1}, SecretKey)
 *
 * Garantiza:
 * - Generación determinista y reproducible de firmas de 64 caracteres hexadecimales.
 * - Resistencia a inyección retrospectiva y adulteración de coordenadas o timestamps.
 */
object HmacChainSigner {

    const val HMAC_SHA256_ALGORITHM = "HmacSHA256"
    const val SHIFT_INIT_PREFIX = "ROUTRACK-SHIFT-INIT|"
    const val CANONICAL_DELIMITER = "|"

    /**
     * Modelo inmutable para el payload de un punto de telemetría GPS antes de ser firmado.
     */
    data class PointPayload(
        val shiftId: String,
        val latitude: Double,
        val longitude: Double,
        val accuracy: Float,
        val altitude: Double? = null,
        val speed: Float? = null,
        val timestamp: Long,
        val isMock: Boolean = false
    ) {
        /**
         * Serialización canónica determinista libre de variaciones de espaciado o formato JSON.
         */
        fun toCanonicalString(): String {
            return buildString {
                append("shiftId=").append(shiftId.trim())
                append(CANONICAL_DELIMITER).append("lat=").append(latitude)
                append(CANONICAL_DELIMITER).append("lng=").append(longitude)
                append(CANONICAL_DELIMITER).append("acc=").append(accuracy)
                append(CANONICAL_DELIMITER).append("alt=").append(altitude ?: "null")
                append(CANONICAL_DELIMITER).append("spd=").append(speed ?: "null")
                append(CANONICAL_DELIMITER).append("ts=").append(timestamp)
                append(CANONICAL_DELIMITER).append("mock=").append(isMock)
            }
        }
    }

    /**
     * Modelo inmutable para un evento general de jornada o visita comercial.
     */
    data class EventPayload(
        val shiftId: String,
        val eventType: String,
        val timestamp: Long,
        val metadataJson: String
    ) {
        fun toCanonicalString(): String {
            return buildString {
                append("shiftId=").append(shiftId.trim())
                append(CANONICAL_DELIMITER).append("type=").append(eventType.trim())
                append(CANONICAL_DELIMITER).append("ts=").append(timestamp)
                append(CANONICAL_DELIMITER).append("meta=").append(metadataJson.trim())
            }
        }
    }

    /**
     * Calcula la semilla inicial del turno (Hash_0).
     */
    fun computeInitialSeed(shiftId: String, secretKey: ByteArray): String {
        require(shiftId.isNotBlank()) { "shiftId no puede ser vacío" }
        require(secretKey.isNotEmpty()) { "secretKey no puede ser vacía" }
        val message = "$SHIFT_INIT_PREFIX$shiftId"
        return computeHmacSha256(message, secretKey)
    }

    /**
     * Sobrecarga de computeInitialSeed con clave en String UTF-8.
     */
    fun computeInitialSeed(shiftId: String, secretKey: String): String {
        return computeInitialSeed(shiftId, secretKey.toByteArray(StandardCharsets.UTF_8))
    }

    /**
     * Calcula el hash encadenado (Hash_n) para un punto de telemetría GPS.
     */
    fun signPoint(
        payload: PointPayload,
        previousHash: String,
        secretKey: ByteArray
    ): String {
        return signRaw(payload.toCanonicalString(), previousHash, secretKey)
    }

    /**
     * Calcula el hash encadenado (Hash_n) para un evento general.
     */
    fun signEvent(
        payload: EventPayload,
        previousHash: String,
        secretKey: ByteArray
    ): String {
        return signRaw(payload.toCanonicalString(), previousHash, secretKey)
    }

    /**
     * Calcula el hash HMAC-SHA256 encadenado sobre un payload canónico arbitrario.
     * Formula: HMAC-SHA256(canonicalPayload + "|" + previousHash, secretKey)
     */
    fun signRaw(
        canonicalPayload: String,
        previousHash: String,
        secretKey: ByteArray
    ): String {
        require(canonicalPayload.isNotBlank()) { "canonicalPayload no puede ser vacío" }
        require(previousHash.isNotBlank()) { "previousHash no puede ser vacío" }
        require(secretKey.isNotEmpty()) { "secretKey no puede ser vacía" }

        val message = "$canonicalPayload$CANONICAL_DELIMITER$previousHash"
        return computeHmacSha256(message, secretKey)
    }

    /**
     * Sobrecarga de signRaw con clave String.
     */
    fun signRaw(
        canonicalPayload: String,
        previousHash: String,
        secretKey: String
    ): String {
        return signRaw(canonicalPayload, previousHash, secretKey.toByteArray(StandardCharsets.UTF_8))
    }

    /**
     * Verifica individualmente si un hash coincide con el cálculo esperado para su payload y hash previo.
     */
    fun verifySignature(
        canonicalPayload: String,
        previousHash: String,
        claimedHash: String,
        secretKey: ByteArray
    ): Boolean {
        if (claimedHash.isBlank() || previousHash.isBlank() || canonicalPayload.isBlank()) {
            return false
        }
        val expected = signRaw(canonicalPayload, previousHash, secretKey)
        return slowEquals(expected, claimedHash)
    }

    /**
     * Verifica la validez estricta de una cadena completa de hashes encadenados.
     * Retorna true únicamente si todos los eslabones son matemáticamente legítimos y continuos.
     */
    fun verifyChain(
        elements: List<Pair<String, String>>, // Lista de pares (canonicalPayload, currentHash)
        initialSeed: String,
        secretKey: ByteArray
    ): Boolean {
        if (elements.isEmpty()) return true

        var expectedPrev = initialSeed
        for ((payload, currentHash) in elements) {
            val recalculated = signRaw(payload, expectedPrev, secretKey)
            if (!slowEquals(recalculated, currentHash)) {
                return false
            }
            expectedPrev = currentHash
        }
        return true
    }

    /**
     * Realiza el cómputo de bajo nivel de HMAC-SHA256.
     */
    fun computeHmacSha256(data: String, key: ByteArray): String {
        val mac = Mac.getInstance(HMAC_SHA256_ALGORITHM)
        val keySpec = SecretKeySpec(key, HMAC_SHA256_ALGORITHM)
        mac.init(keySpec)
        val rawHmac = mac.doFinal(data.toByteArray(StandardCharsets.UTF_8))
        return bytesToHex(rawHmac)
    }

    /**
     * Comparación segura en tiempo constante para mitigar ataques de temporización (timing attacks).
     */
    private fun slowEquals(a: String, b: String): Boolean {
        val aBytes = a.lowercase().toByteArray(StandardCharsets.UTF_8)
        val bBytes = b.lowercase().toByteArray(StandardCharsets.UTF_8)
        var diff = aBytes.size xor bBytes.size
        for (i in 0 until minOf(aBytes.size, bBytes.size)) {
            diff = diff or (aBytes[i].toInt() xor bBytes[i].toInt())
        }
        return diff == 0
    }

    private fun bytesToHex(bytes: ByteArray): String {
        val hexChars = CharArray(bytes.size * 2)
        val hexArray = "0123456789abcdef".toCharArray()
        for (i in bytes.indices) {
            val v = bytes[i].toInt() and 0xFF
            hexChars[i * 2] = hexArray[v ushr 4]
            hexChars[i * 2 + 1] = hexArray[v and 0x0F]
        }
        return String(hexChars)
    }
}

