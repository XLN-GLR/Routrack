package com.empresa.routrack.workers

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.empresa.routrack.data.repository.RepositoryProvider
import com.routrack.mobile.workers.SyncJornadaWorker

/**
 * Worker para sincronización en segundo plano con WorkManager (compatibilidad con paquete com.empresa.routrack.workers).
 * Delega su ejecución en [SyncJornadaWorker] y el repositorio [RepositoryProvider.getSyncRepository].
 */
class SyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    private val delegate = SyncJornadaWorker(appContext, workerParams)

    override suspend fun doWork(): Result {
        return delegate.doWork()
    }
}
