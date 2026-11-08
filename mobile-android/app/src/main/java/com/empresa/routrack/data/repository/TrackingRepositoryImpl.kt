package com.empresa.routrack.data.repository

import com.empresa.routrack.data.crypto.AuditChainManager
import com.empresa.routrack.data.local.dao.BitacoraAuditoriaDao
import com.empresa.routrack.data.local.dao.UbicacionGpsDao
import com.empresa.routrack.data.local.entity.BitacoraAuditoriaEntity
import com.empresa.routrack.data.local.entity.UbicacionGpsEntity
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.util.UUID

/**
 * Implementación de TrackingRepository para la orquestación atómica de telemetría y auditoría.
 *
 * Utiliza un Mutex de corrutinas para serializar el cálculo del encadenamiento criptográfico HMAC,
 * erradicando condiciones de carrera e inconsistencias en la cadena de custodia bajo alta concurrencia.
 */
class TrackingRepositoryImpl(
    private val ubicacionDao: UbicacionGpsDao,
    private val auditoriaDao: BitacoraAuditoriaDao,
    private val secretKeyProvider: () -> ByteArray,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : TrackingRepository {

    // Candado para garantizar estricta secuencialidad e inmutabilidad en la cadena de auditoría HMAC
    private val auditChainMutex = Mutex()

    override fun observeLastLocation(shiftId: String): Flow<UbicacionGpsEntity?> {
        return ubicacionDao.observeUltimaUbicacion(shiftId).flowOn(ioDispatcher)
    }

    override fun observeLocationCount(shiftId: String): Flow<Int> {
        return ubicacionDao.observeTotalPuntosPorJornada(shiftId).flowOn(ioDispatcher)
    }

    override fun observeLocations(shiftId: String): Flow<List<UbicacionGpsEntity>> {
        return ubicacionDao.observeUbicacionesPorJornada(shiftId).flowOn(ioDispatcher)
    }

    override suspend fun getLastLocation(shiftId: String): UbicacionGpsEntity? = withContext(ioDispatcher) {
        ubicacionDao.getUltimaUbicacion(shiftId)
    }

    override suspend fun getLocationCount(shiftId: String): Int = withContext(ioDispatcher) {
        ubicacionDao.countPorJornada(shiftId)
    }

    override suspend fun getTotalStoredPoints(): Int = withContext(ioDispatcher) {
        ubicacionDao.countTotal()
    }

    override suspend fun recordLocation(
        shiftId: String,
        latitud: Double,
        longitud: Double,
        precision: Float,
        altitud: Double?,
        velocidad: Float?,
        timestamp: Long,
        isMock: Boolean
    ): Result<UbicacionGpsEntity> = withContext(ioDispatcher) {
        try {
            val locationId = UUID.randomUUID().toString()
            val entity = UbicacionGpsEntity(
                id = locationId,
                jornadaId = shiftId,
                latitud = latitud,
                longitud = longitud,
                altitud = altitud,
                precision = precision,
                velocidad = velocidad,
                timestampCaptura = timestamp,
                sincronizado = false
            )

            val metadataJson = buildString {
                append("{\"lat\":").append(latitud)
                append(",\"lng\":").append(longitud)
                append(",\"accuracy\":").append(precision)
                append(",\"isMock\":").append(isMock)
                append("}")
            }

            auditChainMutex.withLock {
                // 1. Persistir el punto GPS local
                ubicacionDao.insert(entity)

                // 2. Encadenar en la bitácora criptográfica
                val secretKey = secretKeyProvider()
                val ultimoEvento = auditoriaDao.getUltimoEventoPorJornada(shiftId)
                val hashPrevio = ultimoEvento?.hashActual
                    ?: AuditChainManager.calculateInitialHash(shiftId, secretKey)

                val hashActual = AuditChainManager.calculateHash(
                    tipoEvento = BitacoraAuditoriaEntity.EVENTO_CAPTURA_GPS,
                    timestampEvento = timestamp,
                    metadataJson = metadataJson,
                    hashPrevio = hashPrevio,
                    secretKey = secretKey
                )

                val auditEntity = BitacoraAuditoriaEntity(
                    id = UUID.randomUUID().toString(),
                    jornadaId = shiftId,
                    tipoEvento = BitacoraAuditoriaEntity.EVENTO_CAPTURA_GPS,
                    metadataJson = metadataJson,
                    timestampEvento = timestamp,
                    hashPrevio = hashPrevio,
                    hashActual = hashActual,
                    sincronizado = false
                )

                auditoriaDao.insert(auditEntity)
            }

            Result.success(entity)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun recordAuditEvent(
        shiftId: String,
        eventType: String,
        metadataJson: String,
        timestamp: Long
    ): Result<BitacoraAuditoriaEntity> = withContext(ioDispatcher) {
        try {
            val secretKey = secretKeyProvider()
            val auditEntity = auditChainMutex.withLock {
                val ultimoEvento = auditoriaDao.getUltimoEventoPorJornada(shiftId)
                val hashPrevio = ultimoEvento?.hashActual
                    ?: AuditChainManager.calculateInitialHash(shiftId, secretKey)

                val hashActual = AuditChainManager.calculateHash(
                    tipoEvento = eventType,
                    timestampEvento = timestamp,
                    metadataJson = metadataJson,
                    hashPrevio = hashPrevio,
                    secretKey = secretKey
                )

                val entity = BitacoraAuditoriaEntity(
                    id = UUID.randomUUID().toString(),
                    jornadaId = shiftId,
                    tipoEvento = eventType,
                    metadataJson = metadataJson,
                    timestampEvento = timestamp,
                    hashPrevio = hashPrevio,
                    hashActual = hashActual,
                    sincronizado = false
                )

                auditoriaDao.insert(entity)
                entity
            }

            Result.success(auditEntity)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getPendingLocations(limit: Int): List<UbicacionGpsEntity> = withContext(ioDispatcher) {
        ubicacionDao.getPendientesSincronizacion(limit)
    }

    override suspend fun getPendingLocationsForShift(shiftId: String, limit: Int): List<UbicacionGpsEntity> = withContext(ioDispatcher) {
        ubicacionDao.getPendientesPorJornada(shiftId, limit)
    }

    override suspend fun getPendingAuditEvents(limit: Int): List<BitacoraAuditoriaEntity> = withContext(ioDispatcher) {
        auditoriaDao.getPendientesSincronizacion(limit)
    }

    override suspend fun markLocationsAsSynced(ids: List<String>): Result<Unit> = withContext(ioDispatcher) {
        try {
            if (ids.isNotEmpty()) {
                ubicacionDao.marcarSincronizadas(ids)
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun markAuditEventsAsSynced(ids: List<String>): Result<Unit> = withContext(ioDispatcher) {
        try {
            if (ids.isNotEmpty()) {
                auditoriaDao.marcarSincronizados(ids)
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun purgeSyncedLocations(thresholdTimestamp: Long): Result<Int> = withContext(ioDispatcher) {
        try {
            val purgedCount = ubicacionDao.purgarSincronizadasAntiguas(thresholdTimestamp)
            Result.success(purgedCount)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

