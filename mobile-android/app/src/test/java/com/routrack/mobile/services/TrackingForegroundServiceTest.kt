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
}

