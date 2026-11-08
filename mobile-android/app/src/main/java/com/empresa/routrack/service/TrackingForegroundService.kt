package com.empresa.routrack.service

import android.app.Service
import android.content.Intent
import android.os.IBinder

/**
 * Servicio en Primer Plano para captura de telemetría GPS.
 * Declarado en AndroidManifest.xml con tipo "location".
 * Su implementación completa corresponde al Slice Vertical de Captura (Fase 3).
 */
class TrackingForegroundService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }
}
