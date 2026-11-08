package com.empresa.routrack.data.repository

import com.empresa.routrack.data.local.entity.JornadaEntity
import kotlinx.coroutines.flow.Flow

/**
 * Contrato de dominio para la gestión del ciclo de vida de jornadas laborales (turnos).
 *
 * Desacopla la lógica de persistencia de Room de la capa de presentación y servicios,
 * garantizando la emisión de modelos inmutables y la auditoría criptográfica del turno.
 */
interface ShiftRepository {

    /**
     * Emite reactivamente la jornada laboral activa en curso, o null si no hay turno iniciado.
     */
    fun observeActiveShift(): Flow<JornadaEntity?>

    /**
     * Consulta síncrona/suspendida de la jornada laboral actualmente en curso.
     */
    suspend fun getActiveShift(): JornadaEntity?

    /**
     * Consulta una jornada laboral por su identificador único.
     */
    suspend fun getShiftById(id: String): JornadaEntity?

    /**
     * Inicia una nueva jornada laboral para el vendedor, registrando el turno e insertando
     * el evento inicial en la bitácora de auditoría con la semilla criptográfica HMAC.
     */
    suspend fun startShift(sellerId: String): Result<JornadaEntity>

    /**
     * Finaliza la jornada laboral activa, actualizando el estado y sellando la bitácora
     * de auditoría con el hash encadenado final.
     */
    suspend fun endShift(shiftId: String, totalPoints: Int = 0): Result<JornadaEntity>

    /**
     * Obtiene la lista de jornadas pendientes de sincronización hacia Supabase.
     */
    suspend fun getPendingSyncShifts(limit: Int = 100): List<JornadaEntity>

    /**
     * Marca una jornada como sincronizada una vez confirmada la ingesta en el backend.
     */
    suspend fun markShiftAsSynced(shiftId: String): Result<Unit>
}

