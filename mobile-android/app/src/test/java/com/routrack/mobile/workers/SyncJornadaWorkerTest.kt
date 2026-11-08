package com.routrack.mobile.workers

import androidx.work.BackoffPolicy
import androidx.work.ListenableWorker
import androidx.work.NetworkType
import com.routrack.mobile.data.repository.SyncBatchResult
import com.routrack.mobile.data.repository.SyncException
import com.routrack.mobile.data.repository.SyncRepository
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

/**
 * Pruebas unitarias para el Worker de sincronización y su orquestación con WorkManager (TASK-013).
 */
class SyncJornadaWorkerTest {

    /**
     * Mock inmutable de SyncRepository para aislar las pruebas de la base de datos y la red.
     */
    private class FakeSyncRepository(
        var syncResult: Result<SyncBatchResult> = Result.success(
            SyncBatchResult(
                batchId = "batch-1",
                pointsSynced = 10,
                visitsSynced = 2,
                eventsSynced = 5,
                isFullySynced = true
            )
        ),
        var pendingCount: Int = 17
    ) : SyncRepository {
        var lastBatchSizeRequested: Int = 0

        override suspend fun syncPendingBatch(maxBatchSize: Int): Result<SyncBatchResult> {
            lastBatchSizeRequested = maxBatchSize
            return syncResult
        }

        override suspend fun getPendingCount(): Int = pendingCount
    }

    @Test
    fun test_constraints_require_connected_network() {
        val constraints = SyncScheduler.createSyncConstraints()
        assertEquals(
            "WorkManager debe requerir conectividad activa a la red",
            NetworkType.CONNECTED,
            constraints.requiredNetworkType
        )
    }

    @Test
    fun test_backoff_policy_and_delay_constants() {
        assertEquals(
            "El delay inicial de backoff debe ser de 30 segundos",
            30L,
            SyncScheduler.INITIAL_BACKOFF_DELAY_SECONDS
        )
        assertEquals(
            "El intervalo periódico por defecto debe ser de 15 minutos",
            15L,
            SyncScheduler.DEFAULT_PERIODIC_INTERVAL_MINUTES
        )
    }

    @Test
    fun test_max_batch_size_is_100() {
        assertEquals(
            "El tamaño máximo por lote no debe exceder 100 registros",
            100,
            SyncJornadaWorker.MAX_BATCH_SIZE
        )
    }

    @Test
    fun test_sync_success_result_structure() {
        val batch = SyncBatchResult(
            batchId = "test-uuid-batch",
            pointsSynced = 50,
            visitsSynced = 10,
            eventsSynced = 20,
            isFullySynced = true
        )
        assertEquals(80, batch.totalRecordsSynced)
        assertTrue(batch.isFullySynced)
    }

    @Test
    fun test_network_exception_classified_correctly() {
        val netEx = SyncException.NetworkException("Timeout de conexión")
        assertTrue(netEx is SyncException)
    }

    @Test
    fun test_server_5xx_exception_classified_correctly() {
        val serverEx = SyncException.ServerException(503, "Service Unavailable")
        assertEquals(503, serverEx.statusCode)
        assertTrue(serverEx.message!!.contains("503"))
    }

    @Test
    fun test_client_4xx_exception_classified_correctly() {
        val clientEx = SyncException.ClientException(400, "HMAC_CHAIN_TAMPERED")
        assertEquals(400, clientEx.statusCode)
        assertTrue(clientEx.message!!.contains("400"))
    }
}
