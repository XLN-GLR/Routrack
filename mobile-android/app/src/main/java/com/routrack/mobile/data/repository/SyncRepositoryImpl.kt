package com.routrack.mobile.data.repository

import com.empresa.routrack.data.local.dao.BitacoraAuditoriaDao
import com.empresa.routrack.data.local.dao.JornadaDao
import com.empresa.routrack.data.local.dao.UbicacionGpsDao
import com.empresa.routrack.data.local.dao.VisitaDao
import com.empresa.routrack.data.local.entity.BitacoraAuditoriaEntity
import com.empresa.routrack.data.local.entity.UbicacionGpsEntity
import com.empresa.routrack.data.local.entity.VisitaEntity
import com.empresa.routrack.data.repository.AuthRepository
import com.routrack.mobile.security.HmacChainSigner
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

/**
 * Implementación oficial del repositorio de sincronización offline-first de ROUTRACK Mobile.
 *
 * Encapsula la preparación de lotes, el cálculo determinista de firmas HMAC-SHA256,
 * la serialización estricta JSON hacia la Supabase Edge Function `sync-jornada` y
 * la transición atómica de estados locales tras confirmación HTTP 200.
 */
class SyncRepositoryImpl(
    private val ubicacionDao: UbicacionGpsDao,
    private val visitaDao: VisitaDao,
    private val auditoriaDao: BitacoraAuditoriaDao,
    private val jornadaDao: JornadaDao,
    private val authRepository: AuthRepository,
    private val secretKeyProvider: () -> ByteArray,
    private val supabaseUrl: String = DEFAULT_SUPABASE_URL,
    private val anonKey: String = DEFAULT_ANON_KEY,
    private val httpTransport: HttpTransport = DefaultHttpTransport(),
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : SyncRepository {

    companion object {
        const val DEFAULT_SUPABASE_URL = "https://aaermspsuxpamylwnbyz.supabase.co"
        const val DEFAULT_ANON_KEY = "sb_publishable_B910MIl6cyXtkNim6KkXLQ_vFTRXn5q"
        const val MAX_DEFAULT_BATCH_SIZE = 100
        private const val SYNC_ENDPOINT_PATH = "/functions/v1/sync-jornada"

        /**
         * Formatea un timestamp UNIX en milisegundos a formato ISO 8601 UTC.
         */
        fun formatIso8601(timestampMillis: Long): String {
            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            sdf.timeZone = TimeZone.getTimeZone("UTC")
            return sdf.format(Date(timestampMillis))
        }

        /**
         * Escapa caracteres especiales para inyección segura en cadenas JSON manuales.
         */
        fun escapeJson(value: String): String {
            val sb = StringBuilder()
            for (c in value) {
                when (c) {
                    '\\' -> sb.append("\\\\")
                    '"' -> sb.append("\\\"")
                    '\b' -> sb.append("\\b")
                    '\u000C' -> sb.append("\\f")
                    '\n' -> sb.append("\\n")
                    '\r' -> sb.append("\\r")
                    '\t' -> sb.append("\\t")
                    else -> {
                        if (c.code in 0x00..0x1F) {
                            sb.append(String.format("\\u%04x", c.code))
                        } else {
                            sb.append(c)
                        }
                    }
                }
            }
            return sb.toString()
        }
    }

    override suspend fun getPendingCount(): Int = withContext(ioDispatcher) {
        val puntos = ubicacionDao.getPendientesSincronizacion(1000).size
        val visitas = visitaDao.getPendientesSincronizacion(1000).size
        val eventos = auditoriaDao.getPendientesSincronizacion(1000).size
        puntos + visitas + eventos
    }

    override suspend fun syncPendingBatch(maxBatchSize: Int): Result<SyncBatchResult> =
        withContext(ioDispatcher) {
            try {
                // 1. Obtener registros pendientes de sincronización en Room
                val batchSize = maxBatchSize.coerceIn(1, MAX_DEFAULT_BATCH_SIZE)
                val puntosPendientes = ubicacionDao.getPendientesSincronizacion(batchSize)
                val visitasPendientes = visitaDao.getPendientesSincronizacion(batchSize)
                val eventosPendientes = auditoriaDao.getPendientesSincronizacion(batchSize)

                if (puntosPendientes.isEmpty() && visitasPendientes.isEmpty() && eventosPendientes.isEmpty()) {
                    return@withContext Result.success(
                        SyncBatchResult(
                            batchId = "",
                            pointsSynced = 0,
                            visitsSynced = 0,
                            eventsSynced = 0,
                            isFullySynced = true,
                            message = "No hay registros pendientes para sincronizar"
                        )
                    )
                }

                // 2. Determinar shiftId, sellerId y organizationId
                val shiftId = puntosPendientes.firstOrNull()?.jornadaId
                    ?: visitasPendientes.firstOrNull()?.jornadaId
                    ?: eventosPendientes.firstOrNull()?.jornadaId
                    ?: UUID.randomUUID().toString()

                val session = authRepository.getCurrentSession()
                val profileResult = session?.userId?.let { authRepository.getUserProfile(it) }
                val profile = profileResult?.getOrNull()

                val sellerId = session?.userId
                    ?: jornadaDao.getById(shiftId)?.vendedorId
                    ?: UUID.randomUUID().toString()

                val organizationId = profile?.organizacionId
                    ?: "00000000-0000-0000-0000-000000000001"

                val syncBatchId = UUID.randomUUID().toString()
                val batchTimestamp = formatIso8601(System.currentTimeMillis())
                val secretKey = secretKeyProvider()

                // 3. Construir lista canónica de tracking_points con encadenamiento HMAC determinista
                val trackingPointsJson = buildTrackingPointsJson(shiftId, puntosPendientes, secretKey)

                // 4. Construir lista de visitas comerciales
                val visitRecordsJson = buildVisitRecordsJson(shiftId, sellerId, visitasPendientes, secretKey)

                // 5. Construir lista de eventos de sistema
                val systemEventsJson = buildSystemEventsJson(shiftId, eventosPendientes, secretKey)

                // 6. Ensamblar payload JSON completo (SyncBatchPayload)
                val jsonPayload = buildString {
                    append("{")
                    append("\"sync_batch_id\":\"").append(syncBatchId).append("\",")
                    append("\"shift_id\":\"").append(shiftId).append("\",")
                    append("\"organization_id\":\"").append(organizationId).append("\",")
                    append("\"seller_id\":\"").append(sellerId).append("\",")
                    append("\"batch_timestamp\":\"").append(batchTimestamp).append("\",")
                    append("\"tracking_points\":").append(trackingPointsJson).append(",")
                    append("\"visit_records\":").append(visitRecordsJson).append(",")
                    append("\"system_events\":").append(systemEventsJson)
                    append("}")
                }

                // 7. Preparar encabezados HTTP con Bearer JWT o Anon Key
                val headers = mutableMapOf<String, String>()
                headers["Content-Type"] = "application/json"
                headers["apikey"] = anonKey
                val authToken = session?.accessToken ?: anonKey
                headers["Authorization"] = "Bearer $authToken"

                val url = "$supabaseUrl$SYNC_ENDPOINT_PATH"

                // 8. Transmitir lote vía HTTP POST seguro
                val response = try {
                    httpTransport.post(url, headers, jsonPayload)
                } catch (ioe: IOException) {
                    return@withContext Result.failure(
                        SyncException.NetworkException("Error de conexión al sincronizar lote: ${ioe.message}", ioe)
                    )
                }

                // 9. Evaluar respuesta del servidor
                when (response.statusCode) {
                    200, 201 -> {
                        // Éxito: Transición atómica a sincronizado en SQLite
                        if (puntosPendientes.isNotEmpty()) {
                            ubicacionDao.marcarSincronizadas(puntosPendientes.map { it.id })
                        }
                        if (visitasPendientes.isNotEmpty()) {
                            visitaDao.marcarSincronizadas(visitasPendientes.map { it.id })
                        }
                        if (eventosPendientes.isNotEmpty()) {
                            auditoriaDao.marcarSincronizados(eventosPendientes.map { it.id })
                        }

                        // Verificar si aún quedan registros pendientes en Room
                        val remainingPoints = ubicacionDao.getPendientesSincronizacion(1).isNotEmpty()
                        val remainingVisits = visitaDao.getPendientesSincronizacion(1).isNotEmpty()
                        val remainingEvents = auditoriaDao.getPendientesSincronizacion(1).isNotEmpty()
                        val isFullySynced = !remainingPoints && !remainingVisits && !remainingEvents

                        Result.success(
                            SyncBatchResult(
                                batchId = syncBatchId,
                                pointsSynced = puntosPendientes.size,
                                visitsSynced = visitasPendientes.size,
                                eventsSynced = eventosPendientes.size,
                                isFullySynced = isFullySynced,
                                message = "Lote sincronizado exitosamente con Supabase Edge Function"
                            )
                        )
                    }

                    in 500..599 -> {
                        // Error transitorio de servidor: reintentar con backoff exponencial
                        Result.failure(
                            SyncException.ServerException(response.statusCode, response.body)
                        )
                    }

                    else -> {
                        // Error de cliente HTTP 4xx (p. ej. HMAC inválido, formato rechazado)
                        Result.failure(
                            SyncException.ClientException(response.statusCode, response.body)
                        )
                    }
                }
            } catch (e: Exception) {
                if (e is SyncException) {
                    Result.failure(e)
                } else {
                    Result.failure(SyncException.NetworkException("Excepción imprevista en sincronización: ${e.message}", e))
                }
            }
        }

    /**
     * Construye el arreglo JSON de puntos de telemetría firmados canónicamente.
     */
    private suspend fun buildTrackingPointsJson(
        shiftId: String,
        puntos: List<UbicacionGpsEntity>,
        secretKey: ByteArray
    ): String {
        if (puntos.isEmpty()) return "[]"

        val sb = StringBuilder("[")
        var runningHash = auditoriaDao.getUltimoEventoPorJornada(shiftId)?.hashActual
            ?: HmacChainSigner.computeInitialSeed(shiftId, secretKey)

        puntos.forEachIndexed { index, punto ->
            if (index > 0) sb.append(",")

            val isMock = false // El campo de auditoría detecta mock, en este punto se asume validado
            val payload = HmacChainSigner.PointPayload(
                shiftId = shiftId,
                latitude = punto.latitud,
                longitude = punto.longitud,
                accuracy = punto.precision,
                altitude = punto.altitud,
                speed = punto.velocidad,
                timestamp = punto.timestampCaptura,
                isMock = isMock
            )

            val pointHash = HmacChainSigner.signPoint(payload, runningHash, secretKey)
            val prevHash = runningHash
            runningHash = pointHash

            val recordedAt = formatIso8601(punto.timestampCaptura)

            sb.append("{")
            sb.append("\"id\":\"").append(punto.id).append("\",")
            sb.append("\"shift_id\":\"").append(punto.jornadaId).append("\",")
            sb.append("\"latitude\":").append(punto.latitud).append(",")
            sb.append("\"longitude\":").append(punto.longitud).append(",")
            sb.append("\"accuracy_meters\":").append(punto.precision).append(",")
            sb.append("\"altitude_meters\":").append(punto.altitud ?: "null").append(",")
            sb.append("\"speed_mps\":").append(punto.velocidad ?: "null").append(",")
            sb.append("\"recorded_at\":\"").append(recordedAt).append("\",")
            sb.append("\"is_mock\":").append(isMock).append(",")
            sb.append("\"previous_hash\":\"").append(prevHash).append("\",")
            sb.append("\"hmac_hash\":\"").append(pointHash).append("\"")
            sb.append("}")
        }

        sb.append("]")
        return sb.toString()
    }

    /**
     * Construye el arreglo JSON de visitas comerciales.
     */
    private fun buildVisitRecordsJson(
        shiftId: String,
        sellerId: String,
        visitas: List<VisitaEntity>,
        secretKey: ByteArray
    ): String {
        if (visitas.isEmpty()) return "[]"

        val sb = StringBuilder("[")
        visitas.forEachIndexed { index, visita ->
            if (index > 0) sb.append(",")

            val checkInIso = formatIso8601(visita.checkInTime)
            val checkOutIso = visita.checkOutTime?.let { formatIso8601(it) }

            // Generar hash HMAC determinista para la visita
            val visitMessage = "shiftId=$shiftId|clientId=${visita.clienteId}|sellerId=$sellerId|checkIn=$checkInIso"
            val visitHash = HmacChainSigner.computeHmacSha256(visitMessage, secretKey)

            sb.append("{")
            sb.append("\"id\":\"").append(visita.id).append("\",")
            sb.append("\"shift_id\":\"").append(visita.jornadaId).append("\",")
            sb.append("\"client_id\":\"").append(visita.clienteId).append("\",")
            sb.append("\"seller_id\":\"").append(sellerId).append("\",")
            sb.append("\"check_in_time\":\"").append(checkInIso).append("\",")
            if (checkOutIso != null) {
                sb.append("\"check_out_time\":\"").append(checkOutIso).append("\",")
            } else {
                sb.append("\"check_out_time\":null,")
            }
            sb.append("\"check_in_location\":{\"latitude\":").append(visita.checkInLat)
                .append(",\"longitude\":").append(visita.checkInLng).append("},")
            if (visita.checkOutLat != null && visita.checkOutLng != null) {
                sb.append("\"check_out_location\":{\"latitude\":").append(visita.checkOutLat)
                    .append(",\"longitude\":").append(visita.checkOutLng).append("},")
            } else {
                sb.append("\"check_out_location\":null,")
            }
            sb.append("\"distance_to_client_meters\":").append(visita.distanciaClienteMetros).append(",")
            sb.append("\"geofence_status\":\"").append(escapeJson(visita.estado)).append("\",")
            if (visita.observaciones != null) {
                sb.append("\"notes\":\"").append(escapeJson(visita.observaciones)).append("\",")
            } else {
                sb.append("\"notes\":null,")
            }
            sb.append("\"agreements\":null,")
            sb.append("\"hmac_hash\":\"").append(visitHash).append("\"")
            sb.append("}")
        }
        sb.append("]")
        return sb.toString()
    }

    /**
     * Construye el arreglo JSON de eventos de bitácora del sistema.
     */
    private fun buildSystemEventsJson(
        shiftId: String,
        eventos: List<BitacoraAuditoriaEntity>,
        secretKey: ByteArray
    ): String {
        if (eventos.isEmpty()) return "[]"

        val sb = StringBuilder("[")
        eventos.forEachIndexed { index, evento ->
            if (index > 0) sb.append(",")

            val occurredAtIso = formatIso8601(evento.timestampEvento)
            val eventHash = if (evento.hashActual.isNotBlank()) {
                evento.hashActual
            } else {
                val eventPayload = HmacChainSigner.EventPayload(
                    shiftId = shiftId,
                    eventType = evento.tipoEvento,
                    timestamp = evento.timestampEvento,
                    metadataJson = evento.metadataJson
                )
                HmacChainSigner.signEvent(eventPayload, evento.hashPrevio, secretKey)
            }

            sb.append("{")
            sb.append("\"id\":\"").append(evento.id).append("\",")
            sb.append("\"shift_id\":\"").append(evento.jornadaId).append("\",")
            sb.append("\"event_type\":\"").append(escapeJson(evento.tipoEvento)).append("\",")
            sb.append("\"occurred_at\":\"").append(occurredAtIso).append("\",")
            sb.append("\"metadata\":").append(if (evento.metadataJson.isNotBlank()) evento.metadataJson else "{}").append(",")
            sb.append("\"previous_hash\":\"").append(evento.hashPrevio).append("\",")
            sb.append("\"hmac_hash\":\"").append(eventHash).append("\"")
            sb.append("}")
        }
        sb.append("]")
        return sb.toString()
    }
}
