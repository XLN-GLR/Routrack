package com.empresa.routrack.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Entidad de Room para persistencia local de puntos de localización GPS.
 * Contiene coordenadas, metadatos espaciales (altitud, precisión, velocidad)
 * y estado de sincronización hacia Supabase.
 */
@Entity(
    tableName = "ubicaciones_gps",
    foreignKeys = [
        ForeignKey(
            entity = JornadaEntity::class,
            parentColumns = ["id"],
            childColumns = ["jornadaId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["jornadaId"]),
        Index(value = ["timestampCaptura"]),
        Index(value = ["sincronizado"])
    ]
)
data class UbicacionGpsEntity(
    @PrimaryKey
    val id: String,
    val jornadaId: String,
    val latitud: Double,
    val longitud: Double,
    val altitud: Double? = null,
    val precision: Float,
    val velocidad: Float? = null,
    val timestampCaptura: Long,
    val sincronizado: Boolean = false
)
