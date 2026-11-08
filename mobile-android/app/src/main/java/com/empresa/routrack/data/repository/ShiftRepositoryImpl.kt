package com.empresa.routrack.data.repository

import com.empresa.routrack.data.crypto.AuditChainManager
import com.empresa.routrack.data.local.dao.BitacoraAuditoriaDao
import com.empresa.routrack.data.local.dao.JornadaDao
import com.empresa.routrack.data.local.entity.BitacoraAuditoriaEntity
import com.empresa.routrack.data.local.entity.JornadaEntity
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

/**
 * Implementación de ShiftRepository que orquesta la persistencia en Room y la bitácora
 * inmutable bajo corrutinas estructuradas en Dispatchers.IO.
 */
class ShiftRepositoryImpl(
    private val jornadaDao: JornadaDao,
    private val auditoriaDao: BitacoraAuditoriaDao,
    private val secretKeyProvider: () -> ByteArray,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : ShiftRepository {

    override fun observeActiveShift(): Flow<JornadaEntity?> {
        return jornadaDao.observeJornadaActiva().flowOn(ioDispatcher)
    }

    override suspend fun getActiveShift(): JornadaEntity? = withContext(ioDispatcher) {
        jornadaDao.getJornadaActiva()
    }

    override suspend fun getShiftById(id: String): JornadaEntity? = withContext(ioDispatcher) {
        jornadaDao.getById(id)
    }

    override suspend fun startShift(sellerId: String): Result<JornadaEntity> = withContext(ioDispatcher) {
        try {
            val activa = jornadaDao.getJornadaActiva()
            if (activa != null) {
                return@withContext Result.failure(
                    IllegalStateException("Ya existe una jornada activa en curso con id: ${activa.id}")
                )
            }

            val jornadaId = UUID.randomUUID().toString()
            val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
            val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
            val now = Date()
            val fechaActual = dateFormat.format(now)
            val horaActual = timeFormat.format(now)

            val nuevaJornada = JornadaEntity(
                id = jornadaId,
                vendedorId = sellerId,
                fecha = fechaActual,
                horaInicio = horaActual,
                horaFin = null,
                estado = JornadaEntity.ESTADO_EN_CURSO,
                sincronizado = false
            )

            // 1. Persistir la jornada local
            jornadaDao.insert(nuevaJornada)

            // 2. Generar semilla criptográfica y registrar evento de inicio de turno
            val secretKey = secretKeyProvider()
            val seedHash = AuditChainManager.calculateInitialHash(jornadaId, secretKey)
            val metadata = "{\"vendedorId\":\"$sellerId\",\"inicio\":\"$horaActual\"}"
            val initialHash = AuditChainManager.calculateHash(
                tipoEvento = BitacoraAuditoriaEntity.EVENTO_JORNADA_INICIADA,
                timestampEvento = now.time,
                metadataJson = metadata,
                hashPrevio = seedHash,
                secretKey = secretKey
            )

            val auditEntity = BitacoraAuditoriaEntity(
                id = UUID.randomUUID().toString(),
                jornadaId = jornadaId,
                tipoEvento = BitacoraAuditoriaEntity.EVENTO_JORNADA_INICIADA,
                metadataJson = metadata,
                timestampEvento = now.time,
                hashPrevio = seedHash,
                hashActual = initialHash,
                sincronizado = false
            )

            auditoriaDao.insert(auditEntity)
            Result.success(nuevaJornada)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun endShift(shiftId: String, totalPoints: Int): Result<JornadaEntity> = withContext(ioDispatcher) {
        try {
            val jornada = jornadaDao.getById(shiftId)
                ?: return@withContext Result.failure(
                    IllegalArgumentException("No se encontró la jornada laboral con id: $shiftId")
                )

            if (jornada.estado != JornadaEntity.ESTADO_EN_CURSO) {
                return@withContext Result.failure(
                    IllegalStateException("La jornada ya se encuentra en estado: ${jornada.estado}")
                )
            }

            val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
            val now = Date()
            val horaFin = timeFormat.format(now)

            // 1. Actualizar jornada a finalizada
            jornadaDao.finalizarJornada(shiftId, horaFin, JornadaEntity.ESTADO_FINALIZADA)

            // 2. Encadenar hash HMAC para cierre de jornada
            val secretKey = secretKeyProvider()
            val ultimoEvento = auditoriaDao.getUltimoEventoPorJornada(shiftId)
            val hashPrevio = ultimoEvento?.hashActual
                ?: AuditChainManager.calculateInitialHash(shiftId, secretKey)

            val metadata = "{\"horaFin\":\"$horaFin\",\"totalPuntos\":$totalPoints}"
            val hashFinal = AuditChainManager.calculateHash(
                tipoEvento = BitacoraAuditoriaEntity.EVENTO_JORNADA_FINALIZADA,
                timestampEvento = now.time,
                metadataJson = metadata,
                hashPrevio = hashPrevio,
                secretKey = secretKey
            )

            val auditEntity = BitacoraAuditoriaEntity(
                id = UUID.randomUUID().toString(),
                jornadaId = shiftId,
                tipoEvento = BitacoraAuditoriaEntity.EVENTO_JORNADA_FINALIZADA,
                metadataJson = metadata,
                timestampEvento = now.time,
                hashPrevio = hashPrevio,
                hashActual = hashFinal,
                sincronizado = false
            )

            auditoriaDao.insert(auditEntity)

            val jornadaActualizada = jornada.copy(
                horaFin = horaFin,
                estado = JornadaEntity.ESTADO_FINALIZADA
            )
            Result.success(jornadaActualizada)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getPendingSyncShifts(limit: Int): List<JornadaEntity> = withContext(ioDispatcher) {
        jornadaDao.getPendientesSincronizacion(limit)
    }

    override suspend fun markShiftAsSynced(shiftId: String): Result<Unit> = withContext(ioDispatcher) {
        try {
            jornadaDao.marcarSincronizada(shiftId)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

