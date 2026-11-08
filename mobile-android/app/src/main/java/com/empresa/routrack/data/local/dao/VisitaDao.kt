package com.empresa.routrack.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.empresa.routrack.data.local.entity.VisitaEntity
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object (DAO) para la persistencia y consulta local de visitas comerciales.
 */
@Dao
interface VisitaDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(visita: VisitaEntity)

    @Update
    suspend fun update(visita: VisitaEntity)

    @Query("SELECT * FROM visitas_comerciales WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): VisitaEntity?

    @Query("SELECT * FROM visitas_comerciales WHERE jornadaId = :jornadaId ORDER BY checkInTime ASC")
    fun observeVisitasPorJornada(jornadaId: String): Flow<List<VisitaEntity>>

    @Query("SELECT * FROM visitas_comerciales WHERE jornadaId = :jornadaId ORDER BY checkInTime ASC")
    suspend fun getVisitasPorJornada(jornadaId: String): List<VisitaEntity>

    @Query("SELECT * FROM visitas_comerciales WHERE sincronizado = 0 ORDER BY checkInTime ASC LIMIT :limite")
    suspend fun getPendientesSincronizacion(limite: Int = 100): List<VisitaEntity>

    @Query("UPDATE visitas_comerciales SET checkOutTime = :checkOutTime, checkOutLat = :checkOutLat, checkOutLng = :checkOutLng, observaciones = :observaciones, acuerdosJson = :acuerdosJson WHERE id = :id")
    suspend fun registrarCheckOut(
        id: String,
        checkOutTime: Long,
        checkOutLat: Double,
        checkOutLng: Double,
        observaciones: String?,
        acuerdosJson: String?
    )

    @Query("UPDATE visitas_comerciales SET sincronizado = 1 WHERE id IN (:ids)")
    suspend fun marcarSincronizadas(ids: List<String>)

    @Query("SELECT COUNT(*) FROM visitas_comerciales WHERE jornadaId = :jornadaId")
    suspend fun countPorJornada(jornadaId: String): Int
}

