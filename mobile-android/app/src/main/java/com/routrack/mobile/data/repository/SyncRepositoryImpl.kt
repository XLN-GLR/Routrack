package com.routrack.mobile.data.repository

import com.empresa.routrack.data.local.dao.BitacoraAuditoriaDao
import com.empresa.routrack.data.local.dao.JornadaDao
import com.empresa.routrack.data.local.dao.TextInteractionDao
import com.empresa.routrack.data.local.dao.UbicacionGpsDao
import com.empresa.routrack.data.local.dao.VisitaDao
import com.empresa.routrack.data.local.entity.BitacoraAuditoriaEntity
import com.empresa.routrack.data.local.entity.JornadaEntity
import com.empresa.routrack.data.local.entity.TextInteractionEntity
import com.empresa.routrack.data.local.entity.UbicacionGpsEntity
import com.empresa.routrack.data.local.entity.VisitaEntity
import com.empresa.routrack.data.repository.AuthRepository
import com.empresa.routrack.data.repository.AuthRepositoryImpl
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
 * Orquesta la preparación de lotes, cálculo determinista de firmas HMAC-SHA256,
 * envío hacia la Edge Function `/functions/v1/sync-jornada` (con respaldo automático
 * vía PostgREST autenticado bajo políticas RLS si la Edge Function retorna 404),
 * sincronización del ciclo OPEN/CLOSED de jornadas_laborales y transición atómica
 * en Room tras confirmación del servidor.
 */
class SyncRepositoryImpl(
    private val ubicacionDao: UbicacionGpsDao,
    private val visitaDao: VisitaDao,
    private val auditoriaDao: BitacoraAuditoriaDao,
    private val jornadaDao: JornadaDao,
    private val authRepository: AuthRepository,
    private val secretKeyProvider: () -> ByteArray,
    private val textInteractionDao: TextInteractionDao? = null,
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
        private const val REST_PREFIX = "/rest/v1"

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
        val textos = textInteractionDao?.getPendientesSincronizacion(1000)?.size ?: 0
        puntos + visitas + eventos + textos
    }

    override suspend fun syncPendingBatch(maxBatchSize: Int): Result<SyncBatchResult> =
        withContext(ioDispatcher) {
            try {
                // 1. Obtener registros pendientes de sincronización en Room
                val batchSize = maxBatchSize.coerceIn(1, MAX_DEFAULT_BATCH_SIZE)
                val puntosPendientes = ubicacionDao.getPendientesSincronizacion(batchSize)
                val visitasPendientes = visitaDao.getPendientesSincronizacion(batchSize)
                val eventosPendientes = auditoriaDao.getPendientesSincronizacion(batchSize)
                val textosPendientes = textInteractionDao?.getPendientesSincronizacion(batchSize) ?: emptyList()
                val jornadasPendientes = jornadaDao.getPendientesSincronizacion(10)

                if (puntosPendientes.isEmpty() &&
                    visitasPendientes.isEmpty() &&
                    eventosPendientes.isEmpty() &&
                    textosPendientes.isEmpty() &&
                    jornadasPendientes.isEmpty()
                ) {
                    return@withContext Result.success(
                        SyncBatchResult(
                            batchId = "",
                            pointsSynced = 0,
                            visitsSynced = 0,
                            eventsSynced = 0,
                            textsSynced = 0,
                            isFullySynced = true,
                            message = "No hay registros pendientes para sincronizar"
                        )
                    )
                }

                // 2. Determinar shiftId con prioridad a la jornada activa en curso
                val jornadaActiva = jornadaDao.getJornadaActiva()
                val shiftId = if (jornadaActiva != null && (puntosPendientes.any { it.jornadaId == jornadaActiva.id } || !jornadaActiva.sincronizado)) {
                    jornadaActiva.id
                } else {
                    puntosPendientes.firstOrNull()?.jornadaId
                        ?: visitasPendientes.firstOrNull()?.jornadaId
                        ?: eventosPendientes.firstOrNull()?.jornadaId
                        ?: textosPendientes.firstOrNull()?.jornadaId
                        ?: jornadasPendientes.first().id
                }

                // Filtrar estrictamente los registros correspondientes a este shiftId para coherencia atómica
                val puntosDelShift = puntosPendientes.filter { it.jornadaId == shiftId }
                val visitasDelShift = visitasPendientes.filter { it.jornadaId == shiftId }
                val eventosDelShift = eventosPendientes.filter { it.jornadaId == shiftId }
                val textosDelShift = textosPendientes.filter { it.jornadaId == shiftId }

                val jornadaLocal = jornadaDao.getById(shiftId)
                val session = authRepository.getCurrentSession()

                val accessToken = session?.accessToken
                if (accessToken.isNullOrBlank()) {
                    return@withContext Result.failure(
                        SyncException.ClientException(
                            401,
                            "Sesión expirada o no iniciada. Inicia sesión nuevamente para sincronizar."
                        )
                    )
                }

                val sellerId = session.userId.ifBlank {
                    jornadaLocal?.vendedorId ?: UUID.randomUUID().toString()
                }

                val cachedOrgId = authRepository.getCachedOrganizationId()
                val organizationId = if (!cachedOrgId.isNullOrBlank()) {
                    cachedOrgId
                } else {
                    authRepository.getUserProfile(sellerId).getOrNull()?.organizacionId
                        ?: AuthRepositoryImpl.DEFAULT_SEED_ORG_ID
                }

                val syncBatchId = UUID.randomUUID().toString()
                val batchTimestamp = formatIso8601(System.currentTimeMillis())
                val secretKey = secretKeyProvider()

                val headers = mutableMapOf(
                    "Content-Type" to "application/json",
                    "apikey" to anonKey,
                    "Authorization" to "Bearer $accessToken"
                )

                // 2.1. Asegurar el cierre de cualquier jornada anterior que haya finalizado pero siga pendiente en Room
                for (jp in jornadasPendientes) {
                    if (jp.id != shiftId && jp.estado == JornadaEntity.ESTADO_FINALIZADA) {
                        try {
                            updateShiftClosureViaRest(jp.id, jp, headers)
                            jornadaDao.marcarSincronizada(jp.id)
                        } catch (_: Throwable) {
                        }
                    }
                }

                // 3. Construir listas canónicas JSON para la Edge Function sync-jornada
                val (trackingPointsJson, lastVerifiedPointHash) = buildTrackingPointsJson(shiftId, puntosDelShift, secretKey)
                val visitRecordsJson = buildVisitRecordsJson(shiftId, sellerId, visitasDelShift, secretKey)
                val systemEventsJson = buildSystemEventsJson(shiftId, eventosDelShift, secretKey)
                val textInteractionsJson = buildTextInteractionsJson(textosDelShift)

                val jsonPayload = buildString {
                    append("{")
                    append("\"sync_batch_id\":\"").append(syncBatchId).append("\",")
                    append("\"shift_id\":\"").append(shiftId).append("\",")
                    append("\"organization_id\":\"").append(organizationId).append("\",")
                    append("\"seller_id\":\"").append(sellerId).append("\",")
                    append("\"batch_timestamp\":\"").append(batchTimestamp).append("\",")
                    append("\"tracking_points\":").append(trackingPointsJson).append(",")
                    append("\"visit_records\":").append(visitRecordsJson).append(",")
                    append("\"system_events\":").append(systemEventsJson).append(",")
                    append("\"text_interactions\":").append(textInteractionsJson)
                    append("}")
                }

                val edgeUrl = "$supabaseUrl$SYNC_ENDPOINT_PATH"

                // 4. Intentar primero el canal oficial: Edge Function sync-jornada
                val response = try {
                    httpTransport.post(edgeUrl, headers, jsonPayload)
                } catch (ioe: IOException) {
                    return@withContext Result.failure(
                        SyncException.NetworkException("Error de conexión al sincronizar lote: ${ioe.message}", ioe)
                    )
                }

                when {
                    response.statusCode in 200..299 -> {
                        // Sincronizar estado de cierre en jornadas_laborales si aplica
                        if (jornadaLocal?.estado == JornadaEntity.ESTADO_FINALIZADA) {
                            updateShiftClosureViaRest(
                                shiftId = shiftId,
                                jornada = jornadaLocal,
                                headers = headers
                            )
                        }
                        markAllPendingAsSynced(
                            shiftId = shiftId,
                            jornadaLocal = jornadaLocal,
                            puntosPendientes = puntosDelShift,
                            visitasPendientes = visitasDelShift,
                            eventosPendientes = eventosDelShift,
                            textosPendientes = textosDelShift,
                            syncBatchId = syncBatchId,
                            message = "Lote sincronizado exitosamente con Supabase Edge Function"
                        )
                    }

                    response.statusCode == 404 || response.body.contains("NOT_FOUND") -> {
                        // Respaldo automático directo vía PostgREST protegido por RLS cuando Edge Function no está desplegada
                        syncViaPostgrestRls(
                            syncBatchId = syncBatchId,
                            shiftId = shiftId,
                            organizationId = organizationId,
                            sellerId = sellerId,
                            batchTimestamp = batchTimestamp,
                            jornadaLocal = jornadaLocal,
                            puntosPendientes = puntosDelShift,
                            visitasPendientes = visitasDelShift,
                            eventosPendientes = eventosDelShift,
                            textosPendientes = textosDelShift,
                            lastVerifiedHash = lastVerifiedPointHash,
                            secretKey = secretKey,
                            baseHeaders = headers
                        )
                    }

                    response.statusCode in 500..599 -> {
                        Result.failure(SyncException.ServerException(response.statusCode, response.body))
                    }

                    else -> {
                        Result.failure(SyncException.ClientException(response.statusCode, response.body))
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
     * Canal de respaldo autenticado directo sobre Supabase PostgREST (`/rest/v1/`).
     * Respeta íntegramente las políticas Row Level Security (RLS) usando el JWT del usuario.
     */
    private suspend fun syncViaPostgrestRls(
        syncBatchId: String,
        shiftId: String,
        organizationId: String,
        sellerId: String,
        batchTimestamp: String,
        jornadaLocal: JornadaEntity?,
        puntosPendientes: List<UbicacionGpsEntity>,
        visitasPendientes: List<VisitaEntity>,
        eventosPendientes: List<BitacoraAuditoriaEntity>,
        textosPendientes: List<TextInteractionEntity>,
        lastVerifiedHash: String,
        secretKey: ByteArray,
        baseHeaders: Map<String, String>
    ): Result<SyncBatchResult> {
        val ignoreDuplicatesHeaders = baseHeaders.toMutableMap().apply {
            put("Prefer", "resolution=ignore-duplicates,return=minimal")
        }
        val mergeDuplicatesHeaders = baseHeaders.toMutableMap().apply {
            put("Prefer", "resolution=merge-duplicates,return=minimal")
        }

        val allShiftPoints = ubicacionDao.getUbicacionesPorJornada(shiftId)
        val firstRealPoint = allShiftPoints.firstOrNull() ?: puntosPendientes.firstOrNull()
        val lastRealPoint = allShiftPoints.lastOrNull() ?: puntosPendientes.lastOrNull()

        val initialLocationWkt = if (firstRealPoint != null) {
            "SRID=4326;POINT(${firstRealPoint.longitud} ${firstRealPoint.latitud})"
        } else {
            "SRID=4326;POINT(-78.482 -0.1785)"
        }

        val fechaInicioIso = buildShiftStartIso(jornadaLocal, firstRealPoint, batchTimestamp)

        // 1. Asegurar registro padre en jornadas_laborales (OPEN si aún está en curso)
        val jornadaInsertJson = buildString {
            append("{")
            append("\"id\":\"").append(shiftId).append("\",")
            append("\"organizacion_id\":\"").append(organizationId).append("\",")
            append("\"vendedor_id\":\"").append(sellerId).append("\",")
            append("\"fecha_inicio\":\"").append(fechaInicioIso).append("\",")
            append("\"estado\":\"").append(if (jornadaLocal?.estado == JornadaEntity.ESTADO_FINALIZADA) "CLOSED" else "OPEN").append("\",")
            append("\"ubicacion_inicio\":\"").append(initialLocationWkt).append("\"")
            if (jornadaLocal?.estado == JornadaEntity.ESTADO_FINALIZADA) {
                val fechaFinIso = buildShiftEndIso(jornadaLocal, lastRealPoint, batchTimestamp)
                append(",\"fecha_fin\":\"").append(fechaFinIso).append("\"")
                if (lastRealPoint != null) {
                    append(",\"ubicacion_fin\":\"SRID=4326;POINT(${lastRealPoint.longitud} ${lastRealPoint.latitud})\"")
                }
            }
            append("}")
        }

        val shiftResp = httpTransport.post(
            "$supabaseUrl$REST_PREFIX/jornadas_laborales?on_conflict=id",
            mergeDuplicatesHeaders,
            jornadaInsertJson
        )
        if (!shiftResp.isSuccessful) {
            return classifyHttpFailure(shiftResp.statusCode, "jornadas_laborales: ${shiftResp.body}")
        }

        // 2. Insertar puntos GPS pendientes en ubicaciones_gps
        if (puntosPendientes.isNotEmpty()) {
            var runningHash = auditoriaDao.getUltimoEventoPorJornada(shiftId)?.hashActual
                ?: HmacChainSigner.computeInitialSeed(shiftId, secretKey)

            val gpsRowsJson = buildString {
                append("[")
                puntosPendientes.forEachIndexed { index, pt ->
                    if (index > 0) append(",")
                    val payload = HmacChainSigner.PointPayload(
                        shiftId = shiftId,
                        latitude = pt.latitud,
                        longitude = pt.longitud,
                        accuracy = pt.precision,
                        altitude = pt.altitud,
                        speed = pt.velocidad,
                        timestamp = pt.timestampCaptura,
                        isMock = false
                    )
                    val pointHash = HmacChainSigner.signPoint(payload, runningHash, secretKey)
                    val prevHash = runningHash
                    runningHash = pointHash

                    append("{")
                    append("\"id\":\"").append(pt.id).append("\",")
                    append("\"organizacion_id\":\"").append(organizationId).append("\",")
                    append("\"jornada_id\":\"").append(shiftId).append("\",")
                    append("\"vendedor_id\":\"").append(sellerId).append("\",")
                    append("\"ubicacion\":\"SRID=4326;POINT(").append(pt.longitud).append(" ").append(pt.latitud).append(")\",")
                    append("\"precision_metros\":").append(pt.precision).append(",")
                    append("\"velocidad_ms\":").append(pt.velocidad ?: "null").append(",")
                    append("\"altitud_metros\":").append(pt.altitud ?: "null").append(",")
                    append("\"es_simulado\":false,")
                    append("\"previous_hash\":\"").append(prevHash).append("\",")
                    append("\"hmac_hash\":\"").append(pointHash).append("\",")
                    append("\"registrado_en\":\"").append(formatIso8601(pt.timestampCaptura)).append("\"")
                    append("}")
                }
                append("]")
            }

            val gpsResp = httpTransport.post(
                "$supabaseUrl$REST_PREFIX/ubicaciones_gps?on_conflict=id",
                ignoreDuplicatesHeaders,
                gpsRowsJson
            )
            if (!gpsResp.isSuccessful) {
                return classifyHttpFailure(gpsResp.statusCode, "ubicaciones_gps: ${gpsResp.body}")
            }
        }

        // 3. Insertar visitas comerciales pendientes en actividades_comerciales
        if (visitasPendientes.isNotEmpty()) {
            val visitsJson = buildString {
                append("[")
                visitasPendientes.forEachIndexed { index, v ->
                    if (index > 0) append(",")
                    val checkInIso = formatIso8601(v.checkInTime)
                    val visitMessage = "shiftId=$shiftId|clientId=${v.clienteId}|sellerId=$sellerId|checkIn=$checkInIso"
                    val visitHash = HmacChainSigner.computeHmacSha256(visitMessage, secretKey)
                    append("{")
                    append("\"id\":\"").append(v.id).append("\",")
                    append("\"organizacion_id\":\"").append(organizationId).append("\",")
                    append("\"jornada_id\":\"").append(shiftId).append("\",")
                    append("\"cliente_id\":\"").append(v.clienteId).append("\",")
                    append("\"vendedor_id\":\"").append(sellerId).append("\",")
                    append("\"hora_check_in\":\"").append(checkInIso).append("\",")
                    if (v.checkOutTime != null) {
                        append("\"hora_check_out\":\"").append(formatIso8601(v.checkOutTime)).append("\",")
                    } else {
                        append("\"hora_check_out\":null,")
                    }
                    append("\"ubicacion_check_in\":\"SRID=4326;POINT(").append(v.checkInLng).append(" ").append(v.checkInLat).append(")\",")
                    if (v.checkOutLat != null && v.checkOutLng != null) {
                        append("\"ubicacion_check_out\":\"SRID=4326;POINT(").append(v.checkOutLng).append(" ").append(v.checkOutLat).append(")\",")
                    } else {
                        append("\"ubicacion_check_out\":null,")
                    }
                    append("\"distancia_cliente_metros\":").append(v.distanciaClienteMetros).append(",")
                    append("\"estado\":\"").append(escapeJson(v.estado)).append("\",")
                    if (v.observaciones != null) {
                        append("\"observaciones\":\"").append(escapeJson(v.observaciones)).append("\",")
                    } else {
                        append("\"observaciones\":null,")
                    }
                    append("\"hmac_hash\":\"").append(visitHash).append("\"")
                    append("}")
                }
                append("]")
            }
            httpTransport.post(
                "$supabaseUrl$REST_PREFIX/actividades_comerciales?on_conflict=id",
                ignoreDuplicatesHeaders,
                visitsJson
            )
        }

        // 4. Insertar eventos de bitácora en bitacora_auditoria (tolera errores menores sin bloquear GPS)
        if (eventosPendientes.isNotEmpty()) {
            val eventsJson = buildString {
                append("[")
                eventosPendientes.forEachIndexed { index, ev ->
                    if (index > 0) append(",")
                    val severity = mapEventSeverity(ev.tipoEvento)
                    val meta = if (ev.metadataJson.isNotBlank()) ev.metadataJson else "{}"
                    append("{")
                    append("\"organizacion_id\":\"").append(organizationId).append("\",")
                    append("\"usuario_id\":\"").append(sellerId).append("\",")
                    append("\"client_id\":\"").append(ev.id).append("\",")
                    append("\"tipo_evento\":\"").append(escapeJson(ev.tipoEvento)).append("\",")
                    append("\"severidad\":\"").append(severity).append("\",")
                    append("\"metadatos\":").append(meta).append(",")
                    append("\"previous_hash\":\"").append(escapeJson(ev.hashPrevio)).append("\",")
                    append("\"hmac_hash\":\"").append(escapeJson(ev.hashActual)).append("\"")
                    append("}")
                }
                append("]")
            }
            httpTransport.post(
                "$supabaseUrl$REST_PREFIX/bitacora_auditoria?on_conflict=organizacion_id,hmac_hash",
                ignoreDuplicatesHeaders,
                eventsJson
            )
        }

        // 5. Insertar interacciones de texto corporativas
        if (textosPendientes.isNotEmpty()) {
            val textsJson = buildString {
                append("[")
                textosPendientes.forEachIndexed { index, ti ->
                    if (index > 0) append(",")
                    append("{")
                    append("\"id\":\"").append(ti.id).append("\",")
                    append("\"organizacion_id\":\"").append(organizationId).append("\",")
                    append("\"jornada_id\":\"").append(shiftId).append("\",")
                    append("\"vendedor_id\":\"").append(sellerId).append("\",")
                    append("\"paquete_aplicacion\":\"").append(escapeJson(ti.packageName)).append("\",")
                    if (ti.appLabel != null) {
                        append("\"nombre_aplicacion\":\"").append(escapeJson(ti.appLabel)).append("\",")
                    } else {
                        append("\"nombre_aplicacion\":null,")
                    }
                    append("\"texto_capturado\":\"").append(escapeJson(ti.capturedText)).append("\",")
                    append("\"registrado_en\":\"").append(formatIso8601(ti.timestamp)).append("\",")
                    append("\"previous_hash\":\"").append(escapeJson(ti.previousHash)).append("\",")
                    append("\"hmac_hash\":\"").append(escapeJson(ti.hmacHash)).append("\"")
                    append("}")
                }
                append("]")
            }
            httpTransport.post(
                "$supabaseUrl$REST_PREFIX/interacciones_texto?on_conflict=id",
                ignoreDuplicatesHeaders,
                textsJson
            )
        }

        // 6. Registrar lote de trazabilidad en sync_batches
        val batchRowJson = buildString {
            append("{")
            append("\"id\":\"").append(syncBatchId).append("\",")
            append("\"organizacion_id\":\"").append(organizationId).append("\",")
            append("\"vendedor_id\":\"").append(sellerId).append("\",")
            append("\"jornada_id\":\"").append(shiftId).append("\",")
            append("\"total_puntos\":").append(puntosPendientes.size).append(",")
            append("\"total_visitas\":").append(visitasPendientes.size).append(",")
            append("\"total_eventos\":").append(eventosPendientes.size).append(",")
            append("\"total_textos\":").append(textosPendientes.size).append(",")
            append("\"ultimo_hash_verificado\":\"").append(lastVerifiedHash).append("\",")
            append("\"procesado_en\":\"").append(batchTimestamp).append("\"")
            append("}")
        }
        httpTransport.post(
            "$supabaseUrl$REST_PREFIX/sync_batches?on_conflict=id",
            ignoreDuplicatesHeaders,
            batchRowJson
        )

        return markAllPendingAsSynced(
            shiftId = shiftId,
            jornadaLocal = jornadaLocal,
            puntosPendientes = puntosPendientes,
            visitasPendientes = visitasPendientes,
            eventosPendientes = eventosPendientes,
            textosPendientes = textosPendientes,
            syncBatchId = syncBatchId,
            message = "Sincronizado con Supabase vía PostgREST RLS"
        )
    }

    private suspend fun updateShiftClosureViaRest(
        shiftId: String,
        jornada: JornadaEntity,
        headers: Map<String, String>
    ) {
        try {
            val points = ubicacionDao.getUbicacionesPorJornada(shiftId)
            val lastPt = points.lastOrNull()
            val mergeHeaders = headers.toMutableMap().apply {
                put("Prefer", "resolution=merge-duplicates,return=minimal")
            }
            val fechaFinIso = buildShiftEndIso(jornada, lastPt, formatIso8601(System.currentTimeMillis()))
            val body = buildString {
                append("{")
                append("\"id\":\"").append(shiftId).append("\",")
                append("\"estado\":\"CLOSED\",")
                append("\"fecha_fin\":\"").append(fechaFinIso).append("\"")
                if (lastPt != null) {
                    append(",\"ubicacion_fin\":\"SRID=4326;POINT(${lastPt.longitud} ${lastPt.latitud})\"")
                }
                append("}")
            }
            httpTransport.post("$supabaseUrl$REST_PREFIX/jornadas_laborales?on_conflict=id", mergeHeaders, body)
        } catch (_: Throwable) {
        }
    }

    private suspend fun markAllPendingAsSynced(
        shiftId: String,
        jornadaLocal: JornadaEntity?,
        puntosPendientes: List<UbicacionGpsEntity>,
        visitasPendientes: List<VisitaEntity>,
        eventosPendientes: List<BitacoraAuditoriaEntity>,
        textosPendientes: List<TextInteractionEntity>,
        syncBatchId: String,
        message: String
    ): Result<SyncBatchResult> {
        if (puntosPendientes.isNotEmpty()) {
            ubicacionDao.marcarSincronizadas(puntosPendientes.map { it.id })
        }
        if (visitasPendientes.isNotEmpty()) {
            visitaDao.marcarSincronizadas(visitasPendientes.map { it.id })
        }
        if (eventosPendientes.isNotEmpty()) {
            auditoriaDao.marcarSincronizados(eventosPendientes.map { it.id })
        }
        if (textosPendientes.isNotEmpty()) {
            textInteractionDao?.marcarSincronizadas(textosPendientes.map { it.id })
        }

        val remainingPoints = ubicacionDao.getPendientesSincronizacion(1).isNotEmpty()
        val remainingVisits = visitaDao.getPendientesSincronizacion(1).isNotEmpty()
        val remainingEvents = auditoriaDao.getPendientesSincronizacion(1).isNotEmpty()
        val remainingTexts = textInteractionDao?.getPendientesSincronizacion(1)?.isNotEmpty() == true
        val isFullySynced = !remainingPoints && !remainingVisits && !remainingEvents && !remainingTexts

        if (jornadaLocal != null) {
            jornadaDao.marcarSincronizada(shiftId)
        }

        return Result.success(
            SyncBatchResult(
                batchId = syncBatchId,
                pointsSynced = puntosPendientes.size,
                visitsSynced = visitasPendientes.size,
                eventsSynced = eventosPendientes.size,
                textsSynced = textosPendientes.size,
                isFullySynced = isFullySynced,
                message = message
            )
        )
    }

    private fun <T> classifyHttpFailure(statusCode: Int, body: String): Result<T> {
        return if (statusCode in 500..599) {
            Result.failure(SyncException.ServerException(statusCode, body))
        } else {
            Result.failure(SyncException.ClientException(statusCode, body))
        }
    }

    private fun mapEventSeverity(eventType: String): String {
        return when (eventType.uppercase()) {
            "MOCK_LOCATION_DETECTED", "TIME_ANOMALY_DETECTED", "HMAC_CHAIN_TAMPERED" -> "CRITICAL"
            "GPS_DISABLED", "SIGNAL_LOST", "BATTERY_LOW" -> "WARNING"
            else -> "INFO"
        }
    }

    private fun buildShiftStartIso(
        jornada: JornadaEntity?,
        firstPoint: UbicacionGpsEntity?,
        fallbackIso: String
    ): String {
        if (jornada != null && jornada.fecha.isNotBlank() && jornada.horaInicio.isNotBlank()) {
            return parseLocalDateTimeToIso("${jornada.fecha} ${jornada.horaInicio}", fallbackIso)
        }
        if (firstPoint != null) {
            return formatIso8601(firstPoint.timestampCaptura)
        }
        return fallbackIso
    }

    private fun buildShiftEndIso(
        jornada: JornadaEntity,
        lastPoint: UbicacionGpsEntity?,
        fallbackIso: String
    ): String {
        if (!jornada.horaFin.isNullOrBlank() && jornada.fecha.isNotBlank()) {
            return parseLocalDateTimeToIso("${jornada.fecha} ${jornada.horaFin}", fallbackIso)
        }
        if (lastPoint != null) {
            return formatIso8601(lastPoint.timestampCaptura)
        }
        return fallbackIso
    }

    private fun parseLocalDateTimeToIso(localStr: String, fallbackIso: String): String {
        return try {
            val parser = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
            val date = parser.parse(localStr) ?: return fallbackIso
            formatIso8601(date.time)
        } catch (_: Exception) {
            fallbackIso
        }
    }

    /**
     * Construye el arreglo JSON de puntos de telemetría firmados canónicamente.
     */
    private suspend fun buildTrackingPointsJson(
        shiftId: String,
        puntos: List<UbicacionGpsEntity>,
        secretKey: ByteArray
    ): Pair<String, String> {
        var runningHash = auditoriaDao.getUltimoEventoPorJornada(shiftId)?.hashActual
            ?: HmacChainSigner.computeInitialSeed(shiftId, secretKey)

        if (puntos.isEmpty()) return "[]" to runningHash

        val sb = StringBuilder("[")
        puntos.forEachIndexed { index, punto ->
            if (index > 0) sb.append(",")

            val isMock = false
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
            sb.append("\"speed_ms\":").append(punto.velocidad ?: "null").append(",")
            sb.append("\"recorded_at\":\"").append(recordedAt).append("\",")
            sb.append("\"is_mock\":").append(isMock).append(",")
            sb.append("\"previous_hash\":\"").append(prevHash).append("\",")
            sb.append("\"hmac_hash\":\"").append(pointHash).append("\"")
            sb.append("}")
        }

        sb.append("]")
        return sb.toString() to runningHash
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
            sb.append("\"event_severity\":\"").append(mapEventSeverity(evento.tipoEvento)).append("\",")
            sb.append("\"occurred_at\":\"").append(occurredAtIso).append("\",")
            sb.append("\"metadata\":").append(if (evento.metadataJson.isNotBlank()) evento.metadataJson else "{}").append(",")
            sb.append("\"previous_hash\":\"").append(evento.hashPrevio).append("\",")
            sb.append("\"hmac_hash\":\"").append(eventHash).append("\"")
            sb.append("}")
        }
        sb.append("]")
        return sb.toString()
    }

    /**
     * Construye el arreglo JSON de interacciones de texto corporativas.
     */
    private fun buildTextInteractionsJson(
        textos: List<TextInteractionEntity>
    ): String {
        if (textos.isEmpty()) return "[]"

        val sb = StringBuilder("[")
        textos.forEachIndexed { index, texto ->
            if (index > 0) sb.append(",")

            val recordedAt = formatIso8601(texto.timestamp)
            sb.append("{")
            sb.append("\"id\":\"").append(texto.id).append("\",")
            sb.append("\"package_name\":\"").append(escapeJson(texto.packageName)).append("\",")
            if (texto.appLabel != null) {
                sb.append("\"app_label\":\"").append(escapeJson(texto.appLabel)).append("\",")
            } else {
                sb.append("\"app_label\":null,")
            }
            sb.append("\"captured_text\":\"").append(escapeJson(texto.capturedText)).append("\",")
            sb.append("\"recorded_at\":\"").append(recordedAt).append("\",")
            sb.append("\"previous_hash\":\"").append(escapeJson(texto.previousHash)).append("\",")
            sb.append("\"hmac_hash\":\"").append(escapeJson(texto.hmacHash)).append("\"")
            sb.append("}")
        }
        sb.append("]")
        return sb.toString()
    }
}
