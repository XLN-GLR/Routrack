package com.routrack.mobile.presentation.visits

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.empresa.routrack.data.local.entity.VisitaEntity
import com.empresa.routrack.data.network.SupabaseClientProvider
import com.empresa.routrack.data.repository.ShiftRepository
import com.empresa.routrack.data.repository.VisitRepository
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.json.JSONArray
import org.json.JSONObject
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.UUID
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

// =============================================================================
// MODELOS DE DOMINIO INMUTABLES PARA VISITAS COMERCIALES
// =============================================================================

/**
 * Cliente asignado a la cartera del vendedor para la jornada comercial.
 */
data class AssignedClient(
    val id: String,
    val nombre: String,
    val nombreComercial: String?,
    val identificacionFiscal: String,
    val direccion: String,
    val telefono: String?,
    val latitud: Double,
    val longitud: Double,
    val radioToleranciaMetros: Int = 50,
    val visitadoHoy: Boolean = false,
    val ultimaVisitaId: String? = null
)

/**
 * DTO para la deserialización de clientes desde la tabla remota de Supabase.
 */
@Serializable
data class RemoteClientDto(
    val id: String,
    val nombre: String,
    @SerialName("nombre_comercial") val nombreComercial: String? = null,
    @SerialName("identificacion_fiscal") val identificacionFiscal: String? = null,
    val direccion: String,
    val telefono: String? = null,
    @SerialName("radio_tolerancia_metros") val radioToleranciaMetros: Int? = 50,
    val activo: Boolean? = true,
    val ubicacion: JsonElement? = null
)

/**
 * Acuerdo comercial de precio pactado para una línea de producto / SKU.
 */
data class CommercialAgreement(
    val id: String = UUID.randomUUID().toString(),
    val productName: String,
    val quantity: Int,
    val agreedUnitPrice: Double,
    val discountPercentage: Double = 0.0
) {
    /**
     * Subtotal calculado aplicando el porcentaje de descuento pactado.
     */
    val subtotal: Double
        get() {
            val base = quantity * agreedUnitPrice
            val discount = base * (discountPercentage / 100.0)
            return (base - discount).coerceAtLeast(0.0)
        }
}

/**
 * Resultado de validación del formulario de precios pactados.
 */
sealed class AgreementValidationResult {
    object Valid : AgreementValidationResult()
    data class Invalid(val message: String) : AgreementValidationResult()
}

/**
 * Proveedor funcional de coordenadas geográficas de alta precisión.
 */
fun interface HighAccuracyLocationProvider {
    suspend fun getCurrentLocation(): LocationResult
}

data class LocationResult(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Float,
    val isMock: Boolean = false
)

// =============================================================================
// ESTADOS DE LA INTERFAZ DE USUARIO (STATEFLOW)
// =============================================================================

sealed interface VisitUiState {
    /**
     * Lista de clientes asignados para selección e inicio de check-in.
     */
    data class ClientList(
        val clients: List<AssignedClient>,
        val searchQuery: String = "",
        val filterOnlyPending: Boolean = false,
        val isLocating: Boolean = false,
        val userLocation: LocationResult? = null,
        val errorMessage: String? = null
    ) : VisitUiState

    /**
     * Check-in activo en el establecimiento de un cliente comercial.
     */
    data class ActiveVisit(
        val visitId: String,
        val shiftId: String,
        val sellerId: String,
        val client: AssignedClient,
        val checkInTime: Long,
        val checkInLat: Double,
        val checkInLng: Double,
        val distanceToClientMeters: Float,
        val geofenceStatus: String, // VERIFIED o OUT_OF_RANGE
        val agreements: List<CommercialAgreement> = emptyList(),
        val observations: String = "",
        val promisedDeliveryDate: String = "",
        val stockNotes: String = "",
        val isCompleting: Boolean = false,
        val elapsedSeconds: Long = 0L,
        val errorMessage: String? = null
    ) : VisitUiState {
        val totalAmount: Double
            get() = agreements.sumOf { it.subtotal }

        val isVerifiedGeofence: Boolean
            get() = geofenceStatus == VisitaEntity.ESTADO_VERIFICADA
    }

    /**
     * Visita completada exitosamente y persistida en Room (PENDING para sincronización).
     */
    data class Completed(
        val visitId: String,
        val clientName: String,
        val durationSeconds: Long,
        val totalAmount: Double,
        val totalAgreements: Int,
        val geofenceStatus: String
    ) : VisitUiState
}

// =============================================================================
// VIEWMODEL DE GESTIÓN Y CHECK-IN DE VISITAS COMERCIALES
// =============================================================================

/**
 * ViewModel que orquesta el ciclo de vida de visitas en campo conforme a los
 * 3 criterios de aceptación de TASK-018:
 *
 * 1. Check-in asíncrono no bloqueante con captura GPS de alta precisión.
 * 2. Validación estricta de compromisos comerciales y precios pactados (montos > 0).
 * 3. Persistencia local inmediata en Room con estado `PENDING` (sincronizado = false).
 */
class VisitViewModel(
    private val visitRepository: VisitRepository,
    private val shiftRepository: ShiftRepository,
    private val locationProvider: HighAccuracyLocationProvider,
    private val currentShiftIdProvider: () -> String? = { null },
    private val currentSellerIdProvider: () -> String? = { null },
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : ViewModel() {

    // Cartera de clientes base para la fuerza de venta (Quito, Ecuador)
    private val defaultAssignedClients = listOf(
        AssignedClient(
            id = "c1000000-0000-0000-0000-000000000001",
            nombre = "Corporación Favorita C.A.",
            nombreComercial = "Supermaxi El Jardín",
            identificacionFiscal = "1790016919001",
            direccion = "Av. Amazonas N24-196 y Av. República, Quito",
            telefono = "02-2980-000",
            latitud = -0.190123,
            longitud = -78.487654,
            radioToleranciaMetros = 60
        ),
        AssignedClient(
            id = "c1000000-0000-0000-0000-000000000002",
            nombre = "Tiendas Industriales Asociadas TIA S.A.",
            nombreComercial = "Tía La Mariscal",
            identificacionFiscal = "0990011234001",
            direccion = "Calle Juan León Mera N22-34 y Mariscal Foch, Quito",
            telefono = "02-2554-123",
            latitud = -0.203456,
            longitud = -78.491234,
            radioToleranciaMetros = 40
        ),
        AssignedClient(
            id = "c1000000-0000-0000-0000-000000000003",
            nombre = "Comercial de Ferreterías Kywi S.A.",
            nombreComercial = "Kywi El Inca",
            identificacionFiscal = "1790034567001",
            direccion = "Av. El Inca E4-120 y Av. 6 de Diciembre, Quito",
            telefono = "02-2245-890",
            latitud = -0.165432,
            longitud = -78.472109,
            radioToleranciaMetros = 75
        ),
        AssignedClient(
            id = "c1000000-0000-0000-0000-000000000005",
            nombre = "Farmacias y Droguerías Fybeca S.A.",
            nombreComercial = "Fybeca San Rafael",
            identificacionFiscal = "1790056789001",
            direccion = "Av. General Rumiñahui e Isla Genovesa, Valle de los Chillos",
            telefono = "02-2865-432",
            latitud = -0.298765,
            longitud = -78.456789,
            radioToleranciaMetros = 50
        )
    )

    private var loadedClients: List<AssignedClient> = defaultAssignedClients

    private val _uiState = MutableStateFlow<VisitUiState>(
        VisitUiState.ClientList(clients = defaultAssignedClients)
    )
    val uiState: StateFlow<VisitUiState> = _uiState.asStateFlow()

    init {
        refreshVisitedStatus()
        startElapsedTimer()
    }

    fun refreshClients() {
        refreshVisitedStatus()
    }

    // -------------------------------------------------------------------------
    // BÚSQUEDA Y FILTRADO DE CLIENTES ASIGNADOS
    // -------------------------------------------------------------------------

    fun onSearchQueryChanged(query: String) {
        _uiState.update { current ->
            if (current is VisitUiState.ClientList) {
                current.copy(searchQuery = query)
            } else current
        }
    }

    fun onTogglePendingFilter() {
        _uiState.update { current ->
            if (current is VisitUiState.ClientList) {
                current.copy(filterOnlyPending = !current.filterOnlyPending)
            } else current
        }
    }

    // -------------------------------------------------------------------------
    // CRITERIO 1: CHECK-IN NO BLOQUEANTE CON CAPTURA GPS DE ALTA PRECISIÓN
    // -------------------------------------------------------------------------

    /**
     * Inicia el flujo de check-in en segundo plano (`Dispatchers.IO`), capturando
     * coordenadas de alta precisión y evaluando geocerca sin congelar la UI.
     */
    fun performCheckIn(client: AssignedClient) {
        val currentState = _uiState.value
        if (currentState is VisitUiState.ClientList) {
            _uiState.value = currentState.copy(isLocating = true, errorMessage = null)
        }

        viewModelScope.launch {
            try {
                // 1. Obtención asíncrona de coordenadas GPS de alta precisión
                val location = withContext(ioDispatcher) {
                    locationProvider.getCurrentLocation()
                }

                // 2. Determinar jornada activa y vendedor
                val shiftId = withContext(ioDispatcher) {
                    currentShiftIdProvider()
                        ?: shiftRepository.getActiveShift()?.id
                        ?: UUID.randomUUID().toString()
                }
                val sellerId = currentSellerIdProvider() ?: "vendedor-local-01"

                // 3. Cálculo de distancia geodésica Haversine al cliente
                val distanceMeters = calculateDistanceMeters(
                    lat1 = location.latitude,
                    lon1 = location.longitude,
                    lat2 = client.latitud,
                    lon2 = client.longitud
                )

                // 4. Clasificación de geocerca (VERIFIED vs OUT_OF_RANGE)
                val geofenceStatus = if (distanceMeters <= client.radioToleranciaMetros) {
                    VisitaEntity.ESTADO_VERIFICADA
                } else {
                    VisitaEntity.ESTADO_FUERA_DE_RANGO
                }

                // 5. CRITERIO 3: Persistencia local inmediata en Room con estado PENDING (sincronizado = false)
                val recordResult = withContext(ioDispatcher) {
                    visitRepository.recordCheckIn(
                        shiftId = shiftId,
                        clientId = client.id,
                        sellerId = sellerId,
                        lat = location.latitude,
                        lng = location.longitude,
                        distanceMeters = distanceMeters,
                        status = geofenceStatus,
                        observations = null
                    )
                }

                recordResult.fold(
                    onSuccess = { visita ->
                        _uiState.value = VisitUiState.ActiveVisit(
                            visitId = visita.id,
                            shiftId = shiftId,
                            sellerId = sellerId,
                            client = client,
                            checkInTime = visita.checkInTime,
                            checkInLat = location.latitude,
                            checkInLng = location.longitude,
                            distanceToClientMeters = distanceMeters,
                            geofenceStatus = geofenceStatus,
                            agreements = emptyList(),
                            observations = "",
                            elapsedSeconds = 0L
                        )
                    },
                    onFailure = { error ->
                        resetToClientListWithError("Fallo al registrar check-in: ${error.message}")
                    }
                )
            } catch (e: Exception) {
                resetToClientListWithError("Error al capturar ubicación para check-in: ${e.message}")
            }
        }
    }

    // -------------------------------------------------------------------------
    // CRITERIO 2: GESTIÓN Y VALIDACIÓN ESTRICTA DE PRECIOS PACTADOS
    // -------------------------------------------------------------------------

    /**
     * Valida cuantitativamente los valores de un acuerdo comercial:
     * - Nombre no vacío
     * - Cantidad entera mayor a 0
     * - Precio unitario pactado estrictamente mayor a 0.0
     * - Descuento entre 0% y 100%
     */
    fun validateCommercialAgreement(
        productName: String,
        quantityText: String,
        unitPriceText: String,
        discountText: String = "0"
    ): AgreementValidationResult {
        if (productName.trim().length < 2) {
            return AgreementValidationResult.Invalid("El nombre del producto debe contener al menos 2 caracteres.")
        }

        val quantity = quantityText.toIntOrNull()
        if (quantity == null || quantity <= 0) {
            return AgreementValidationResult.Invalid("La cantidad solicitada debe ser un número entero mayor a 0.")
        }

        val unitPrice = unitPriceText.toDoubleOrNull()
        if (unitPrice == null || unitPrice <= 0.0) {
            return AgreementValidationResult.Invalid("El precio pactado unitario debe ser un valor numérico mayor a 0.0.")
        }

        val discount = if (discountText.isBlank()) 0.0 else discountText.toDoubleOrNull()
        if (discount == null || discount < 0.0 || discount > 100.0) {
            return AgreementValidationResult.Invalid("El porcentaje de descuento debe encontrarse entre 0% y 100%.")
        }

        return AgreementValidationResult.Valid
    }

    /**
     * Agrega un acuerdo comercial validado a la visita activa.
     */
    fun addCommercialAgreement(
        productName: String,
        quantity: Int,
        unitPrice: Double,
        discountPercentage: Double = 0.0
    ): Boolean {
        val currentState = _uiState.value
        if (currentState !is VisitUiState.ActiveVisit) return false

        val validation = validateCommercialAgreement(
            productName = productName,
            quantityText = quantity.toString(),
            unitPriceText = unitPrice.toString(),
            discountText = discountPercentage.toString()
        )

        if (validation is AgreementValidationResult.Invalid) {
            _uiState.value = currentState.copy(errorMessage = validation.message)
            return false
        }

        val agreement = CommercialAgreement(
            productName = productName.trim(),
            quantity = quantity,
            agreedUnitPrice = unitPrice,
            discountPercentage = discountPercentage
        )

        _uiState.value = currentState.copy(
            agreements = currentState.agreements + agreement,
            errorMessage = null
        )
        return true
    }

    /**
     * Remueve un acuerdo comercial de la lista activa.
     */
    fun removeCommercialAgreement(agreementId: String) {
        val currentState = _uiState.value
        if (currentState is VisitUiState.ActiveVisit) {
            _uiState.value = currentState.copy(
                agreements = currentState.agreements.filterNot { it.id === agreementId || it.id == agreementId }
            )
        }
    }

    fun onObservationsChanged(newObservations: String) {
        val currentState = _uiState.value
        if (currentState is VisitUiState.ActiveVisit) {
            _uiState.value = currentState.copy(observations = newObservations)
        }
    }

    fun onPromisedDateChanged(newDate: String) {
        val currentState = _uiState.value
        if (currentState is VisitUiState.ActiveVisit) {
            _uiState.value = currentState.copy(promisedDeliveryDate = newDate)
        }
    }

    fun onStockNotesChanged(newNotes: String) {
        val currentState = _uiState.value
        if (currentState is VisitUiState.ActiveVisit) {
            _uiState.value = currentState.copy(stockNotes = newNotes)
        }
    }

    // -------------------------------------------------------------------------
    // CRITERIO 3: CHECK-OUT Y PERSISTENCIA ATÓMICA LOCAL EN ROOM (PENDING)
    // -------------------------------------------------------------------------

    /**
     * Finaliza la visita registrando coordenadas de salida, consolidando el JSON
     * estructurado de acuerdos de precios y persistiendo en Room con `sincronizado = false`.
     */
    fun performCheckOut() {
        val current = _uiState.value
        if (current !is VisitUiState.ActiveVisit) return

        _uiState.value = current.copy(isCompleting = true, errorMessage = null)

        viewModelScope.launch {
            try {
                // 1. Coordenadas de salida
                val outLocation = withContext(ioDispatcher) {
                    locationProvider.getCurrentLocation()
                }

                // 2. Serialización estructurada de acuerdos comerciales en JSON
                val agreementsJson = buildAgreementsJson(
                    agreements = current.agreements,
                    promisedDate = current.promisedDeliveryDate,
                    stockNotes = current.stockNotes,
                    totalAmount = current.totalAmount
                )

                // 3. Persistencia en Room con estado PENDING (sincronizado = false)
                val updateResult = withContext(ioDispatcher) {
                    visitRepository.recordCheckOut(
                        visitId = current.visitId,
                        lat = outLocation.latitude,
                        lng = outLocation.longitude,
                        observations = current.observations.ifBlank { null },
                        agreementsJson = agreementsJson
                    )
                }

                updateResult.fold(
                    onSuccess = {
                        _uiState.value = VisitUiState.Completed(
                            visitId = current.visitId,
                            clientName = current.client.nombre,
                            durationSeconds = current.elapsedSeconds,
                            totalAmount = current.totalAmount,
                            totalAgreements = current.agreements.size,
                            geofenceStatus = current.geofenceStatus
                        )
                    },
                    onFailure = { error ->
                        _uiState.value = current.copy(
                            isCompleting = false,
                            errorMessage = "Fallo al registrar check-out en Room: ${error.message}"
                        )
                    }
                )
            } catch (e: Exception) {
                _uiState.value = current.copy(
                    isCompleting = false,
                    errorMessage = "Error inesperado durante check-out: ${e.message}"
                )
            }
        }
    }

    /**
     * Cancela la visita en progreso descartando los cambios locales si el usuario lo requiere.
     */
    fun cancelActiveVisit() {
        refreshVisitedStatus()
    }

    fun dismissCompleted() {
        refreshVisitedStatus()
    }

    // -------------------------------------------------------------------------
    // HELPERS INTERNOS Y CÁLCULOS GEODÉSICOS
    // -------------------------------------------------------------------------

    private fun resetToClientListWithError(errorMessage: String) {
        val current = _uiState.value
        if (current is VisitUiState.ClientList) {
            _uiState.value = current.copy(isLocating = false, errorMessage = errorMessage)
        } else {
            _uiState.value = VisitUiState.ClientList(
                clients = loadedClients,
                errorMessage = errorMessage
            )
        }
    }

    private fun parseLocation(ubicacionElement: JsonElement?): Pair<Double, Double>? {
        if (ubicacionElement == null) return null
        return try {
            if (ubicacionElement is JsonPrimitive && ubicacionElement.isString) {
                val str = ubicacionElement.content
                // 1. Probar formato WKT: 'POINT(lng lat)' o 'SRID=4326;POINT(lng lat)'
                val regex = Regex("""POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)""", RegexOption.IGNORE_CASE)
                val match = regex.find(str)
                if (match != null) {
                    val lng = match.groupValues[1].toDoubleOrNull() ?: return null
                    val lat = match.groupValues[2].toDoubleOrNull() ?: return null
                    Pair(lat, lng)
                } else {
                    // 2. Probar formato PostGIS EWKB Hexadecimal (ej: 0101000020E6100000...)
                    parseEwkbHexPoint(str)
                }
            } else if (ubicacionElement is JsonObject) {
                val coords = ubicacionElement["coordinates"] as? JsonArray
                if (coords != null && coords.size >= 2) {
                    val lng = (coords[0] as? JsonPrimitive)?.content?.toDoubleOrNull() ?: return null
                    val lat = (coords[1] as? JsonPrimitive)?.content?.toDoubleOrNull() ?: return null
                    Pair(lat, lng)
                } else null
            } else null
        } catch (_: Throwable) {
            null
        }
    }

    private fun parseEwkbHexPoint(hex: String): Pair<Double, Double>? {
        val clean = hex.trim().lowercase()
        if (clean.length < 42) return null
        return try {
            val isLittleEndian = when {
                clean.startsWith("01") -> true
                clean.startsWith("00") -> false
                else -> return null
            }
            val xHex = if (clean.length >= 50) clean.substring(18, 34) else clean.substring(10, 26)
            val yHex = if (clean.length >= 50) clean.substring(34, 50) else clean.substring(26, 42)

            fun hexToDouble(h: String, littleEndian: Boolean): Double {
                val bytes = ByteArray(8)
                for (i in 0 until 8) {
                    bytes[i] = h.substring(i * 2, i * 2 + 2).toInt(16).toByte()
                }
                val buffer = ByteBuffer.wrap(bytes)
                buffer.order(if (littleEndian) ByteOrder.LITTLE_ENDIAN else ByteOrder.BIG_ENDIAN)
                return buffer.double
            }

            val lng = hexToDouble(xHex, isLittleEndian)
            val lat = hexToDouble(yHex, isLittleEndian)
            if (lat in -90.0..90.0 && lng in -180.0..180.0) {
                Pair(lat, lng)
            } else null
        } catch (_: Throwable) {
            null
        }
    }

    private fun refreshVisitedStatus() {
        viewModelScope.launch(ioDispatcher) {
            // 1. Sincronizar cartera de clientes en vivo desde Supabase
            try {
                val supabase = SupabaseClientProvider.postgrest
                val remoteRows = supabase.from("clientes")
                    .select {
                        filter {
                            eq("activo", true)
                        }
                    }
                    .decodeList<RemoteClientDto>()

                if (remoteRows.isNotEmpty()) {
                    val mapped = remoteRows.mapNotNull { dto ->
                        val (lat, lng) = parseLocation(dto.ubicacion) ?: return@mapNotNull null
                        AssignedClient(
                            id = dto.id,
                            nombre = dto.nombre,
                            nombreComercial = dto.nombreComercial,
                            identificacionFiscal = dto.identificacionFiscal ?: "",
                            direccion = dto.direccion,
                            telefono = dto.telefono,
                            latitud = lat,
                            longitud = lng,
                            radioToleranciaMetros = dto.radioToleranciaMetros ?: 50
                        )
                    }
                    if (mapped.isNotEmpty()) {
                        loadedClients = mapped
                        android.util.Log.i("VisitViewModel", "Sincronizados exitosamente ${mapped.size} clientes en vivo desde Supabase.")
                    }
                }
            } catch (t: Throwable) {
                android.util.Log.w("VisitViewModel", "Aviso: no se pudo sincronizar clientes desde Supabase, usando catálogo local", t)
            }

            // 2. Asociar visitas de la jornada actual
            val shiftId = currentShiftIdProvider() ?: shiftRepository.getActiveShift()?.id
            val visitedMap = if (shiftId != null) {
                val visits = visitRepository.getVisitsForShift(shiftId)
                visits.associateBy { it.clienteId }
            } else {
                emptyMap()
            }

            val updated = loadedClients.map { client ->
                val v = visitedMap[client.id]
                client.copy(
                    visitadoHoy = v != null,
                    ultimaVisitaId = v?.id
                )
            }

            _uiState.update { current ->
                if (current is VisitUiState.ClientList) {
                    current.copy(clients = updated)
                } else {
                    VisitUiState.ClientList(clients = updated)
                }
            }
        }
    }

    private fun startElapsedTimer() {
        viewModelScope.launch {
            while (true) {
                delay(1000)
                _uiState.update { current ->
                    if (current is VisitUiState.ActiveVisit && !current.isCompleting) {
                        current.copy(elapsedSeconds = current.elapsedSeconds + 1)
                    } else current
                }
            }
        }
    }

    companion object {
        private const val EARTH_RADIUS_METERS = 6371000.0

        /**
         * Cálculo geodésico Haversine exacto de distancia física entre dos puntos WGS84.
         */
        fun calculateDistanceMeters(
            lat1: Double,
            lon1: Double,
            lat2: Double,
            lon2: Double
        ): Float {
            val phi1 = Math.toRadians(lat1)
            val phi2 = Math.toRadians(lat2)
            val deltaPhi = Math.toRadians(lat2 - lat1)
            val deltaLambda = Math.toRadians(lon2 - lon1)

            val a = sin(deltaPhi / 2).pow(2.0) +
                    cos(phi1) * cos(phi2) * sin(deltaLambda / 2).pow(2.0)
            val c = 2 * atan2(sqrt(a), sqrt(1 - a))

            return (EARTH_RADIUS_METERS * c).toFloat()
        }

        /**
         * Serializa los compromisos comerciales a un objeto JSON estructurado.
         */
        fun buildAgreementsJson(
            agreements: List<CommercialAgreement>,
            promisedDate: String?,
            stockNotes: String?,
            totalAmount: Double
        ): String {
            val root = JSONObject()
            val agreementsArray = JSONArray()

            agreements.forEach { agreement ->
                val item = JSONObject()
                item.put("id", agreement.id)
                item.put("product_name", agreement.productName)
                item.put("quantity", agreement.quantity)
                item.put("agreed_unit_price", agreement.agreedUnitPrice)
                item.put("discount_percentage", agreement.discountPercentage)
                item.put("subtotal", agreement.subtotal)
                agreementsArray.put(item)
            }

            root.put("agreements", agreementsArray)
            root.put("total_amount", totalAmount)
            root.put("total_items", agreements.size)
            if (!promisedDate.isNullOrBlank()) {
                root.put("promised_delivery_date", promisedDate)
            }
            if (!stockNotes.isNullOrBlank()) {
                root.put("stock_notes", stockNotes)
            }

            return root.toString()
        }
    }
}

