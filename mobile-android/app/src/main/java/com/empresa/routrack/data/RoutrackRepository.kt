package com.empresa.routrack.data

import com.empresa.routrack.data.repository.ShiftRepository
import com.empresa.routrack.data.repository.TrackingRepository
import com.empresa.routrack.data.repository.VisitRepository

/**
 * Contrato base unificado para la capa de repositorios de ROUTRACK Mobile.
 * Agrupa los sub-repositorios de dominio para desacoplar totalmente la base de datos Room.
 */
interface RoutrackRepository {
    val shifts: ShiftRepository
    val tracking: TrackingRepository
    val visits: VisitRepository
}
