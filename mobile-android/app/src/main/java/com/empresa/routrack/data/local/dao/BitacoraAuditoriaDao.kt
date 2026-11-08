package com.empresa.routrack.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.empresa.routrack.data.local.entity.BitacoraAuditoriaEntity
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object (DAO) para la bitácora inmutable de eventos y cadena de auditoría.
 */
@Dao
interface BitacoraAuditoriaDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(evento: BitacoraAuditoriaEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(eventos: List<BitacoraAuditoriaEntity>)

    @Query("SELECT * FROM bitacora_auditoria WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): BitacoraAuditoriaEntity?

    @Query("SELECT * FROM bitacora_auditoria WHERE jornadaId = :jornadaId ORDER BY timestampEvento DESC LIMIT 1")
    suspend fun getUltimoEventoPorJornada(jornadaId: String): BitacoraAuditoriaEntity?

    @Query("SELECT * FROM bitacora_auditoria WHERE jornadaId = :jornadaId ORDER BY timestampEvento ASC")
    suspend fun getEventosPorJornada(jornadaId: String): List<BitacoraAuditoriaEntity>

    @Query("SELECT * FROM bitacora_auditoria WHERE jornadaId = :jornadaId ORDER BY timestampEvento ASC")
    fun observeEventosPorJornada(jornadaId: String): Flow<List<BitacoraAuditoriaEntity>>

    @Query("SELECT * FROM bitacora_auditoria WHERE sincronizado = 0 ORDER BY timestampEvento ASC")
    suspend fun getPendientesSincronizacion(): List<BitacoraAuditoriaEntity>

    @Query("SELECT * FROM bitacora_auditoria WHERE sincronizado = 0 ORDER BY timestampEvento ASC LIMIT :limite")
    suspend fun getPendientesSincronizacion(limite: Int): List<BitacoraAuditoriaEntity>

    @Query("SELECT * FROM bitacora_auditoria WHERE jornadaId = :jornadaId AND sincronizado = 0 ORDER BY timestampEvento ASC")
    suspend fun getPendientesPorJornada(jornadaId: String): List<BitacoraAuditoriaEntity>

    @Query("SELECT * FROM bitacora_auditoria WHERE jornadaId = :jornadaId AND sincronizado = 0 ORDER BY timestampEvento ASC LIMIT :limite")
    suspend fun getPendientesPorJornada(jornadaId: String, limite: Int): List<BitacoraAuditoriaEntity>

    @Query("UPDATE bitacora_auditoria SET sincronizado = 1 WHERE id IN (:ids)")
    suspend fun marcarSincronizados(ids: List<String>)

    @Query("DELETE FROM bitacora_auditoria WHERE jornadaId = :jornadaId")
    suspend fun deletePorJornada(jornadaId: String)
}
