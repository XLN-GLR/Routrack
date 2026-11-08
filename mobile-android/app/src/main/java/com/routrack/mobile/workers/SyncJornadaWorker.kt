package com.routrack.mobile.workers

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.empresa.routrack.data.repository.RepositoryProvider
import com.routrack.mobile.data.repository.SyncException
import com.routrack.mobile.data.repository.SyncRepository
import java.io.IOException

/**
 * Worker oficial de sincronización en segundo plano con Android WorkManager para ROUTRACK Mobile.
 *
 * Se ejecuta bajo la restricción de conectividad activa (NetworkType.CONNECTED),
 * empaqueta lotes de hasta 100 registros locales pendientes en Room y los transmite
 * a la Supabase Edge Function `sync-jornada` mediante HTTP POST seguro.
 *
 * Aplica una política de reintentos con backoff exponencial ante caídas transitorias
 * de red o errores de servidor (5xx), garantizando la no pérdida de información (Offline-First).
 */
class SyncJornadaWorker(
    appContext: Context,
    workerParams: WorkerParameters,
    private val syncRepositoryOverride: SyncRepository? = null
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        const val WORK_NAME = "SyncJornadaWorker"
        const val MAX_BATCH_SIZE = 100
        const val MAX_RETRY_ATTEMPTS = 10
    }

    private val syncRepository: SyncRepository by lazy {
        syncRepositoryOverride ?: RepositoryProvider.getSyncRepository(applicationContext)
    }

    override suspend fun doWork(): Result {
        return try {
            // Procesar lotes pendientes de forma secuencial hasta un máximo de 5 lotes por ejecución
            var batchesProcessed = 0
            var hasMoreData = true

            while (hasMoreData && batchesProcessed < 5) {
                val syncResult = syncRepository.syncPendingBatch(MAX_BATCH_SIZE)

                if (syncResult.isSuccess) {
                    val batch = syncResult.getOrThrow()
                    batchesProcessed++
                    hasMoreData = !batch.isFullySynced && batch.totalRecordsSynced > 0
                } else {
                    val exception = syncResult.exceptionOrNull()
                    return handleSyncError(exception)
                }
            }

            Result.success()
        } catch (e: Exception) {
            handleSyncError(e)
        }
    }

    /**
     * Discrimina los errores entre transitorios (reintentar con backoff) y fatales.
     */
    private fun handleSyncError(error: Throwable?): Result {
        return when (error) {
            is SyncException.NetworkException,
            is SyncException.ServerException,
            is IOException -> {
                // Falla transitoria de red o indisponibilidad temporal: reintentar con backoff exponencial
                if (runAttemptCount < MAX_RETRY_ATTEMPTS) {
                    Result.retry()
                } else {
                    Result.failure()
                }
            }

            is SyncException.ClientException -> {
                // Falla 4xx de cliente (HMAC adulterado, credenciales revocadas, etc.):
                // No reintentar automáticamente para evitar ciclos infinitos
                Result.failure()
            }

            else -> {
                // Errores imprevistos: reintentar si no se ha superado el umbral
                if (runAttemptCount < 3) {
                    Result.retry()
                } else {
                    Result.failure()
                }
            }
        }
    }
}
