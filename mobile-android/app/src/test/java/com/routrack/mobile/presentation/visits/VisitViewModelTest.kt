package com.routrack.mobile.presentation.visits

import com.empresa.routrack.data.local.entity.JornadaEntity
import com.empresa.routrack.data.local.entity.VisitaEntity
import com.empresa.routrack.data.repository.ShiftRepository
import com.empresa.routrack.data.repository.VisitRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Suite de pruebas unitarias para VisitViewModel y el flujo móvil de visitas comerciales (TASK-018).
 *
 * Valida de forma rigurosa los tres criterios de aceptación:
 *  1. Check-in asíncrono no bloqueante con captura GPS de alta precisión y evaluación de geocerca.
 *  2. Formulario de compromisos comerciales y precios pactados valida montos válidos.
 *  3. Persistencia local inmediata en Room con estado PENDING (sincronizado = false).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class VisitViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    // Mocks manuales reproducibles en entorno unitario
    private lateinit var fakeVisitRepository: FakeVisitRepository
    private lateinit var fakeShiftRepository: FakeShiftRepository
    private lateinit var fakeLocationProvider: FakeLocationProvider

    private val testClient = AssignedClient(
        id = "client-001",
        nombre = "Supermaxi El Jardín",
        nombreComercial = "El Jardín",
        identificacionFiscal = "1790016919001",
        direccion = "Av. Amazonas y República",
        telefono = "02-2980-000",
        latitud = -0.190123,
        longitud = -78.487654,
        radioToleranciaMetros = 50
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        fakeVisitRepository = FakeVisitRepository()
        fakeShiftRepository = FakeShiftRepository()
        fakeLocationProvider = FakeLocationProvider(
            latitude = -0.190130, // ~2 metros de distancia (Dentro de geocerca)
            longitude = -78.487660,
            accuracy = 4.5f
        )
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun createViewModel(): VisitViewModel {
        return VisitViewModel(
            visitRepository = fakeVisitRepository,
            shiftRepository = fakeShiftRepository,
            locationProvider = fakeLocationProvider,
            currentShiftIdProvider = { "shift-test-123" },
            currentSellerIdProvider = { "seller-test-456" },
            ioDispatcher = testDispatcher
        )
    }

    // -------------------------------------------------------------------------
    // GRUPO 1: VALIDACIÓN DE PRECIOS PACTADOS Y MONTOS (CRITERIO 2)
    // -------------------------------------------------------------------------

    @Test
    fun `validateCommercialAgreement aprueba producto con precio y cantidad validos`() {
        val vm = createViewModel()
        val result = vm.validateCommercialAgreement(
            productName = "Aceite de Girasol 1L",
            quantityText = "12",
            unitPriceText = "2.75",
            discountText = "5.0"
        )
        assertTrue(result is AgreementValidationResult.Valid)
    }

    @Test
    fun `validateCommercialAgreement rechaza cantidad igual a cero o negativa`() {
        val vm = createViewModel()
        val zeroResult = vm.validateCommercialAgreement(
            productName = "Arroz 5kg",
            quantityText = "0",
            unitPriceText = "4.50"
        )
        assertTrue(zeroResult is AgreementValidationResult.Invalid)

        val negativeResult = vm.validateCommercialAgreement(
            productName = "Arroz 5kg",
            quantityText = "-3",
            unitPriceText = "4.50"
        )
        assertTrue(negativeResult is AgreementValidationResult.Invalid)
    }

    @Test
    fun `validateCommercialAgreement rechaza precio unitario igual a cero o negativo`() {
        val vm = createViewModel()
        val zeroPrice = vm.validateCommercialAgreement(
            productName = "Azúcar 1kg",
            quantityText = "10",
            unitPriceText = "0.0"
        )
        assertTrue(zeroPrice is AgreementValidationResult.Invalid)

        val negativePrice = vm.validateCommercialAgreement(
            productName = "Azúcar 1kg",
            quantityText = "10",
            unitPriceText = "-1.25"
        )
        assertTrue(negativePrice is AgreementValidationResult.Invalid)
    }

    @Test
    fun `validateCommercialAgreement rechaza descuento superior al 100 por ciento`() {
        val vm = createViewModel()
        val invalidDiscount = vm.validateCommercialAgreement(
            productName = "Atún 180g",
            quantityText = "24",
            unitPriceText = "1.50",
            discountText = "105.0"
        )
        assertTrue(invalidDiscount is AgreementValidationResult.Invalid)
    }

    @Test
    fun `CommercialAgreement calcula subtotal con y sin descuento con precision`() {
        val noDiscount = CommercialAgreement(
            productName = "Harina 1kg",
            quantity = 10,
            agreedUnitPrice = 1.20,
            discountPercentage = 0.0
        )
        assertEquals(12.0, noDiscount.subtotal, 0.001)

        val withDiscount = CommercialAgreement(
            productName = "Harina 1kg",
            quantity = 10,
            agreedUnitPrice = 1.20,
            discountPercentage = 10.0 // 10% desc -> 12.0 - 1.20 = 10.80
        )
        assertEquals(10.80, withDiscount.subtotal, 0.001)
    }

    // -------------------------------------------------------------------------
    // GRUPO 2: CHECK-IN NO BLOQUEANTE Y CLASIFICACIÓN DE GEOCERCA (CRITERIO 1)
    // -------------------------------------------------------------------------

    @Test
    fun `performCheckIn clasifica como VERIFIED cuando el vendedor esta dentro del radio`() = runTest(testDispatcher) {
        val vm = createViewModel()
        // El fake provider está a ~2m del cliente (tolerancia es 50m)
        vm.performCheckIn(testClient)
        testDispatcher.scheduler.advanceUntilIdle()

        val state = vm.uiState.value
        assertTrue(state is VisitUiState.ActiveVisit)
        val active = state as VisitUiState.ActiveVisit
        assertEquals(VisitaEntity.ESTADO_VERIFICADA, active.geofenceStatus)
        assertTrue(active.isVerifiedGeofence)
        assertTrue(active.distanceToClientMeters <= testClient.radioToleranciaMetros)
    }

    @Test
    fun `performCheckIn clasifica como OUT_OF_RANGE cuando el vendedor esta a mas de 50 metros`() = runTest(testDispatcher) {
        // Posicionar al vendedor a ~200 metros de distancia
        fakeLocationProvider.currentLat = -0.192000
        fakeLocationProvider.currentLng = -78.489000

        val vm = createViewModel()
        vm.performCheckIn(testClient)
        testDispatcher.scheduler.advanceUntilIdle()

        val state = vm.uiState.value
        assertTrue(state is VisitUiState.ActiveVisit)
        val active = state as VisitUiState.ActiveVisit
        assertEquals(VisitaEntity.ESTADO_FUERA_DE_RANGO, active.geofenceStatus)
        assertFalse(active.isVerifiedGeofence)
        assertTrue(active.distanceToClientMeters > testClient.radioToleranciaMetros)
    }

    // -------------------------------------------------------------------------
    // GRUPO 3: PERSISTENCIA EN ROOM CON ESTADO PENDING (CRITERIO 3)
    // -------------------------------------------------------------------------

    @Test
    fun `performCheckIn persiste inmediatamente en Room con sincronizado false`() = runTest(testDispatcher) {
        val vm = createViewModel()
        vm.performCheckIn(testClient)
        testDispatcher.scheduler.advanceUntilIdle()

        val savedVisits = fakeVisitRepository.savedVisits
        assertEquals(1, savedVisits.size)
        val visita = savedVisits.first()

        assertEquals("shift-test-123", visita.jornadaId)
        assertEquals(testClient.id, visita.clienteId)
        assertEquals("seller-test-456", visita.vendedorId)
        assertFalse("El registro debe persistirse con sincronizado = false (PENDING)", visita.sincronizado)
    }

    @Test
    fun `performCheckOut consolida acuerdos y persiste en Room conservando sincronizado false`() = runTest(testDispatcher) {
        val vm = createViewModel()
        vm.performCheckIn(testClient)
        testDispatcher.scheduler.advanceUntilIdle()

        // Agregar dos acuerdos comerciales
        vm.addCommercialAgreement("Aceite 1L", 10, 2.50, 0.0) // 25.0
        vm.addCommercialAgreement("Atun 180g", 20, 1.50, 10.0) // 27.0
        vm.onObservationsChanged("Recepción normal, pedido despachar lunes.")
        vm.onPromisedDateChanged("2026-11-15")

        // Finalizar visita
        vm.performCheckOut()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = vm.uiState.value
        assertTrue(state is VisitUiState.Completed)
        val completed = state as VisitUiState.Completed
        assertEquals(52.0, completed.totalAmount, 0.01)
        assertEquals(2, completed.totalAgreements)

        // Verificar persistencia en base de datos local Room
        val finalVisit = fakeVisitRepository.savedVisits.first()
        assertNotNull(finalVisit.checkOutTime)
        assertNotNull(finalVisit.acuerdosJson)
        assertEquals("Recepción normal, pedido despachar lunes.", finalVisit.observaciones)
        assertFalse("El registro de visita completada debe mantenerse en sincronizado = false (PENDING)", finalVisit.sincronizado)

        // Validar formato JSON estructurado
        val json = JSONObject(finalVisit.acuerdosJson!!)
        assertEquals(2, json.getJSONArray("agreements").length())
        assertEquals(52.0, json.getDouble("total_amount"), 0.01)
        assertEquals("2026-11-15", json.getString("promised_delivery_date"))
    }
}

// =============================================================================
// FAKES LIGEROS PARA PRUEBAS UNITARIAS DETERMINISTAS
// =============================================================================

class FakeLocationProvider(
    var currentLat: Double,
    var currentLng: Double,
    var accuracy: Float
) : HighAccuracyLocationProvider {
    override suspend fun getCurrentLocation(): LocationResult {
        return LocationResult(
            latitude = currentLat,
            longitude = currentLng,
            accuracyMeters = accuracy,
            isMock = false
        )
    }
}

class FakeVisitRepository : VisitRepository {
    val savedVisits = mutableListOf<VisitaEntity>()

    override fun observeVisitsForShift(shiftId: String): Flow<List<VisitaEntity>> {
        return flowOf(savedVisits.filter { it.jornadaId == shiftId })
    }

    override suspend fun getVisitsForShift(shiftId: String): List<VisitaEntity> {
        return savedVisits.filter { it.jornadaId == shiftId }
    }

    override suspend fun recordCheckIn(
        shiftId: String,
        clientId: String,
        sellerId: String,
        lat: Double,
        lng: Double,
        distanceMeters: Float,
        status: String,
        observations: String?
    ): Result<VisitaEntity> {
        val entity = VisitaEntity(
            id = "visit-${savedVisits.size + 1}",
            jornadaId = shiftId,
            clienteId = clientId,
            vendedorId = sellerId,
            checkInTime = System.currentTimeMillis(),
            checkOutTime = null,
            checkInLat = lat,
            checkInLng = lng,
            checkOutLat = null,
            checkOutLng = null,
            distanciaClienteMetros = distanceMeters,
            estado = status,
            observaciones = observations,
            acuerdosJson = null,
            sincronizado = false // PENDING
        )
        savedVisits.add(entity)
        return Result.success(entity)
    }

    override suspend fun recordCheckOut(
        visitId: String,
        lat: Double,
        lng: Double,
        observations: String?,
        agreementsJson: String?
    ): Result<VisitaEntity> {
        val index = savedVisits.indexOfFirst { it.id == visitId }
        if (index == -1) return Result.failure(IllegalArgumentException("Visita no encontrada"))

        val existing = savedVisits[index]
        val updated = existing.copy(
            checkOutTime = System.currentTimeMillis(),
            checkOutLat = lat,
            checkOutLng = lng,
            observaciones = observations,
            acuerdosJson = agreementsJson,
            sincronizado = false // PENDING
        )
        savedVisits[index] = updated
        return Result.success(updated)
    }

    override suspend fun getPendingSyncVisits(limit: Int): List<VisitaEntity> {
        return savedVisits.filter { !it.sincronizado }.take(limit)
    }

    override suspend fun markVisitsAsSynced(ids: List<String>): Result<Unit> {
        val idSet = ids.toSet()
        savedVisits.replaceAll { if (it.id in idSet) it.copy(sincronizado = true) else it }
        return Result.success(Unit)
    }
}

class FakeShiftRepository : ShiftRepository {
    private var activeShift: JornadaEntity? = JornadaEntity(
        id = "shift-test-123",
        vendedorId = "seller-test-456",
        fechaInicio = System.currentTimeMillis(),
        estado = JornadaEntity.ESTADO_ABIERTA,
        ubicacionInicioLat = -0.180653,
        ubicacionInicioLng = -78.467834
    )

    override fun observeActiveShift(): Flow<JornadaEntity?> = flowOf(activeShift)
    override suspend fun getActiveShift(): JornadaEntity? = activeShift
    override suspend fun startShift(sellerId: String, lat: Double, lng: Double, batteryLevel: Int?): Result<JornadaEntity> = Result.success(activeShift!!)
    override suspend fun endShift(shiftId: String, lat: Double, lng: Double, batteryLevel: Int?, totalDistanceKm: Double): Result<JornadaEntity> = Result.success(activeShift!!)
    override suspend fun getShiftById(shiftId: String): JornadaEntity? = if (activeShift?.id == shiftId) activeShift else null
    override suspend fun getAllShifts(): List<JornadaEntity> = listOfNotNull(activeShift)
    override suspend fun updateShift(shift: JornadaEntity): Result<Unit> { activeShift = shift; return Result.success(Unit) }
}

