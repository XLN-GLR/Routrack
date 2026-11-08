package com.empresa.routrack.data.crypto

import com.empresa.routrack.data.local.entity.BitacoraAuditoriaEntity
import com.routrack.mobile.security.HmacChainSigner
import java.nio.charset.StandardCharsets

/**
 * Gestor de la cadena de integridad criptográfica y custodia de auditoría (HMAC-SHA256).
 *
 * Integra y delega en HmacChainSigner como motor de bajo nivel para garantizar
 * el principio DRY y máxima interoperabilidad en el cliente Android.
 */
object AuditChainManager {

    private const val SEED_PREFIX = HmacChainSigner.SHIFT_INIT_PREFIX
    private const val CANONICAL_DELIMITER = HmacChainSigner.CANONICAL_DELIMITER

    /**
     * Calcula la semilla inicial (Hash_0) para una nueva jornada laboral.
     */
    fun calculateInitialHash(jornadaId: String, secretKey: ByteArray): String {
        return HmacChainSigner.computeInitialSeed(jornadaId, secretKey)
    }

    /**
     * Sobrecarga de conveniencia para clave secreta como String.
     */
    fun calculateInitialHash(jornadaId: String, secretKey: String): String {
        return HmacChainSigner.computeInitialSeed(jornadaId, secretKey)
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
        return HmacChainSigner.computeHmacSha256(canonicalMessage, secretKey)
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
}
