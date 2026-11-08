package com.empresa.routrack.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Entidad de Room para el registro de visitas comerciales realizadas por vendedores en campo.
 *
 * Captura coordenadas físicas de check-in y check-out, estado de verificación
 * geoespacial frente a la geocerca del cliente y compromisos comerciales acordados.
 */
@Entity(
    tableName = "visitas_comerciales",
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
        Index(value = ["clienteId"]),
        Index(value = ["vendedorId"]),
        Index(value = ["checkInTime"]),
        Index(value = ["sincronizado"])
    ]
)
data class VisitaEntity(
    @PrimaryKey
    val id: String,
    val jornadaId: String,
    val clienteId: String,
    val vendedorId: String,
    val checkInTime: Long,
    val checkOutTime: Long? = null,
    val checkInLat: Double,
    val checkInLng: Double,
    val checkOutLat: Double? = null,
    val checkOutLng: Double? = null,
    val distanciaClienteMetros: Float,
    val estado: String = ESTADO_VERIFICADA,
    val observaciones: String? = null,
    val acuerdosJson: String? = null,
    val sincronizado: Boolean = false
) {
    companion object {
        const val ESTADO_VERIFICADA = "VERIFIED"
        const val ESTADO_FUERA_DE_RANGO = "OUT_OF_RANGE"
        const val ESTADO_CANCELADA = "CANCELLED"
    }
}

