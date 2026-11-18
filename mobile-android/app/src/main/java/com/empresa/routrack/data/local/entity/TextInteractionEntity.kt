package com.empresa.routrack.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Entidad de Room para el almacenamiento local cifrado (SQLCipher AES-256)
 * de las interacciones de texto capturadas en aplicaciones comerciales corporativas.
 *
 * Cada registro forma parte de una cadena criptográfica de custodia inmutable (HMAC-SHA256).
 */
@Entity(
    tableName = "interacciones_texto",
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
        Index(value = ["vendedorId"]),
        Index(value = ["timestamp"]),
        Index(value = ["sincronizado"])
    ]
)
data class TextInteractionEntity(
    @PrimaryKey
    val id: String,
    val jornadaId: String,
    val vendedorId: String,
    val packageName: String,
    val appLabel: String? = null,
    val capturedText: String,
    val timestamp: Long,
    val previousHash: String,
    val hmacHash: String,
    val sincronizado: Boolean = false
)
