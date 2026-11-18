package com.empresa.routrack.data.repository

import com.empresa.routrack.data.local.dao.TextInteractionDao
import com.empresa.routrack.data.local.entity.TextInteractionEntity
import com.routrack.mobile.security.HmacChainSigner
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.util.UUID

/**
 * Contrato de repositorio para la persistencia y auditoría criptográfica
 * de las interacciones de texto corporativas.
 */
interface TextInteractionRepository {

    suspend fun recordTextInteraction(
        shiftId: String,
        vendedorId: String,
        packageName: String,
        appLabel: String?,
        text: String,
        timestamp: Long = System.currentTimeMillis()
    ): Result<TextInteractionEntity>

    fun observeInteraccionesPorJornada(shiftId: String): Flow<List<TextInteractionEntity>>

    suspend fun getInteraccionesPorJornada(shiftId: String): List<TextInteractionEntity>

    suspend fun getPendientesSincronizacion(limite: Int = 100): List<TextInteractionEntity>

    suspend fun marcarSincronizadas(ids: List<String>): Result<Unit>

    suspend fun countPorJornada(shiftId: String): Int
}

/**
 * Implementación oficial de TextInteractionRepository con encadenamiento HMAC-SHA256
 * y persistencia cifrada en SQLite mediante Room + SQLCipher.
 */
class TextInteractionRepositoryImpl(
    private val textInteractionDao: TextInteractionDao,
    private val secretKeyProvider: () -> ByteArray,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : TextInteractionRepository {

    private val chainMutex = Mutex()

    override suspend fun recordTextInteraction(
        shiftId: String,
        vendedorId: String,
        packageName: String,
        appLabel: String?,
        text: String,
        timestamp: Long
    ): Result<TextInteractionEntity> = withContext(ioDispatcher) {
        try {
            require(shiftId.isNotBlank()) { "shiftId no puede estar vacío" }
            require(vendedorId.isNotBlank()) { "vendedorId no puede estar vacío" }
            require(packageName.isNotBlank()) { "packageName no puede estar vacío" }
            require(text.isNotBlank()) { "text no puede estar vacío" }

            val secretKey = secretKeyProvider()
            val textId = UUID.randomUUID().toString()

            val entity = chainMutex.withLock {
                // Obtener el último hash de texto para esta jornada o generar la semilla inicial del turno
                val ultima = textInteractionDao.getUltimaInteraccionPorJornada(shiftId)
                val previousHash = ultima?.hmacHash
                    ?: HmacChainSigner.computeInitialSeed(shiftId, secretKey)

                val payload = HmacChainSigner.TextPayload(
                    shiftId = shiftId,
                    packageName = packageName,
                    timestamp = timestamp,
                    text = text
                )

                val hmacHash = HmacChainSigner.signText(
                    payload = payload,
                    previousHash = previousHash,
                    secretKey = secretKey
                )

                val textEntity = TextInteractionEntity(
                    id = textId,
                    jornadaId = shiftId,
                    vendedorId = vendedorId,
                    packageName = packageName,
                    appLabel = appLabel,
                    capturedText = text,
                    timestamp = timestamp,
                    previousHash = previousHash,
                    hmacHash = hmacHash,
                    sincronizado = false
                )

                textInteractionDao.insert(textEntity)
                textEntity
            }

            Result.success(entity)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun observeInteraccionesPorJornada(shiftId: String): Flow<List<TextInteractionEntity>> {
        return textInteractionDao.observeInteraccionesPorJornada(shiftId)
    }

    override suspend fun getInteraccionesPorJornada(shiftId: String): List<TextInteractionEntity> =
        withContext(ioDispatcher) {
            textInteractionDao.getInteraccionesPorJornada(shiftId)
        }

    override suspend fun getPendientesSincronizacion(limite: Int): List<TextInteractionEntity> =
        withContext(ioDispatcher) {
            textInteractionDao.getPendientesSincronizacion(limite)
        }

    override suspend fun marcarSincronizadas(ids: List<String>): Result<Unit> =
        withContext(ioDispatcher) {
            try {
                if (ids.isNotEmpty()) {
                    textInteractionDao.marcarSincronizadas(ids)
                }
                Result.success(Unit)
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    override suspend fun countPorJornada(shiftId: String): Int =
        withContext(ioDispatcher) {
            textInteractionDao.countPorJornada(shiftId)
        }
}
