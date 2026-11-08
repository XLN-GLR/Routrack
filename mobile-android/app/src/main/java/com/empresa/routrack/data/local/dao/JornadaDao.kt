package com.empresa.routrack.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.empresa.routrack.data.local.entity.JornadaEntity
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object (DAO) para la gestión local de jornadas laborales.
 */
@Dao
interface JornadaDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(jornada: JornadaEntity)

    @Update
    suspend fun update(jornada: JornadaEntity)

    @Query("SELECT * FROM jornadas WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): JornadaEntity?

    @Query("SELECT * FROM jornadas WHERE estado = 'EN_CURSO' ORDER BY fecha DESC, horaInicio DESC LIMIT 1")
    suspend fun getJornadaActiva(): JornadaEntity?

    @Query("SELECT * FROM jornadas WHERE estado = 'EN_CURSO' ORDER BY fecha DESC, horaInicio DESC LIMIT 1")
    fun observeJornadaActiva(): Flow<JornadaEntity?>

    @Query("SELECT * FROM jornadas WHERE sincronizado = 0 ORDER BY fecha ASC")
    suspend fun getJornadasPendientesSincronizacion(): List<JornadaEntity>

    @Query("SELECT * FROM jornadas WHERE sincronizado = 0 ORDER BY fecha ASC LIMIT :limite")
    suspend fun getPendientesSincronizacion(limite: Int = 100): List<JornadaEntity>

    @Query("UPDATE jornadas SET horaFin = :horaFin, estado = :estado WHERE id = :id")
    suspend fun finalizarJornada(
        id: String,
        horaFin: String,
        estado: String = JornadaEntity.ESTADO_FINALIZADA
    )

    @Query("UPDATE jornadas SET sincronizado = 1 WHERE id = :id")
    suspend fun marcarSincronizada(id: String)

    @Query("DELETE FROM jornadas WHERE id = :id")
    suspend fun deleteById(id: String)
}
