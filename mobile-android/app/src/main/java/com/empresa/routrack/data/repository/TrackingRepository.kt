package com.empresa.routrack.data.repository

import com.empresa.routrack.data.local.entity.BitacoraAuditoriaEntity
import com.empresa.routrack.data.local.entity.UbicacionGpsEntity
import kotlinx.coroutines.flow.Flow

/**
 * Contrato de dominio para la recolección, resguardo local y auditoría inmutable
 * de telemetría geoespacial (GPS) y eventos de seguridad.
 *
 * Satisface los requisitos de resiliencia offline (búfer de hasta 10.000 puntos),
 * concurrencia atómica y emisión de flujos reactivos inmutables.
 */
interface TrackingRepository {

    /**
     * Emite reactivamente la última ubicación GPS registrada para la jornada especificada.
     */
    fun observeLastLocation(shiftId: String): Flow<UbicacionGpsEntity?>

    /**
     * Emite reactivamente el conteo total de puntos capturados localmente para la jornada.
     */
    fun observeLocationCount(shiftId: String): Flow<Int>

    /**
     * Emite la lista cronológica completa de ubicaciones registradas para una jornada.
     */
    fun observeLocations(shiftId: String): Flow<List<UbicacionGpsEntity>>

    /**
     * Consulta suspendida de la última ubicación registrada de la jornada.
     */
    suspend fun getLastLocation(shiftId: String): UbicacionGpsEntity?

    /**
     * Consulta el conteo local de puntos para una jornada sin cargar listas en memoria.
     */
    suspend fun getLocationCount(shiftId: String): Int

    /**
     * Conteo total de puntos almacenados en el búfer local del dispositivo.
     */
    suspend fun getTotalStoredPoints(): Int

    /**
     * Registra atómicamente un nuevo punto GPS y genera el evento de auditoría
     * con su respectivo hash HMAC-SHA256 encadenado.
     */
    suspend fun recordLocation(
        shiftId: String,
        latitud: Double,
        longitud: Double,
        precision: Float,
        altitud: Double? = null,
        velocidad: Float? = null,
        timestamp: Long = System.currentTimeMillis(),
        isMock: Boolean = false
    ): Result<UbicacionGpsEntity>

    /**
     * Registra un evento de ciclo de vida o seguridad en la bitácora de auditoría.
     */
    suspend fun recordAuditEvent(
        shiftId: String,
        eventType: String,
        metadataJson: String,
        timestamp: Long = System.currentTimeMillis()
    ): Result<BitacoraAuditoriaEntity>

    /**
     * Obtiene un lote de puntos GPS pendientes de sincronización hacia el backend.
     */
    suspend fun getPendingLocations(limit: Int = 100): List<UbicacionGpsEntity>

    /**
     * Obtiene un lote de puntos GPS pendientes de sincronización para una jornada puntual.
     */
    suspend fun getPendingLocationsForShift(shiftId: String, limit: Int = 100): List<UbicacionGpsEntity>

    /**
     * Obtiene un lote de eventos de bitácora pendientes de sincronización.
     */
    suspend fun getPendingAuditEvents(limit: Int = 100): List<BitacoraAuditoriaEntity>

    /**
     * Marca un lote de ubicaciones como sincronizadas tras confirmación del servidor.
     */
    suspend fun markLocationsAsSynced(ids: List<String>): Result<Unit>

    /**
     * Marca un lote de eventos de bitácora como sincronizados.
     */
    suspend fun markAuditEventsAsSynced(ids: List<String>): Result<Unit>

    /**
     * Depura registros sincronizados antiguos para mantener el búfer local ligero y acotado.
     */
    suspend fun purgeSyncedLocations(thresholdTimestamp: Long): Result<Int>
}

