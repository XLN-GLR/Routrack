package com.empresa.routrack.ui.tracking

import android.Manifest
import android.app.Application
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.empresa.routrack.data.local.entity.JornadaEntity
import com.empresa.routrack.data.repository.RepositoryProvider
import com.empresa.routrack.data.repository.ShiftRepository
import com.empresa.routrack.data.repository.TrackingRepository
import com.empresa.routrack.service.LocationForegroundService
import com.routrack.mobile.data.repository.SyncRepository
import com.routrack.mobile.workers.SyncScheduler
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.Job
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
    val gpsDiagnosticMessage: String? = null,
    val pendingSyncCount: Int = 0,
    val syncStatusMessage: String? = null,
    val isSyncing: Boolean = false,
    val isLoading: Boolean = false,
    val mensajeFeedback: String? = null
)

/**
 * ViewModel para la gestión de turnos laborales, servicio de localización,
 * diagnóstico de conectividad y métricas de telemetría local.
 *
 * Desacoplado enteramente de la persistencia directa de Room mediante ShiftRepository,
 * TrackingRepository y SyncRepository.
 */
class TrackingViewModel @JvmOverloads constructor(
    application: Application,
    private val shiftRepository: ShiftRepository = RepositoryProvider.getShiftRepository(application),
    private val trackingRepository: TrackingRepository = RepositoryProvider.getTrackingRepository(application),
    private val syncRepository: SyncRepository = RepositoryProvider.getSyncRepository(application)
) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(TrackingUiState())
    val uiState: StateFlow<TrackingUiState> = _uiState.asStateFlow()

    private var telemetryJob: Job? = null
    private var observedJornadaId: String? = null

    private val trackingExceptionHandler = CoroutineExceptionHandler { _, throwable ->
        android.util.Log.e("TrackingViewModel", "Excepción no capturada en corrutina de telemetría", throwable)
    }

    init {
        observarJornadaYTelemetria()
        refrescarPendientesSincronizacion()
    }

    private fun hasLocationPermission(): Boolean {
        val ctx = getApplication<Application>()
        val fine = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    private fun observarJornadaYTelemetria() {
        viewModelScope.launch(trackingExceptionHandler) {
            try {
                shiftRepository.observeActiveShift().collect { jornada ->
                    _uiState.update { current ->
                        current.copy(
                            activeJornada = jornada,
                            isTrackingActive = jornada != null
                        )
                    }

                    if (jornada != null) {
                        // Si la jornada existía activa en Room pero el servicio Android se había detenido, reanudarlo
                        if (!LocationForegroundService.isTracking.value && hasLocationPermission()) {
                            LocationForegroundService.startTracking(
                                getApplication(),
                                jornada.id,
                                jornada.vendedorId
                            )
                            SyncScheduler.schedulePeriodicSync(getApplication())
                        }
                        if (observedJornadaId != jornada.id) {
                            observedJornadaId = jornada.id
                            observarTelemetriaDeJornada(jornada.id)
                        }
                    } else {
                        observedJornadaId = null
                        telemetryJob?.cancel()
                        telemetryJob = null
                        _uiState.update { current ->
                            current.copy(
                                totalPuntosLocales = 0,
                                ultimaLatitud = null,
                                ultimaLongitud = null,
                                ultimaPrecision = null,
                                ultimoTimestamp = null
                            )
                        }
                    }
                    refrescarPendientesSincronizacion()
                }
            } catch (e: Throwable) {
                android.util.Log.e("TrackingViewModel", "Error al observar flujo de turno activo", e)
            }
        }

        // Observar coordenadas en vivo reportadas por el Foreground Service
        viewModelScope.launch(trackingExceptionHandler) {
            try {
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
            } catch (e: Throwable) {
                android.util.Log.e("TrackingViewModel", "Error al observar flujo de coordenadas en vivo", e)
            }
        }

        // Observar mensajes diagnósticos del servicio GPS
        viewModelScope.launch(trackingExceptionHandler) {
            try {
                LocationForegroundService.locationDiagnostic.collect { diag ->
                    _uiState.update { it.copy(gpsDiagnosticMessage = diag) }
                }
            } catch (_: Throwable) {
            }
        }
    }

    private fun observarTelemetriaDeJornada(jornadaId: String) {
        telemetryJob?.cancel()
        telemetryJob = viewModelScope.launch(trackingExceptionHandler) {
            launch {
                try {
                    trackingRepository.observeLocationCount(jornadaId).collect { count ->
                        _uiState.update { it.copy(totalPuntosLocales = count) }
                        refrescarPendientesSincronizacion()
                    }
                } catch (e: Throwable) {
                    android.util.Log.e("TrackingViewModel", "Error al observar conteo de puntos para $jornadaId", e)
                }
            }

            launch {
                try {
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
                } catch (e: Throwable) {
                    android.util.Log.e("TrackingViewModel", "Error al observar última ubicación para $jornadaId", e)
                }
            }
        }
    }

    /**
     * Reanuda automáticamente el servicio GPS en primer plano cuando el usuario otorga los permisos
     * si existía una jornada abierta previamente en Room.
     */
    fun reanudarServicioSiActivo() {
        val jornada = _uiState.value.activeJornada ?: return
        if (!LocationForegroundService.isTracking.value && hasLocationPermission()) {
            LocationForegroundService.startTracking(
                getApplication(),
                jornada.id,
                jornada.vendedorId
            )
            try {
                SyncScheduler.schedulePeriodicSync(getApplication())
            } catch (_: Throwable) {
            }
        }
    }

    /**
     * Inicia una nueva jornada laboral a través del ShiftRepository y arranca el
     * LocationForegroundService con notificación obligatoria visible.
     */
    fun iniciarJornada(vendedorId: String) {
        viewModelScope.launch(trackingExceptionHandler) {
            _uiState.update { it.copy(isLoading = true, mensajeFeedback = null) }

            try {
                val result = shiftRepository.startShift(vendedorId)
                result.fold(
                    onSuccess = { jornada ->
                        LocationForegroundService.startTracking(
                            getApplication(),
                            jornada.id,
                            vendedorId
                        )
                        try {
                            SyncScheduler.schedulePeriodicSync(getApplication())
                            SyncScheduler.enqueueImmediateSync(getApplication())
                        } catch (_: Throwable) {
                        }
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                mensajeFeedback = "Jornada iniciada. Buscando señal y sincronizando..."
                            )
                        }
                        ejecutarSincronizacionInmediata(silencioso = true)
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
            } catch (e: Throwable) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        mensajeFeedback = "Error inesperado al iniciar jornada: ${e.localizedMessage}"
                    )
                }
            }
        }
    }

    /**
     * Finaliza la jornada activa mediante ShiftRepository y detiene el Foreground Service.
     */
    fun finalizarJornada() {
        viewModelScope.launch(trackingExceptionHandler) {
            _uiState.update { it.copy(isLoading = true, mensajeFeedback = null) }

            try {
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
                        // Detener el servicio en primer plano inmediatamente (cumplimiento LOPDP)
                        LocationForegroundService.stopTracking(getApplication())
                        try {
                            SyncScheduler.enqueueImmediateSync(getApplication())
                        } catch (_: Throwable) {
                        }
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                mensajeFeedback = "Jornada finalizada correctamente."
                            )
                        }
                        ejecutarSincronizacionInmediata(silencioso = true)
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
            } catch (e: Throwable) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        mensajeFeedback = "Error inesperado al finalizar jornada: ${e.localizedMessage}"
                    )
                }
            }
        }
    }

    /**
     * Dispara una sincronización manual bajo demanda con retroalimentación directa en pantalla.
     */
    fun sincronizarAhora() {
        viewModelScope.launch(trackingExceptionHandler) {
            ejecutarSincronizacionInmediata(silencioso = false)
        }
    }

    private suspend fun ejecutarSincronizacionInmediata(silencioso: Boolean) {
        if (_uiState.value.isSyncing) return
        _uiState.update { it.copy(isSyncing = true, syncStatusMessage = "Sincronizando con Supabase...") }

        try {
            val result = syncRepository.syncPendingBatch(100)
            val pendingAfter = syncRepository.getPendingCount()
            result.fold(
                onSuccess = { batch ->
                    val statusMsg = if (batch.totalRecordsSynced > 0) {
                        "Enviado a la nube (${batch.pointsSynced} pts)"
                    } else {
                        batch.message
                    }
                    _uiState.update {
                        it.copy(
                            isSyncing = false,
                            pendingSyncCount = pendingAfter,
                            syncStatusMessage = statusMsg,
                            mensajeFeedback = if (!silencioso) statusMsg else it.mensajeFeedback
                        )
                    }
                },
                onFailure = { err ->
                    val errMsg = err.localizedMessage ?: "Error de sincronización"
                    _uiState.update {
                        it.copy(
                            isSyncing = false,
                            pendingSyncCount = pendingAfter,
                            syncStatusMessage = "Pendiente: $errMsg",
                            mensajeFeedback = if (!silencioso) "Aviso de sincronización: $errMsg" else it.mensajeFeedback
                        )
                    }
                }
            )
        } catch (t: Throwable) {
            _uiState.update {
                it.copy(
                    isSyncing = false,
                    syncStatusMessage = "Sin conexión al servidor: ${t.localizedMessage}"
                )
            }
        }
    }

    private fun refrescarPendientesSincronizacion() {
        viewModelScope.launch(trackingExceptionHandler) {
            try {
                val count = syncRepository.getPendingCount()
                _uiState.update { it.copy(pendingSyncCount = count) }
            } catch (_: Throwable) {
            }
        }
    }

    fun limpiarMensajeFeedback() {
        _uiState.update { it.copy(mensajeFeedback = null) }
    }
}
