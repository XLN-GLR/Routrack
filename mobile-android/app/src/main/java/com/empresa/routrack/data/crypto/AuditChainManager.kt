package com.empresa.routrack.data.crypto

import com.empresa.routrack.data.local.entity.BitacoraAuditoriaEntity
import java.nio.charset.StandardCharsets
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Gestor de la cadena de integridad criptográfica y custodia de auditoría (HMAC-SHA256).
 *
 * Implementa el algoritmo de encadenamiento especificado en docs/SECURITY.md:
 * Hash_0 = HMAC-SHA256("ROUTRACK-SHIFT-INIT|" + ShiftID, SecretKey)
 * Hash_actual = HMAC-SHA256(Evento + "|" + Timestamp + "|" + Payload + "|" + Hash_previo, SecretKey)
 *
 * Garantiza la inmutabilidad y orden estricto de eventos de jornada antes de su sincronización.
 */
object AuditChainManager {

    private const val HMAC_SHA256_ALGORITHM = "HmacSHA256"
    private const val SEED_PREFIX = "ROUTRACK-SHIFT-INIT|"
    private const val CANONICAL_DELIMITER = "|"

    /**
     * Calcula la semilla inicial (Hash_0) para una nueva jornada laboral.
     */
    fun calculateInitialHash(jornadaId: String, secretKey: ByteArray): String {
        val seedMessage = "$SEED_PREFIX$jornadaId"
        return computeHmacSha256(seedMessage, secretKey)
    }

    /**
     * Sobrecarga de conveniencia para clave secreta como String.
     */
    fun calculateInitialHash(jornadaId: String, secretKey: String): String {
        return calculateInitialHash(jornadaId, secretKey.toByteArray(StandardCharsets.UTF_8))
    }

    /**
     * Calcula el hash encadenado determinista para un evento de auditoría.
     * Formato canónico: Evento|Timestamp|MetadataJson|Hash_previo
     */
    fun calculateHash(
        tipoEvento: String,
        timestampEvento: Long,
        metadataJson: String,
        hashPrevio: String,
        secretKey: ByteArray
    ): String {
        val canonicalMessage = buildCanonicalPayload(
            tipoEvento = tipoEvento,
            timestampEvento = timestampEvento,
            metadataJson = metadataJson,
            hashPrevio = hashPrevio
        )
        return computeHmacSha256(canonicalMessage, secretKey)
    }

    /**
     * Sobrecarga de conveniencia para clave secreta como String.
     */
    fun calculateHash(
        tipoEvento: String,
        timestampEvento: Long,
        metadataJson: String,
        hashPrevio: String,
        secretKey: String
    ): String {
        return calculateHash(
            tipoEvento = tipoEvento,
            timestampEvento = timestampEvento,
            metadataJson = metadataJson,
            hashPrevio = hashPrevio,
            secretKey = secretKey.toByteArray(StandardCharsets.UTF_8)
        )
    }

    /**
     * Construye la representación canónica estandarizada del payload para el cálculo del hash.
     */
    fun buildCanonicalPayload(
        tipoEvento: String,
        timestampEvento: Long,
        metadataJson: String,
        hashPrevio: String
    ): String {
        return buildString {
            append(tipoEvento.trim())
            append(CANONICAL_DELIMITER)
            append(timestampEvento)
            append(CANONICAL_DELIMITER)
            append(metadataJson.trim())
            append(CANONICAL_DELIMITER)
            append(hashPrevio.trim())
        }
    }

    /**
     * Verifica la integridad individual de un registro de auditoría calculando su hash esperado.
     */
    fun verifyRecord(record: BitacoraAuditoriaEntity, secretKey: ByteArray): Boolean {
        val expectedHash = calculateHash(
            tipoEvento = record.tipoEvento,
            timestampEvento = record.timestampEvento,
            metadataJson = record.metadataJson,
            hashPrevio = record.hashPrevio,
            secretKey = secretKey
        )
        return expectedHash.equals(record.hashActual, ignoreCase = true)
    }

    /**
     * Verifica la integridad integral de una secuencia cronológica de registros de auditoría.
     * Valida que:
     * 1. Cada registro calcule exactamente su hashActual con sus datos y su hashPrevio.
     * 2. El hashPrevio del registro n coincida fielmente con el hashActual del registro n-1.
     * Si cualquier campo o el orden fueron adulterados, retorna false.
     */
    fun verifyChain(records: List<BitacoraAuditoriaEntity>, secretKey: ByteArray): Boolean {
        if (records.isEmpty()) return true

        for (i in records.indices) {
            val currentRecord = records[i]

            // 1. Validar que el hash actual coincida con el cálculo canónico
            if (!verifyRecord(currentRecord, secretKey)) {
                return false
            }

            // 2. Para registros posteriores al inicial, verificar continuidad de enlace
            if (i > 0) {
                val previousRecord = records[i - 1]
                if (!currentRecord.hashPrevio.equals(previousRecord.hashActual, ignoreCase = true)) {
                    return false
                }
            }
        }
        return true
    }

    /**
     * Sobrecarga de conveniencia para verifyChain con clave en formato String.
     */
    fun verifyChain(records: List<BitacoraAuditoriaEntity>, secretKey: String): Boolean {
        return verifyChain(records, secretKey.toByteArray(StandardCharsets.UTF_8))
    }

    /**
     * Recalcula la cadena completa a partir de una lista ordenada de registros y un hash inicial.
     * Útil para contrastar discrepancias o reconstruir estados locales corruptos.
     */
    fun recalculateChain(
        records: List<BitacoraAuditoriaEntity>,
        initialHash: String,
        secretKey: ByteArray
    ): List<BitacoraAuditoriaEntity> {
        var currentPrevHash = initialHash
        return records.map { record ->
            val recalculatedHash = calculateHash(
                tipoEvento = record.tipoEvento,
                timestampEvento = record.timestampEvento,
                metadataJson = record.metadataJson,
                hashPrevio = currentPrevHash,
                secretKey = secretKey
            )
            val updatedRecord = record.copy(
                hashPrevio = currentPrevHash,
                hashActual = recalculatedHash
            )
            currentPrevHash = recalculatedHash
            updatedRecord
        }
    }

    /**
     * Realiza el cómputo criptográfico HMAC-SHA256 retornando una representación hexadecimal en minúsculas.
     */
    private fun computeHmacSha256(data: String, key: ByteArray): String {
        val mac = Mac.getInstance(HMAC_SHA256_ALGORITHM)
        val secretKeySpec = SecretKeySpec(key, HMAC_SHA256_ALGORITHM)
        mac.init(secretKeySpec)
        val rawHmac = mac.doFinal(data.toByteArray(StandardCharsets.UTF_8))
        return bytesToHex(rawHmac)
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
