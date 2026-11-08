package com.empresa.routrack.ui.tracking

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.empresa.routrack.data.crypto.AuditChainManager
import com.empresa.routrack.data.crypto.KeyStoreManager
import com.empresa.routrack.data.local.RoutrackDatabase
import com.empresa.routrack.data.local.entity.BitacoraAuditoriaEntity
import com.empresa.routrack.data.local.entity.JornadaEntity
import com.empresa.routrack.service.LocationForegroundService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

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
 */
class TrackingViewModel(application: Application) : AndroidViewModel(application) {

    private val keyStoreManager = KeyStoreManager.getInstance(application)
    private val passphrase = try {
        keyStoreManager.getDatabasePassphrase()
    } catch (_: Exception) {
        null
    }
    private val database = RoutrackDatabase.getInstance(application, passphrase)
    private val jornadaDao = database.jornadaDao()
    private val ubicacionDao = database.ubicacionGpsDao()
    private val auditoriaDao = database.bitacoraAuditoriaDao()

    private val _uiState = MutableStateFlow(TrackingUiState())
    val uiState: StateFlow<TrackingUiState> = _uiState.asStateFlow()

    init {
        observarJornadaYTelemetria()
    }

    private fun observarJornadaYTelemetria() {
        viewModelScope.launch {
            jornadaDao.observeJornadaActiva().collect { jornada ->
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
            ubicacionDao.observeTotalPuntosPorJornada(jornadaId).collect { count ->
                _uiState.update { it.copy(totalPuntosLocales = count) }
            }
        }

        viewModelScope.launch {
            ubicacionDao.observeUltimaUbicacion(jornadaId).collect { ultima ->
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
     * Inicia una nueva jornada laboral, registra el evento criptográfico en Room
     * y arranca el LocationForegroundService con notificación obligatoria visible.
     */
    fun iniciarJornada(vendedorId: String) {
        viewModelScope.launch(Dispatchers.IO) {
            _uiState.update { it.copy(isLoading = true, mensajeFeedback = null) }
            try {
                // Verificar si ya existe una jornada activa
                val activa = jornadaDao.getJornadaActiva()
                if (activa != null) {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            mensajeFeedback = "Ya existe una jornada activa en curso."
                        )
                    }
                    return@launch
                }

                val jornadaId = UUID.randomUUID().toString()
                val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
                val now = Date()

                val nuevaJornada = JornadaEntity(
                    id = jornadaId,
                    vendedorId = vendedorId,
                    fecha = dateFormat.format(now),
                    horaInicio = timeFormat.format(now),
                    horaFin = null,
                    estado = JornadaEntity.ESTADO_EN_CURSO,
                    sincronizado = false
                )

                // 1. Guardar jornada en Room
                jornadaDao.insert(nuevaJornada)

                // 2. Registrar evento inicial en bitácora con semilla criptográfica
                val secretKey = getAuditSecretKey()
                val seedHash = AuditChainManager.calculateInitialHash(jornadaId, secretKey)
                val initialEventHash = AuditChainManager.calculateHash(
                    tipoEvento = BitacoraAuditoriaEntity.EVENTO_JORNADA_INICIADA,
                    timestampEvento = now.time,
                    metadataJson = "{\"vendedorId\":\"$vendedorId\",\"inicio\":\"${nuevaJornada.horaInicio}\"}",
                    hashPrevio = seedHash,
                    secretKey = secretKey
                )

                val auditEntity = BitacoraAuditoriaEntity(
                    id = UUID.randomUUID().toString(),
                    jornadaId = jornadaId,
                    tipoEvento = BitacoraAuditoriaEntity.EVENTO_JORNADA_INICIADA,
                    metadataJson = "{\"vendedorId\":\"$vendedorId\",\"inicio\":\"${nuevaJornada.horaInicio}\"}",
                    timestampEvento = now.time,
                    hashPrevio = seedHash,
                    hashActual = initialEventHash,
                    sincronizado = false
                )
                auditoriaDao.insert(auditEntity)

                // 3. Iniciar el servicio en primer plano
                LocationForegroundService.startTracking(getApplication(), jornadaId, vendedorId)

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        mensajeFeedback = "Jornada iniciada exitosamente."
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        mensajeFeedback = "Error al iniciar jornada: ${e.localizedMessage}"
                    )
                }
            }
        }
    }

    /**
     * Finaliza la jornada activa, detiene el servicio en primer plano y encadena el evento de cierre.
     */
    fun finalizarJornada() {
        viewModelScope.launch(Dispatchers.IO) {
            _uiState.update { it.copy(isLoading = true, mensajeFeedback = null) }
            try {
                val activa = jornadaDao.getJornadaActiva()
                if (activa == null) {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            mensajeFeedback = "No hay ninguna jornada activa para finalizar."
                        )
                    }
                    return@launch
                }

                val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
                val now = Date()
                val horaFin = timeFormat.format(now)

                // 1. Actualizar jornada a FINALIZADA
                jornadaDao.finalizarJornada(activa.id, horaFin, JornadaEntity.ESTADO_FINALIZADA)

                // 2. Encadenar evento de fin de jornada en bitácora
                val secretKey = getAuditSecretKey()
                val ultimoEvento = auditoriaDao.getUltimoEventoPorJornada(activa.id)
                val hashPrevio = ultimoEvento?.hashActual
                    ?: AuditChainManager.calculateInitialHash(activa.id, secretKey)

                val hashActual = AuditChainManager.calculateHash(
                    tipoEvento = BitacoraAuditoriaEntity.EVENTO_JORNADA_FINALIZADA,
                    timestampEvento = now.time,
                    metadataJson = "{\"horaFin\":\"$horaFin\",\"totalPuntos\":${_uiState.value.totalPuntosLocales}}",
                    hashPrevio = hashPrevio,
                    secretKey = secretKey
                )

                val auditEntity = BitacoraAuditoriaEntity(
                    id = UUID.randomUUID().toString(),
                    jornadaId = activa.id,
                    tipoEvento = BitacoraAuditoriaEntity.EVENTO_JORNADA_FINALIZADA,
                    metadataJson = "{\"horaFin\":\"$horaFin\",\"totalPuntos\":${_uiState.value.totalPuntosLocales}}",
                    timestampEvento = now.time,
                    hashPrevio = hashPrevio,
                    hashActual = hashActual,
                    sincronizado = false
                )
                auditoriaDao.insert(auditEntity)

                // 3. Detener servicio en primer plano
                LocationForegroundService.stopTracking(getApplication())

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        mensajeFeedback = "Jornada finalizada correctamente."
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        mensajeFeedback = "Error al finalizar jornada: ${e.localizedMessage}"
                    )
                }
            }
        }
    }

    fun limpiarMensajeFeedback() {
        _uiState.update { it.copy(mensajeFeedback = null) }
    }

    private fun getAuditSecretKey(): ByteArray {
        return try {
            keyStoreManager.getDatabasePassphrase()
        } catch (_: Exception) {
            "ROUTRACK_LOCAL_DEFAULT_SECRET_KEY".toByteArray()
        }
    }
}
