package com.empresa.routrack.data.repository

import com.empresa.routrack.data.local.entity.VisitaEntity
import kotlinx.coroutines.flow.Flow

/**
 * Contrato de dominio para la gestión y resguardo local de visitas comerciales en campo.
 *
 * Administra el ciclo de vida de cada visita (check-in con validación de geocerca,
 * check-out, registro de acuerdos comerciales) y su encolamiento offline.
 */
interface VisitRepository {

    /**
     * Emite reactivamente la lista cronológica de visitas asociadas a una jornada.
     */
    fun observeVisitsForShift(shiftId: String): Flow<List<VisitaEntity>>

    /**
     * Consulta suspendida de las visitas de una jornada laboral.
     */
    suspend fun getVisitsForShift(shiftId: String): List<VisitaEntity>

    /**
     * Registra el check-in presencial de una visita comercial con coordenadas de captura,
     * distancia geodésica al cliente y estado de geocerca.
     */
    suspend fun recordCheckIn(
        shiftId: String,
        clientId: String,
        sellerId: String,
        lat: Double,
        lng: Double,
        distanceMeters: Float,
        status: String = VisitaEntity.ESTADO_VERIFICADA,
        observations: String? = null
    ): Result<VisitaEntity>

    /**
     * Registra el check-out de la visita comercial, consolidando acuerdos y notas.
     */
    suspend fun recordCheckOut(
        visitId: String,
        lat: Double,
        lng: Double,
        observations: String? = null,
        agreementsJson: String? = null
    ): Result<VisitaEntity>

    /**
     * Obtiene visitas pendientes de sincronización hacia Supabase.
     */
    suspend fun getPendingSyncVisits(limit: Int = 100): List<VisitaEntity>

    /**
     * Marca un lote de visitas como sincronizadas tras confirmación del backend.
     */
    suspend fun markVisitsAsSynced(ids: List<String>): Result<Unit>
}

