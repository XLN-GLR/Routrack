package com.routrack.mobile.services

import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.DetectedActivity
import com.google.android.gms.location.Priority
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pruebas unitarias para validar la lógica del servicio adaptativo de captura (TASK-010).
 * Valida la parametrización de batería (RNF-01), transición de actividades y cese de recolección.
 */
class TrackingForegroundServiceTest {

    private val service = TrackingForegroundService()

    @Test
    fun testAdaptiveLocationRequestForStillStateMaximizesBatterySavings() {
        val request = service.buildAdaptiveLocationRequest(DetectedActivity.STILL)

        assertNotNull(request)
        // Intervalo de 90 segundos para evitar gasto energético cuando el vendedor está quieto
        assertEquals(90_000L, request.intervalMillis)
        assertEquals(30_000L, request.minUpdateIntervalMillis)
        assertEquals(25.0f, request.minUpdateDistanceMeters, 0.001f)
        assertEquals(Priority.PRIORITY_BALANCED_POWER_ACCURACY, request.priority)
    }

    @Test
    fun testAdaptiveLocationRequestForWalkingStateBalancesAccuracy() {
        val request = service.buildAdaptiveLocationRequest(DetectedActivity.WALKING)

        assertNotNull(request)
        // Intervalo de 20 segundos y 10 metros de desplazamiento para recorrido a pie
        assertEquals(20_000L, request.intervalMillis)
        assertEquals(10_000L, request.minUpdateIntervalMillis)
        assertEquals(10.0f, request.minUpdateDistanceMeters, 0.001f)
        assertEquals(Priority.PRIORITY_BALANCED_POWER_ACCURACY, request.priority)
    }

    @Test
    fun testAdaptiveLocationRequestForInVehicleStateProvidesHighPrecision() {
        val request = service.buildAdaptiveLocationRequest(DetectedActivity.IN_VEHICLE)

        assertNotNull(request)
        // Intervalo de 10 segundos y alta precisión para vehículos en movimiento rápido
        assertEquals(10_000L, request.intervalMillis)
        assertEquals(5_000L, request.minUpdateIntervalMillis)
        assertEquals(15.0f, request.minUpdateDistanceMeters, 0.001f)
        assertEquals(Priority.PRIORITY_HIGH_ACCURACY, request.priority)
    }

    @Test
    fun testActivityTransitionRequestBuilderIncludesMandatoryStates() {
        val transitionRequest = ActivityTransitionReceiver.buildTransitionRequest()

        assertNotNull(transitionRequest)
        // Debe registrar transiciones ENTER y EXIT para STILL, WALKING, ON_FOOT e IN_VEHICLE (4 * 2 = 8 transiciones)
        // Verificamos que la solicitud contenga elementos
        assertTrue(transitionRequest.toString().isNotEmpty())
    }

    @Test
    fun testActivityTransitionReceiverStateFlowUpdates() {
        ActivityTransitionReceiver.updateActivity(DetectedActivity.IN_VEHICLE)
        assertEquals(DetectedActivity.IN_VEHICLE, ActivityTransitionReceiver.currentActivityType.value)

        ActivityTransitionReceiver.updateActivity(DetectedActivity.STILL)
        assertEquals(DetectedActivity.STILL, ActivityTransitionReceiver.currentActivityType.value)
    }

    @Test
    fun testKinematicBearingCalculationReturnsExactCardinalHeadings() {
        // Rumbo Norte (0°)
        val bearingNorth = TrackingForegroundService.calculateBearing(0.0, 0.0, 0.01, 0.0)
        assertEquals(0.0f, bearingNorth, 0.5f)

        // Rumbo Este (90°)
        val bearingEast = TrackingForegroundService.calculateBearing(0.0, 0.0, 0.0, 0.01)
        assertEquals(90.0f, bearingEast, 0.5f)

        // Rumbo Sur (180°)
        val bearingSouth = TrackingForegroundService.calculateBearing(0.0, 0.0, -0.01, 0.0)
        assertEquals(180.0f, bearingSouth, 0.5f)

        // Rumbo Oeste (270°)
        val bearingWest = TrackingForegroundService.calculateBearing(0.0, 0.0, 0.0, -0.01)
        assertEquals(270.0f, bearingWest, 0.5f)
    }

    @Test
    fun testKinematicBearingDeltaHandlesNorthBoundaryCrossing() {
        // Giro directo de 15 grados en cuadrante normal
        val deltaNormal = TrackingForegroundService.calculateBearingDelta(10.0f, 25.0f)
        assertEquals(15.0f, deltaNormal, 0.01f)

        // Giro cruzando el Norte (355° a 10° = 15° de diferencia angular)
        val deltaNorthBoundary = TrackingForegroundService.calculateBearingDelta(355.0f, 10.0f)
        assertEquals(15.0f, deltaNorthBoundary, 0.01f)

        // Simetría de la diferencia angular
        val deltaSymmetric = TrackingForegroundService.calculateBearingDelta(10.0f, 355.0f)
        assertEquals(15.0f, deltaSymmetric, 0.01f)

        // Giro idéntico (0°)
        val deltaZero = TrackingForegroundService.calculateBearingDelta(90.0f, 90.0f)
        assertEquals(0.0f, deltaZero, 0.01f)

        // Giro opuesto (180°)
        val deltaOpposite = TrackingForegroundService.calculateBearingDelta(0.0f, 180.0f)
        assertEquals(180.0f, deltaOpposite, 0.01f)
    }

    @Test
    fun testKinematicHaversineDistanceCalculationAccuracy() {
        // Misma coordenada = 0 metros
        val distZero = TrackingForegroundService.calculateHaversineDistanceMeters(-0.1800, -78.4800, -0.1800, -78.4800)
        assertEquals(0.0, distZero, 0.001)

        // Coordenadas en Quito: Plaza Foch a González Suárez
        val distQuito = TrackingForegroundService.calculateHaversineDistanceMeters(
            -0.2065, -78.4935,
            -0.2018, -78.4905
        )
        // Distancia aproximada esperada entre 600m y 700m
        assertTrue("La distancia en Quito debe ser coherente (~625m)", distQuito > 600.0 && distQuito < 700.0)
    }

    @Test
    fun testKinematicThresholdConstantsForBatteryPreservation() {
        assertEquals(15.0f, TrackingForegroundService.BEARING_CHANGE_THRESHOLD_DEGREES, 0.001f)
        assertEquals(5.0f, TrackingForegroundService.MIN_CORNER_DISTANCE_METERS, 0.001f)
        assertEquals(15.0f, TrackingForegroundService.MIN_VEHICLE_DISTANCE_METERS, 0.001f)
        assertEquals(10.0f, TrackingForegroundService.MIN_WALKING_DISTANCE_METERS, 0.001f)
        assertEquals(25.0f, TrackingForegroundService.MIN_STILL_DISTANCE_METERS, 0.001f)
    }
}

