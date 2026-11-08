package com.routrack.mobile.data.repository

/**
 * Resultado estructurado de una operación de sincronización por lotes.
 */
data class SyncBatchResult(
    val batchId: String,
    val pointsSynced: Int,
    val visitsSynced: Int,
    val eventsSynced: Int,
    val isFullySynced: Boolean,
    val message: String? = null
) {
    val totalRecordsSynced: Int
        get() = pointsSynced + visitsSynced + eventsSynced
}

/**
 * Jerarquía de excepciones de sincronización para distinguir fallos transitorios de errores fatales.
 */
sealed class SyncException(message: String, cause: Throwable? = null) : Exception(message, cause) {
    /**
     * Fallos transitorios de red, conectividad o timeout.
     * Señal inequívoca para que WorkManager reintente con backoff exponencial.
     */
    class NetworkException(message: String, cause: Throwable? = null) : SyncException(message, cause)

    /**
     * Error del servidor HTTP 5xx (indisponibilidad temporal de Supabase).
     * Se reintenta con backoff exponencial.
     */
    class ServerException(val statusCode: Int, message: String) :
        SyncException("Error del servidor HTTP $statusCode: $message")

    /**
     * Error de cliente HTTP 4xx (p. ej. 400 HMAC adulterado, 401 sesión inválida, 422 esquema inválido).
     * Error no recuperable automáticamente sin intervención del usuario o auditoría.
     */
    class ClientException(val statusCode: Int, message: String) :
        SyncException("Error de cliente HTTP $statusCode: $message")

    /**
     * Lote vacío (no hay registros pendientes de sincronización).
     */
    class EmptyBatchException : SyncException("No existen registros locales pendientes de sincronización.")
}

/**
 * Contrato de repositorio de sincronización offline-first de ROUTRACK Mobile.
 */
interface SyncRepository {

    /**
     * Empaqueta hasta [maxBatchSize] registros locales pendientes en Room (ubicaciones, visitas, eventos),
     * calcula las firmas HMAC correspondientes y los transmite a la Edge Function sync-jornada.
     *
     * Si la respuesta es HTTP 200, transiciona atómicamente el estado local a sincronizado.
     * Si ocurre un fallo de red o servidor 5xx, retorna Result.failure con [SyncException.NetworkException]
     * o [SyncException.ServerException] para activar el reintento de WorkManager.
     */
    suspend fun syncPendingBatch(maxBatchSize: Int = 100): Result<SyncBatchResult>

    /**
     * Retorna el número total de registros locales pendientes de sincronizar en Room.
     */
    suspend fun getPendingCount(): Int
}
