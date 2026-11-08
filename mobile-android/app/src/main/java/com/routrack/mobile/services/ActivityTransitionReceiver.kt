package com.routrack.mobile.services

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionEvent
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Receptor de difusiones para transiciones de reconocimiento de actividad del usuario.
 *
 * Permite adaptar la frecuencia de captura de geolocalización (Fused Location) según el estado físico
 * del vendedor (Quieto, Caminando, En Vehículo), optimizando el consumo de batería (RNF-01).
 */
class ActivityTransitionReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_ACTIVITY_TRANSITION = "com.routrack.mobile.ACTION_ACTIVITY_TRANSITION"

        private val _currentActivityType = MutableStateFlow(DetectedActivity.UNKNOWN)
        val currentActivityType = _currentActivityType.asStateFlow()

        private val _lastTransitionEvent = MutableStateFlow<ActivityTransitionEvent?>(null)
        val lastTransitionEvent = _lastTransitionEvent.asStateFlow()

        /**
         * Construye la lista de transiciones de interés para el monitoreo de jornada:
         * - IN_VEHICLE: desplazamientos en vehículo
         * - WALKING / ON_FOOT: recorrido comercial a pie
         * - STILL: paradas prolongadas o permanencia en establecimiento del cliente
         */
        fun buildTransitionRequest(): ActivityTransitionRequest {
            val transitions = mutableListOf<ActivityTransition>()

            val activitiesToMonitor = listOf(
                DetectedActivity.IN_VEHICLE,
                DetectedActivity.WALKING,
                DetectedActivity.ON_FOOT,
                DetectedActivity.STILL
            )

            for (activity in activitiesToMonitor) {
                transitions.add(
                    ActivityTransition.Builder()
                        .setActivityType(activity)
                        .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                        .build()
                )
                transitions.add(
                    ActivityTransition.Builder()
                        .setActivityType(activity)
                        .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_EXIT)
                        .build()
                )
            }

            return ActivityTransitionRequest(transitions)
        }

        /**
         * Actualiza el estado de la actividad (utilizado por el receptor y en pruebas unitarias).
         */
        fun updateActivity(activityType: Int) {
            _currentActivityType.value = activityType
        }
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        if (intent == null) return

        if (ActivityTransitionResult.hasResult(intent)) {
            val result = ActivityTransitionResult.extractResult(intent) ?: return
            for (event in result.transitionEvents) {
                if (event.transitionType == ActivityTransition.ACTIVITY_TRANSITION_ENTER) {
                    _currentActivityType.value = event.activityType
                    _lastTransitionEvent.value = event

                    // Notificar al servicio en primer plano para reconfigurar la tasa de muestreo GPS
                    if (context != null) {
                        TrackingForegroundService.onActivityTransitionChanged(context, event.activityType)
                    }
                }
            }
        }
    }
}

