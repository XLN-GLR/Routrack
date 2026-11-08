package com.empresa.routrack.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Entidad de Room para la bitácora inmutable de eventos de auditoría y cadena de custodia.
 * Cada registro almacena un hash encadenado HMAC-SHA256 que garantiza que ningún punto,
 * timestamp o evento previo haya sido adulterado antes de la sincronización remota.
 */
@Entity(
    tableName = "bitacora_auditoria",
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
        Index(value = ["timestampEvento"]),
        Index(value = ["sincronizado"])
    ]
)
data class BitacoraAuditoriaEntity(
    @PrimaryKey
    val id: String,
    val jornadaId: String,
    val tipoEvento: String,
    val metadataJson: String,
    val timestampEvento: Long,
    val hashPrevio: String,
    val hashActual: String,
    val sincronizado: Boolean = false
) {
    companion object {
        const val EVENTO_JORNADA_INICIADA = "JORNADA_INICIADA"
        const val EVENTO_JORNADA_FINALIZADA = "JORNADA_FINALIZADA"
        const val EVENTO_CAPTURA_GPS = "CAPTURA_GPS"
        const val EVENTO_SERVICE_STARTED = "SERVICE_STARTED"
        const val EVENTO_SERVICE_STOPPED = "SERVICE_STOPPED"
        const val EVENTO_GPS_DISABLED = "GPS_DISABLED"
    }
}
