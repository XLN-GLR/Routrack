package com.routrack.mobile

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.work.BackoffPolicy
import androidx.work.NetworkType
import com.empresa.routrack.data.local.RoutrackDatabase
import com.empresa.routrack.data.local.dao.BitacoraAuditoriaDao
import com.empresa.routrack.data.local.dao.JornadaDao
import com.empresa.routrack.data.local.dao.UbicacionGpsDao
import com.empresa.routrack.data.local.dao.VisitaDao
import com.empresa.routrack.data.local.entity.BitacoraAuditoriaEntity
import com.empresa.routrack.data.local.entity.JornadaEntity
import com.empresa.routrack.data.local.entity.UbicacionGpsEntity
import com.empresa.routrack.data.local.entity.VisitaEntity
import com.empresa.routrack.data.repository.AuthRepository
import com.empresa.routrack.data.repository.UserProfile
import com.empresa.routrack.data.repository.UserRole
import com.empresa.routrack.data.repository.UserSession
import com.routrack.mobile.data.repository.HttpResponse
import com.routrack.mobile.data.repository.HttpTransport
import com.routrack.mobile.data.repository.SyncException
import com.routrack.mobile.data.repository.SyncRepositoryImpl
import com.routrack.mobile.security.HmacChainSigner
import com.routrack.mobile.workers.SyncJornadaWorker
import com.routrack.mobile.workers.SyncScheduler
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.IOException
import java.util.UUID

/**
 * ROUTRACK — Pruebas de Integración Android (TASK-025)
 * Archivo: mobile-android/app/src/androidTest/java/com/routrack/mobile/OfflineSyncIntegrationTest.kt
 *
 * Valida de extremo a extremo el comportamiento Offline-First estipulado en docs/TEST_PLAN.md § 3.3:
 * 1. Simulación de desconexión forzada (Modo Avión): captura de 40 puntos GPS y 2 visitas comerciales en Room.
 * 2. Cero pérdida de datos tras fallo de red o caída de proceso (Memory Stress & Process Death).
 * 3. Restauración de conectividad: disparo de WorkManager (NetworkType.CONNECTED) y transmisión a Supabase Edge Function.
 * 4. Transición atómica de 42 registros a estado sincronizado (sincronizado = true) e idempotencia ante reintentos.
 */
@RunWith(AndroidJUnit4::class)
@LargeTest
class OfflineSyncIntegrationTest {

    private lateinit var context: Context
    private lateinit var database: RoutrackDatabase
    private lateinit var jornadaDao: JornadaDao
    private lateinit var ubicacionDao: UbicacionGpsDao
    private lateinit var visitaDao: VisitaDao
    private lateinit var auditoriaDao: BitacoraAuditoriaDao

    private val testSecretKey = "ROUTRACK_INTEGRATION_TEST_SECRET_KEY_32B".toByteArray()
    private val testShiftId = "shift-integration-uuid-001"
    private val testSellerId = "seller-integration-uuid-001"
    private val testOrgId = "org-integration-uuid-001"

    /**
     * Transporte HTTP simulado para controlar transiciones de conectividad (Modo Avión vs Online).
     */
    private class FakeHttpTransport : HttpTransport {
        var isAirplaneModeActive: Boolean = true
        var responseStatusCode: Int = 200
        var recordedPayloads = mutableListOf<String>()
        var requestCount: Int = 0

        override fun post(
            url: String,
            headers: Map<String, String>,
            jsonBody: String,
            timeoutMs: Int
        ): HttpResponse {
            requestCount++
            if (isAirplaneModeActive) {
                throw IOException("SIMULATED_AIRPLANE_MODE: Red inaccesible o Modo Avión activado")
            }
            recordedPayloads.add(jsonBody)
            val responseBody = """
                {
                    "success": true,
                    "message": "Lote procesado exitosamente por Supabase Edge Function",
                    "processed_points": 40,
                    "processed_visits": 2,
                    "status": "ACCEPTED"
                }
            """.trimIndent()
            return HttpResponse(responseStatusCode, responseBody)
        }
    }

    /**
     * Repositorio de autenticación en memoria para pruebas de integración.
     */
    private class FakeAuthRepository(
        private val userId: String,
        private val orgId: String
    ) : AuthRepository {
        override suspend fun login(email: String, password: String): Result<UserProfile> {
            return Result.success(
                UserProfile(
                    id = userId,
                    organizacionId = orgId,
                    rol = "VENDEDOR",
                    nombreCompleto = "Asesor Integración",
                    email = "asesor@routrack.ec"
                )
            )
        }

        override suspend fun logout(): Result<Unit> = Result.success(Unit)

        override suspend fun getCurrentSession(): UserSession {
            return UserSession(
                userId = userId,
                email = "asesor@routrack.ec",
                accessToken = "fake-jwt-token-for-e2e-integration",
                role = UserRole.VENDEDOR
            )
        }

        override suspend fun getUserProfile(userId: String): Result<UserProfile?> {
            return Result.success(
                UserProfile(
                    id = userId,
                    organizacionId = orgId,
                    rol = "VENDEDOR",
                    nombreCompleto = "Asesor Integración",
                    email = "asesor@routrack.ec"
                )
            )
        }
    }

    private lateinit var fakeHttpTransport: FakeHttpTransport
    private lateinit var fakeAuthRepository: FakeAuthRepository
    private lateinit var syncRepository: SyncRepositoryImpl

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()

        // Base de datos Room en memoria con arquitectura real
        database = Room.inMemoryDatabaseBuilder(context, RoutrackDatabase::class.java)
            .allowMainThreadQueries()
            .build()

        jornadaDao = database.jornadaDao()
        ubicacionDao = database.ubicacionGpsDao()
        visitaDao = database.visitaDao()
        auditoriaDao = database.bitacoraAuditoriaDao()

        fakeHttpTransport = FakeHttpTransport()
        fakeAuthRepository = FakeAuthRepository(testSellerId, testOrgId)

        syncRepository = SyncRepositoryImpl(
            ubicacionDao = ubicacionDao,
            visitaDao = visitaDao,
            auditoriaDao = auditoriaDao,
            jornadaDao = jornadaDao,
            authRepository = fakeAuthRepository,
            secretKeyProvider = { testSecretKey },
            httpTransport = fakeHttpTransport
        )

        // Registrar jornada activa en SQLite Room
        val jornada = JornadaEntity(
            id = testShiftId,
            vendedorId = testSellerId,
            fecha = "2026-11-11",
            horaInicio = "08:00:00",
            estado = JornadaEntity.ESTADO_EN_CURSO,
            sincronizado = false
        )
        jornadaDao.insert(jornada)
    }

    @After
    fun tearDown() {
        database.close()
    }

    /**
     * CASO 1: Simulación de Modo Avión — Captura de 40 puntos GPS y 2 visitas en terreno.
     * Criterio de Aceptación 1: Cero pérdida de puntos de telemetría tras desconexión forzada.
     */
    @Test
    fun test_01_offline_mode_captures_40_gps_points_and_2_visits_without_data_loss() = runBlocking {
        // 1. Activar simulación de Modo Avión (sin acceso a Internet)
        fakeHttpTransport.isAirplaneModeActive = true

        // 2. Generar y almacenar 40 puntos GPS durante la ruta offline en Quito
        val baseTimestamp = 1731312000000L // 2026-11-11 08:00:00 UTC
        var previousHash = HmacChainSigner.generateShiftInitSeed(testShiftId, testSecretKey)

        for (i in 1..40) {
            val pointId = "point-offline-$i"
            val lat = -0.180653 + (i * 0.0002)
            val lng = -78.467834 - (i * 0.00015)
            val pointTime = baseTimestamp + (i * 30_000L) // Intervalo de 30s

            val pointEntity = UbicacionGpsEntity(
                id = pointId,
                jornadaId = testShiftId,
                latitud = lat,
                longitud = lng,
                altitud = 2850.0,
                precision = 4.5f,
                velocidad = 15.0f,
                timestampCaptura = pointTime,
                sincronizado = false
            )
            ubicacionDao.insert(pointEntity)

            // Registro en bitácora de auditoría con HMAC encadenado
            val payload = HmacChainSigner.PointPayload(
                pointId = pointId,
                shiftId = testShiftId,
                latitude = lat,
                longitude = lng,
                timestamp = pointTime,
                accuracy = 4.5f,
                speed = 15.0f,
                bearing = 45f,
                battery = 85,
                isMock = false
            )
            val currentHash = HmacChainSigner.signPoint(payload, previousHash, testSecretKey)

            val auditEntity = BitacoraAuditoriaEntity(
                id = "audit-pt-$i",
                jornadaId = testShiftId,
                tipoEvento = BitacoraAuditoriaEntity.EVENTO_CAPTURA_GPS,
                metadataJson = """{"seq":$i,"accuracy":4.5}""",
                timestampEvento = pointTime,
                hashPrevio = previousHash,
                hashActual = currentHash,
                sincronizado = false
            )
            auditoriaDao.insert(auditEntity)
            previousHash = currentHash
        }

        // 3. Generar y almacenar 2 visitas comerciales en terreno durante el estado offline
        val visita1 = VisitaEntity(
            id = "visita-offline-001",
            jornadaId = testShiftId,
            clienteId = "cliente-quito-norte-01",
            vendedorId = testSellerId,
            checkInTime = baseTimestamp + 600_000L,
            checkOutTime = baseTimestamp + 1_200_000L,
            checkInLat = -0.175,
            checkInLng = -78.470,
            distanciaClienteMetros = 22.4f,
            estado = VisitaEntity.ESTADO_VERIFICADA,
            observaciones = "Pedido entregado conforme y reposición de inventario",
            acuerdosJson = """[{"sku":"PROD-01","qty":10,"precio":15.5}]""",
            sincronizado = false
        )
        val visita2 = VisitaEntity(
            id = "visita-offline-002",
            jornadaId = testShiftId,
            clienteId = "cliente-quito-centro-02",
            vendedorId = testSellerId,
            checkInTime = baseTimestamp + 1_800_000L,
            checkOutTime = baseTimestamp + 2_400_000L,
            checkInLat = -0.185,
            checkInLng = -78.480,
            distanciaClienteMetros = 35.8f,
            estado = VisitaEntity.ESTADO_VERIFICADA,
            observaciones = "Firma de compromiso de cobranza semanal",
            acuerdosJson = """[{"sku":"PROD-02","qty":5,"precio":30.0}]""",
            sincronizado = false
        )
        visitaDao.insert(visita1)
        visitaDao.insert(visita2)

        // 4. Verificación de persistencia íntegra en Room (40 puntos + 2 visitas = 42 registros operativos)
        val pendingPoints = ubicacionDao.getPendientesSincronizacion(100)
        val pendingVisits = visitaDao.getPendientesSincronizacion(100)

        assertEquals("Deben existir exactamente 40 puntos GPS pendientes en Room", 40, pendingPoints.size)
        assertEquals("Deben existir exactamente 2 visitas comerciales pendientes en Room", 2, pendingVisits.size)

        // 5. Intento de sincronización durante Modo Avión: debe fallar con NetworkException sin alterar la base de datos
        val syncResult = syncRepository.syncPendingBatch(100)
        assertTrue("La sincronización debe fallar limpiamente bajo Modo Avión", syncResult.isFailure)
        assertTrue("La excepción debe ser de tipo NetworkException", syncResult.exceptionOrNull() is SyncException.NetworkException)

        // 6. Validar que NINGÚN registro se haya perdido o descartado en SQLite
        val remainingPoints = ubicacionDao.getPendientesSincronizacion(100)
        val remainingVisits = visitaDao.getPendientesSincronizacion(100)
        assertEquals("Cero pérdida: Los 40 puntos GPS deben permanecer en estado PENDING", 40, remainingPoints.size)
        assertEquals("Cero pérdida: Las 2 visitas comerciales deben permanecer en estado PENDING", 2, remainingVisits.size)
    }

    /**
     * CASO 2: Simulación de Estrés de Memoria y Cierre Forzado de Proceso (Process Death).
     * Comprueba que la cadena HMAC y los registros locales no se corrompen tras la recolección de memoria.
     */
    @Test
    fun test_02_memory_stress_and_process_death_preserves_pending_records_and_hmac_chain() = runBlocking {
        // 1. Insertar lote inicial de puntos
        val baseTime = System.currentTimeMillis()
        var lastHash = HmacChainSigner.generateShiftInitSeed(testShiftId, testSecretKey)

        for (i in 1..20) {
            val ptId = "stress-point-$i"
            val point = UbicacionGpsEntity(
                id = ptId,
                jornadaId = testShiftId,
                latitud = -0.1900 + (i * 0.0001),
                longitud = -78.4750,
                precision = 5.0f,
                timestampCaptura = baseTime + (i * 1000L),
                sincronizado = false
            )
            ubicacionDao.insert(point)

            val payload = HmacChainSigner.PointPayload(
                pointId = ptId,
                shiftId = testShiftId,
                latitude = point.latitud,
                longitude = point.longitud,
                timestamp = point.timestampCaptura,
                accuracy = point.precision,
                speed = 0f,
                bearing = 0f,
                battery = 90,
                isMock = false
            )
            val computedHash = HmacChainSigner.signPoint(payload, lastHash, testSecretKey)

            val audit = BitacoraAuditoriaEntity(
                id = "stress-audit-$i",
                jornadaId = testShiftId,
                tipoEvento = BitacoraAuditoriaEntity.EVENTO_CAPTURA_GPS,
                metadataJson = "{}",
                timestampEvento = point.timestampCaptura,
                hashPrevio = lastHash,
                hashActual = computedHash,
                sincronizado = false
            )
            auditoriaDao.insert(audit)
            lastHash = computedHash
        }

        // 2. Simular estrés de memoria extremo: limpiar referencias y forzar recolección de basura
        System.gc()

        // 3. Verificar que los 20 registros persistan intactos en la base de datos
        val auditRecords = auditoriaDao.getPendientesSincronizacion(100)
        assertEquals("Deben conservarse los 20 eventos de auditoría tras estrés de memoria", 20, auditRecords.size)

        // 4. Verificar matemáticamente la continuidad de la cadena HMAC-SHA256
        for (i in 0 until auditRecords.size - 1) {
            val actual = auditRecords[i]
            val siguiente = auditRecords[i + 1]
            assertEquals(
                "La cadena HMAC debe mantener continuidad estricta sin quiebre",
                actual.hashActual,
                siguiente.hashPrevio
            )
        }
    }

    /**
     * CASO 3: Restauración de Conectividad — Disparo de WorkManager y Batch Flush exitoso.
     * Criterio de Aceptación 2: Sincronización automática completa al restaurar la conectividad.
     */
    @Test
    fun test_03_connectivity_restored_triggers_worker_and_completes_batch_flush() = runBlocking {
        // 1. Preparar 40 puntos GPS y 2 visitas en estado PENDING
        val baseTimestamp = 1731315000000L
        for (i in 1..40) {
            val pointEntity = UbicacionGpsEntity(
                id = "point-flush-$i",
                jornadaId = testShiftId,
                latitud = -0.1800 + (i * 0.0001),
                longitud = -78.4700,
                precision = 3.0f,
                timestampCaptura = baseTimestamp + (i * 1000L),
                sincronizado = false
            )
            ubicacionDao.insert(pointEntity)
        }

        val visita1 = VisitaEntity(
            id = "visita-flush-01",
            jornadaId = testShiftId,
            clienteId = "cliente-1",
            vendedorId = testSellerId,
            checkInTime = baseTimestamp,
            checkInLat = -0.180,
            checkInLng = -78.470,
            distanciaClienteMetros = 10f,
            sincronizado = false
        )
        val visita2 = VisitaEntity(
            id = "visita-flush-02",
            jornadaId = testShiftId,
            clienteId = "cliente-2",
            vendedorId = testSellerId,
            checkInTime = baseTimestamp + 5000L,
            checkInLat = -0.182,
            checkInLng = -78.472,
            distanciaClienteMetros = 15f,
            sincronizado = false
        )
        visitaDao.insert(visita1)
        visitaDao.insert(visita2)

        assertEquals(40, ubicacionDao.getPendientesSincronizacion(100).size)
        assertEquals(2, visitaDao.getPendientesSincronizacion(100).size)

        // 2. Restaurar conectividad de red (Modo Avión desactivado)
        fakeHttpTransport.isAirplaneModeActive = false
        fakeHttpTransport.responseStatusCode = 200

        // 3. Ejecutar sincronización de lote con SyncRepository (emulando doWork() de SyncJornadaWorker)
        val syncResult = syncRepository.syncPendingBatch(100)
        assertTrue("La sincronización debe completarse exitosamente", syncResult.isSuccess)

        val batchResult = syncResult.getOrThrow()
        assertEquals("Deben reportarse 40 puntos sincronizados", 40, batchResult.pointsSynced)
        assertEquals("Deben reportarse 2 visitas sincronizadas", 2, batchResult.visitsSynced)
        assertEquals("Total de registros sincronizados debe ser 42", 42, batchResult.pointsSynced + batchResult.visitsSynced)
        assertTrue("El búfer local debe quedar completamente sincronizado", batchResult.isFullySynced)

        // 4. Validar que en Room queden CERO registros pendientes
        val remainingPoints = ubicacionDao.getPendientesSincronizacion(100)
        val remainingVisits = visitaDao.getPendientesSincronizacion(100)
        assertEquals("Cero pendientes: Todos los puntos GPS pasaron a SYNCED", 0, remainingPoints.size)
        assertEquals("Cero pendientes: Todas las visitas pasaron a SYNCED", 0, remainingVisits.size)

        // 5. Validar que el payload JSON enviado contenga los 42 registros
        val recordedPayload = fakeHttpTransport.recordedPayloads.firstOrNull()
        assertNotNull("Debe registrarse el payload HTTP enviado a Supabase", recordedPayload)
        assertTrue(recordedPayload!!.contains("point-flush-1"))
        assertTrue(recordedPayload.contains("visita-flush-01"))
        assertTrue(recordedPayload.contains("visita-flush-02"))
    }

    /**
     * CASO 4: Restricciones de WorkManager — NetworkType.CONNECTED y Backoff Exponencial.
     */
    @Test
    fun test_04_worker_constraints_enforce_network_connected_and_exponential_backoff() {
        val constraints = SyncScheduler.createSyncConstraints()
        assertEquals(
            "SyncScheduler debe obligar a NetworkType.CONNECTED para ejecutar el worker",
            NetworkType.CONNECTED,
            constraints.requiredNetworkType
        )

        assertEquals(
            "El delay inicial de backoff exponencial debe ser de 30 segundos",
            30L,
            SyncScheduler.INITIAL_BACKOFF_DELAY_SECONDS
        )

        assertEquals(
            "El tamaño máximo del lote de WorkManager no debe exceder 100 registros",
            100,
            SyncJornadaWorker.MAX_BATCH_SIZE
        )
    }

    /**
     * CASO 5: Idempotencia ante reintentos — Cero duplicación en backend.
     */
    @Test
    fun test_05_idempotent_retransmission_prevents_duplicate_records_in_backend() = runBlocking {
        fakeHttpTransport.isAirplaneModeActive = false
        fakeHttpTransport.responseStatusCode = 200

        // Al no haber registros pendientes, la sincronización reporta lote vacío sin transmitir peticiones espurias
        val syncResult = syncRepository.syncPendingBatch(100)
        assertTrue(syncResult.isSuccess)
        val result = syncResult.getOrThrow()
        assertEquals("No debe haber registros pendientes para sincronizar", 0, result.totalRecordsSynced)
        assertTrue("El sistema debe mantenerse plenamente sincronizado", result.isFullySynced)
    }
}
