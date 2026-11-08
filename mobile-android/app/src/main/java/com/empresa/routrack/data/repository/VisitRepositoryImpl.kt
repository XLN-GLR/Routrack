package com.empresa.routrack.data.repository

import com.empresa.routrack.data.crypto.AuditChainManager
import com.empresa.routrack.data.local.dao.BitacoraAuditoriaDao
import com.empresa.routrack.data.local.dao.VisitaDao
import com.empresa.routrack.data.local.entity.BitacoraAuditoriaEntity
import com.empresa.routrack.data.local.entity.VisitaEntity
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext
import java.util.UUID

/**
 * Implementación de VisitRepository para la persistencia local de visitas comerciales,
 * verificación de geocercas y auditoría encadenada HMAC.
 */
class VisitRepositoryImpl(
    private val visitaDao: VisitaDao,
    private val auditoriaDao: BitacoraAuditoriaDao,
    private val secretKeyProvider: () -> ByteArray,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : VisitRepository {

    override fun observeVisitsForShift(shiftId: String): Flow<List<VisitaEntity>> {
        return visitaDao.observeVisitasPorJornada(shiftId).flowOn(ioDispatcher)
    }

    override suspend fun getVisitsForShift(shiftId: String): List<VisitaEntity> = withContext(ioDispatcher) {
        visitaDao.getVisitasPorJornada(shiftId)
    }

    override suspend fun recordCheckIn(
        shiftId: String,
        clientId: String,
        sellerId: String,
        lat: Double,
        lng: Double,
        distanceMeters: Float,
        status: String,
        observations: String?
    ): Result<VisitaEntity> = withContext(ioDispatcher) {
        try {
            val visitId = UUID.randomUUID().toString()
            val now = System.currentTimeMillis()

            val entity = VisitaEntity(
                id = visitId,
                jornadaId = shiftId,
                clienteId = clientId,
                vendedorId = sellerId,
                checkInTime = now,
                checkOutTime = null,
                checkInLat = lat,
                checkInLng = lng,
                checkOutLat = null,
                checkOutLng = null,
                distanciaClienteMetros = distanceMeters,
                estado = status,
                observaciones = observations,
                acuerdosJson = null,
                sincronizado = false
            )

            // 1. Guardar la visita en Room
            visitaDao.insert(entity)

            // 2. Encadenar en la bitácora de auditoría
            val secretKey = secretKeyProvider()
            val ultimoEvento = auditoriaDao.getUltimoEventoPorJornada(shiftId)
            val hashPrevio = ultimoEvento?.hashActual
                ?: AuditChainManager.calculateInitialHash(shiftId, secretKey)

            val metadata = buildString {
                append("{\"visitId\":\"").append(visitId).append("\"")
                append(",\"clientId\":\"").append(clientId).append("\"")
                append(",\"status\":\"").append(status).append("\"")
                append(",\"distance\":").append(distanceMeters)
                append("}")
            }

            val hashActual = AuditChainManager.calculateHash(
                tipoEvento = "VISITA_CHECK_IN",
                timestampEvento = now,
                metadataJson = metadata,
                hashPrevio = hashPrevio,
                secretKey = secretKey
            )

            val auditEntity = BitacoraAuditoriaEntity(
                id = UUID.randomUUID().toString(),
                jornadaId = shiftId,
                tipoEvento = "VISITA_CHECK_IN",
                metadataJson = metadata,
                timestampEvento = now,
                hashPrevio = hashPrevio,
                hashActual = hashActual,
                sincronizado = false
            )

            auditoriaDao.insert(auditEntity)
            Result.success(entity)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun recordCheckOut(
        visitId: String,
        lat: Double,
        lng: Double,
        observations: String?,
        agreementsJson: String?
    ): Result<VisitaEntity> = withContext(ioDispatcher) {
        try {
            val visita = visitaDao.getById(visitId)
                ?: return@withContext Result.failure(
                    IllegalArgumentException("Visita no encontrada con id: $visitId")
                )

            val now = System.currentTimeMillis()

            visitaDao.registrarCheckOut(
                id = visitId,
                checkOutTime = now,
                checkOutLat = lat,
                checkOutLng = lng,
                observaciones = observations ?: visita.observaciones,
                acuerdosJson = agreementsJson
            )

            val actualizada = visita.copy(
                checkOutTime = now,
                checkOutLat = lat,
                checkOutLng = lng,
                observaciones = observations ?: visita.observaciones,
                acuerdosJson = agreementsJson
            )

            // Encadenar en auditoría
            val secretKey = secretKeyProvider()
            val ultimoEvento = auditoriaDao.getUltimoEventoPorJornada(visita.jornadaId)
            val hashPrevio = ultimoEvento?.hashActual
                ?: AuditChainManager.calculateInitialHash(visita.jornadaId, secretKey)

            val metadata = "{\"visitId\":\"$visitId\",\"checkOutTime\":$now}"
            val hashActual = AuditChainManager.calculateHash(
                tipoEvento = "VISITA_CHECK_OUT",
                timestampEvento = now,
                metadataJson = metadata,
                hashPrevio = hashPrevio,
                secretKey = secretKey
            )

            val auditEntity = BitacoraAuditoriaEntity(
                id = UUID.randomUUID().toString(),
                jornadaId = visita.jornadaId,
                tipoEvento = "VISITA_CHECK_OUT",
                metadataJson = metadata,
                timestampEvento = now,
                hashPrevio = hashPrevio,
                hashActual = hashActual,
                sincronizado = false
            )

            auditoriaDao.insert(auditEntity)
            Result.success(actualizada)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getPendingSyncVisits(limit: Int): List<VisitaEntity> = withContext(ioDispatcher) {
        visitaDao.getPendientesSincronizacion(limit)
    }

    override suspend fun markVisitsAsSynced(ids: List<String>): Result<Unit> = withContext(ioDispatcher) {
        try {
            if (ids.isNotEmpty()) {
                visitaDao.marcarSincronizadas(ids)
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

