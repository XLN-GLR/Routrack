package com.empresa.routrack.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.empresa.routrack.data.local.entity.TextInteractionEntity
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object (DAO) para la persistencia y consulta local de interacciones de texto corporativo.
 */
@Dao
interface TextInteractionDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: TextInteractionEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entities: List<TextInteractionEntity>)

    @Query("SELECT * FROM interacciones_texto WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): TextInteractionEntity?

    @Query("SELECT * FROM interacciones_texto WHERE jornadaId = :jornadaId ORDER BY timestamp ASC")
    fun observeInteraccionesPorJornada(jornadaId: String): Flow<List<TextInteractionEntity>>

    @Query("SELECT * FROM interacciones_texto WHERE jornadaId = :jornadaId ORDER BY timestamp ASC")
    suspend fun getInteraccionesPorJornada(jornadaId: String): List<TextInteractionEntity>

    @Query("SELECT * FROM interacciones_texto WHERE jornadaId = :jornadaId ORDER BY timestamp DESC LIMIT 1")
    suspend fun getUltimaInteraccionPorJornada(jornadaId: String): TextInteractionEntity?

    @Query("SELECT * FROM interacciones_texto WHERE sincronizado = 0 ORDER BY timestamp ASC LIMIT :limite")
    suspend fun getPendientesSincronizacion(limite: Int = 100): List<TextInteractionEntity>

    @Query("UPDATE interacciones_texto SET sincronizado = 1 WHERE id IN (:ids)")
    suspend fun marcarSincronizadas(ids: List<String>)

    @Query("SELECT COUNT(*) FROM interacciones_texto WHERE jornadaId = :jornadaId")
    suspend fun countPorJornada(jornadaId: String): Int
}
