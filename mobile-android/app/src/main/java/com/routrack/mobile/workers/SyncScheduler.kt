package com.routrack.mobile.workers

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/**
 * Gestor y orquestador centralizado de tareas en segundo plano para la sincronización con WorkManager.
 *
 * Configura de forma inmutable las restricciones de red (NetworkType.CONNECTED)
 * y la política de reintentos exponenciales con un retardo inicial de 30 segundos,
 * preservando la batería del dispositivo móvil mediante el respeto de ventanas de Doze mode.
 */
object SyncScheduler {

    const val PERIODIC_SYNC_WORK_NAME = "ROUTRACK_PERIODIC_SYNC_WORK"
    const val IMMEDIATE_SYNC_WORK_NAME = "ROUTRACK_IMMEDIATE_SYNC_WORK"
    const val INITIAL_BACKOFF_DELAY_SECONDS = 30L
    const val DEFAULT_PERIODIC_INTERVAL_MINUTES = 15L

    /**
     * Retorna las restricciones obligatorias de conectividad activa para la ejecución del Worker.
     */
    fun createSyncConstraints(): Constraints {
        return Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
    }

    /**
     * Programa la sincronización periódica en segundo plano cada [intervalMinutes] minutos.
     */
    fun schedulePeriodicSync(
        context: Context,
        intervalMinutes: Long = DEFAULT_PERIODIC_INTERVAL_MINUTES
    ) {
        val constraints = createSyncConstraints()

        val periodicWorkRequest = PeriodicWorkRequestBuilder<SyncJornadaWorker>(
            intervalMinutes,
            TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                INITIAL_BACKOFF_DELAY_SECONDS,
                TimeUnit.SECONDS
            )
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            PERIODIC_SYNC_WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            periodicWorkRequest
        )
    }

    /**
     * Encola una sincronización inmediata bajo demanda (ej. al finalizar jornada o crear visita).
     */
    fun enqueueImmediateSync(context: Context) {
        val constraints = createSyncConstraints()

        val immediateWorkRequest = OneTimeWorkRequestBuilder<SyncJornadaWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                INITIAL_BACKOFF_DELAY_SECONDS,
                TimeUnit.SECONDS
            )
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            IMMEDIATE_SYNC_WORK_NAME,
            ExistingWorkPolicy.REPLACE,
            immediateWorkRequest
        )
    }

    /**
     * Cancela todas las tareas de sincronización registradas.
     */
    fun cancelAllSyncWork(context: Context) {
        val workManager = WorkManager.getInstance(context)
        workManager.cancelUniqueWork(PERIODIC_SYNC_WORK_NAME)
        workManager.cancelUniqueWork(IMMEDIATE_SYNC_WORK_NAME)
    }
}
