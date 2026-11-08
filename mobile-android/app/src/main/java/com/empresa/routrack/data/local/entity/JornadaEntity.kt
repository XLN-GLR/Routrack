package com.empresa.routrack.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Entidad de Room que representa una jornada laboral de campo.
 * Almacena el estado del turno, timestamps de inicio/fin y flag de sincronización hacia Supabase.
 */
@Entity(
    tableName = "jornadas",
    indices = [
        Index(value = ["vendedorId"]),
        Index(value = ["estado"]),
        Index(value = ["sincronizado"])
    ]
)
data class JornadaEntity(
    @PrimaryKey
    val id: String,
    val vendedorId: String,
    val fecha: String,
    val horaInicio: String,
    val horaFin: String? = null,
    val estado: String = ESTADO_EN_CURSO,
    val sincronizado: Boolean = false
) {
    companion object {
        const val ESTADO_EN_CURSO = "EN_CURSO"
        const val ESTADO_FINALIZADA = "FINALIZADA"
        const val ESTADO_SINCRONIZADA = "SINCRONIZADA"
    }
}
