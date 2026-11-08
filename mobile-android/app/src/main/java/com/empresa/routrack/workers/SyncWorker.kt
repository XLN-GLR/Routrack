package com.empresa.routrack.workers

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

/**
 * Worker para sincronización en segundo plano con WorkManager.
 * Encola la ingesta por lotes hacia la Edge Function de Supabase.
 * Su implementación completa corresponde al Slice Vertical de Sincronización (Fase 4).
 */
class SyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        return Result.success()
    }
}
