package com.empresa.routrack.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.empresa.routrack.data.local.entity.UbicacionGpsEntity
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object (DAO) para la persistencia y consulta de telemetría GPS local.
 */
@Dao
interface UbicacionGpsDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(ubicacion: UbicacionGpsEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(ubicaciones: List<UbicacionGpsEntity>)

    @Query("SELECT * FROM ubicaciones_gps WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): UbicacionGpsEntity?

    @Query("SELECT * FROM ubicaciones_gps WHERE jornadaId = :jornadaId ORDER BY timestampCaptura ASC")
    fun observeUbicacionesPorJornada(jornadaId: String): Flow<List<UbicacionGpsEntity>>

    @Query("SELECT * FROM ubicaciones_gps WHERE jornadaId = :jornadaId ORDER BY timestampCaptura ASC")
    suspend fun getUbicacionesPorJornada(jornadaId: String): List<UbicacionGpsEntity>

    @Query("SELECT * FROM ubicaciones_gps WHERE jornadaId = :jornadaId ORDER BY timestampCaptura DESC LIMIT 1")
    fun observeUltimaUbicacion(jornadaId: String): Flow<UbicacionGpsEntity?>

    @Query("SELECT * FROM ubicaciones_gps WHERE jornadaId = :jornadaId ORDER BY timestampCaptura DESC LIMIT 1")
    suspend fun getUltimaUbicacion(jornadaId: String): UbicacionGpsEntity?

    @Query("SELECT COUNT(*) FROM ubicaciones_gps WHERE jornadaId = :jornadaId")
    fun observeTotalPuntosPorJornada(jornadaId: String): Flow<Int>

    @Query("SELECT COUNT(*) FROM ubicaciones_gps WHERE jornadaId = :jornadaId")
    suspend fun countPorJornada(jornadaId: String): Int

    @Query("SELECT COUNT(*) FROM ubicaciones_gps")
    suspend fun countTotal(): Int

    @Query("SELECT * FROM ubicaciones_gps WHERE sincronizado = 0 ORDER BY timestampCaptura ASC")
    suspend fun getPendientesSincronizacion(): List<UbicacionGpsEntity>

    @Query("SELECT * FROM ubicaciones_gps WHERE sincronizado = 0 ORDER BY timestampCaptura ASC LIMIT :limite")
    suspend fun getPendientesSincronizacion(limite: Int): List<UbicacionGpsEntity>

    @Query("SELECT * FROM ubicaciones_gps WHERE jornadaId = :jornadaId AND sincronizado = 0 ORDER BY timestampCaptura ASC")
    suspend fun getPendientesPorJornada(jornadaId: String): List<UbicacionGpsEntity>

    @Query("SELECT * FROM ubicaciones_gps WHERE jornadaId = :jornadaId AND sincronizado = 0 ORDER BY timestampCaptura ASC LIMIT :limite")
    suspend fun getPendientesPorJornada(jornadaId: String, limite: Int): List<UbicacionGpsEntity>

    @Query("UPDATE ubicaciones_gps SET sincronizado = 1 WHERE id IN (:ids)")
    suspend fun marcarSincronizadas(ids: List<String>)

    @Query("DELETE FROM ubicaciones_gps WHERE sincronizado = 1 AND timestampCaptura < :umbralTimestamp")
    suspend fun purgarSincronizadasAntiguas(umbralTimestamp: Long): Int

    @Query("DELETE FROM ubicaciones_gps WHERE jornadaId = :jornadaId")
    suspend fun deletePorJornada(jornadaId: String)
}
