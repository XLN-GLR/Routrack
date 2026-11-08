package com.empresa.routrack.ui.tracking

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.empresa.routrack.data.local.entity.JornadaEntity
import com.empresa.routrack.data.repository.RepositoryProvider
import com.empresa.routrack.data.repository.ShiftRepository
import com.empresa.routrack.data.repository.TrackingRepository
import com.empresa.routrack.service.LocationForegroundService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Estado observable de la interfaz de rastreo y turno de campo.
 */
data class TrackingUiState(
    val isTrackingActive: Boolean = false,
    val activeJornada: JornadaEntity? = null,
    val totalPuntosLocales: Int = 0,
    val ultimaLatitud: Double? = null,
    val ultimaLongitud: Double? = null,
    val ultimaPrecision: Float? = null,
    val ultimoTimestamp: Long? = null,
    val isLoading: Boolean = false,
    val mensajeFeedback: String? = null
)

/**
 * ViewModel para la gestión de turnos laborales, servicio de localización y métricas de telemetría local.
 *
 * Desacoplado enteramente de la persistencia directa de Room mediante ShiftRepository y TrackingRepository.
 */
class TrackingViewModel(
    application: Application,
    private val shiftRepository: ShiftRepository = RepositoryProvider.getShiftRepository(application),
    private val trackingRepository: TrackingRepository = RepositoryProvider.getTrackingRepository(application)
) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(TrackingUiState())
    val uiState: StateFlow<TrackingUiState> = _uiState.asStateFlow()

    init {
        observarJornadaYTelemetria()
    }

    private fun observarJornadaYTelemetria() {
        viewModelScope.launch {
            shiftRepository.observeActiveShift().collect { jornada ->
                _uiState.update { current ->
                    current.copy(
                        activeJornada = jornada,
                        isTrackingActive = jornada != null
                    )
                }

                if (jornada != null) {
                    observarTelemetriaDeJornada(jornada.id)
                } else {
                    _uiState.update { current ->
                        current.copy(
                            totalPuntosLocales = 0,
                            ultimaLatitud = null,
                            ultimaLongitud = null,
                            ultimaPrecision = null
                        )
                    }
                }
            }
        }

        // Observar coordenadas en vivo reportadas por el Foreground Service
        viewModelScope.launch {
            LocationForegroundService.lastLocation.collect { loc ->
                if (loc != null) {
                    _uiState.update { current ->
                        current.copy(
                            ultimaLatitud = loc.latitude,
                            ultimaLongitud = loc.longitude,
                            ultimaPrecision = loc.accuracy,
                            ultimoTimestamp = loc.time
                        )
                    }
                }
            }
        }
    }

    private fun observarTelemetriaDeJornada(jornadaId: String) {
        viewModelScope.launch {
            trackingRepository.observeLocationCount(jornadaId).collect { count ->
                _uiState.update { it.copy(totalPuntosLocales = count) }
            }
        }

        viewModelScope.launch {
            trackingRepository.observeLastLocation(jornadaId).collect { ultima ->
                if (ultima != null) {
                    _uiState.update { current ->
                        current.copy(
                            ultimaLatitud = ultima.latitud,
                            ultimaLongitud = ultima.longitud,
                            ultimaPrecision = ultima.precision,
                            ultimoTimestamp = ultima.timestampCaptura
                        )
                    }
                }
            }
        }
    }

    /**
     * Inicia una nueva jornada laboral a través del ShiftRepository y arranca el
     * LocationForegroundService con notificación obligatoria visible.
     */
    fun iniciarJornada(vendedorId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, mensajeFeedback = null) }

            val result = shiftRepository.startShift(vendedorId)
            result.fold(
                onSuccess = { jornada ->
                    // Iniciar el servicio en primer plano con notificación visible
                    LocationForegroundService.startTracking(
                        getApplication(),
                        jornada.id,
                        vendedorId
                    )
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            mensajeFeedback = "Jornada iniciada exitosamente."
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            mensajeFeedback = "Error al iniciar jornada: ${error.localizedMessage}"
                        )
                    }
                }
            )
        }
    }

    /**
     * Finaliza la jornada activa mediante ShiftRepository y detiene el Foreground Service.
     */
    fun finalizarJornada() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, mensajeFeedback = null) }

            val jornadaActiva = _uiState.value.activeJornada
            if (jornadaActiva == null) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        mensajeFeedback = "No hay ninguna jornada activa para finalizar."
                    )
                }
                return@launch
            }

            val totalPuntos = _uiState.value.totalPuntosLocales
            val result = shiftRepository.endShift(jornadaActiva.id, totalPuntos)

            result.fold(
                onSuccess = {
                    // Detener el servicio en primer plano
                    LocationForegroundService.stopTracking(getApplication())
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            mensajeFeedback = "Jornada finalizada correctamente."
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            mensajeFeedback = "Error al finalizar jornada: ${error.localizedMessage}"
                        )
                    }
                }
            )
        }
    }

    fun limpiarMensajeFeedback() {
        _uiState.update { it.copy(mensajeFeedback = null) }
    }
}
