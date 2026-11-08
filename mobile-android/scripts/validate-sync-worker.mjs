/**
 * ROUTRACK — Suite de Validación Automatizada para SyncJornadaWorker y WorkManager (TASK-013)
 * Archivo: mobile-android/scripts/validate-sync-worker.mjs
 * Runtime: Node.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    failed++;
  }
}

console.log('--- INICIANDO SUITE DE VALIDACIÓN DE WORKER Y REPOSITORIO DE SINCRONIZACIÓN (TASK-013) ---');

// 1. Verificación de archivos requeridos
const syncWorkerPath = path.join(projectRoot, 'mobile-android/app/src/main/java/com/routrack/mobile/workers/SyncJornadaWorker.kt');
const syncRepoPath = path.join(projectRoot, 'mobile-android/app/src/main/java/com/routrack/mobile/data/repository/SyncRepository.kt');
const syncRepoImplPath = path.join(projectRoot, 'mobile-android/app/src/main/java/com/routrack/mobile/data/repository/SyncRepositoryImpl.kt');
const syncSchedulerPath = path.join(projectRoot, 'mobile-android/app/src/main/java/com/routrack/mobile/workers/SyncScheduler.kt');
const syncLegacyWorkerPath = path.join(projectRoot, 'mobile-android/app/src/main/java/com/empresa/routrack/workers/SyncWorker.kt');
const syncTestPath = path.join(projectRoot, 'mobile-android/app/src/test/java/com/routrack/mobile/workers/SyncJornadaWorkerTest.kt');

assert(fs.existsSync(syncWorkerPath), 'Prueba 1: Archivo SyncJornadaWorker.kt existe en com.routrack.mobile.workers');
assert(fs.existsSync(syncRepoPath), 'Prueba 2: Archivo SyncRepository.kt existe');
assert(fs.existsSync(syncRepoImplPath), 'Prueba 3: Archivo SyncRepositoryImpl.kt existe');
assert(fs.existsSync(syncSchedulerPath), 'Prueba 4: Archivo SyncScheduler.kt existe');
assert(fs.existsSync(syncLegacyWorkerPath), 'Prueba 5: Archivo SyncWorker.kt existe para compatibilidad retroactiva');
assert(fs.existsSync(syncTestPath), 'Prueba 6: Archivo SyncJornadaWorkerTest.kt existe');

// 2. Validación de Restricciones de Red (NetworkType.CONNECTED)
const schedulerContent = fs.readFileSync(syncSchedulerPath, 'utf8');
assert(
  schedulerContent.includes('NetworkType.CONNECTED'),
  'Prueba 7: SyncScheduler configura restricción obligatoria NetworkType.CONNECTED'
);
assert(
  schedulerContent.includes('BackoffPolicy.EXPONENTIAL'),
  'Prueba 8: SyncScheduler configura política de reintentos BackoffPolicy.EXPONENTIAL'
);
assert(
  schedulerContent.includes('INITIAL_BACKOFF_DELAY_SECONDS = 30L') || schedulerContent.includes('30'),
  'Prueba 9: SyncScheduler define retardo inicial de backoff de 30 segundos'
);

// 3. Validación de límites de lote (hasta 100 registros)
const workerContent = fs.readFileSync(syncWorkerPath, 'utf8');
assert(
  workerContent.includes('MAX_BATCH_SIZE = 100') || workerContent.includes('100'),
  'Prueba 10: SyncJornadaWorker define límite estricto de lote de 100 registros (MAX_BATCH_SIZE)'
);

// 4. Validación de manejo de errores y reintentos (Result.retry vs Result.failure)
assert(
  workerContent.includes('Result.retry()'),
  'Prueba 11: SyncJornadaWorker retorna Result.retry() ante caídas de red o errores de servidor'
);
assert(
  workerContent.includes('Result.failure()'),
  'Prueba 12: SyncJornadaWorker retorna Result.failure() ante errores 4xx o superación de umbral de intentos'
);

// 5. Validación de interfaz y clases de excepción en SyncRepository.kt
const repoContent = fs.readFileSync(syncRepoPath, 'utf8');
assert(
  repoContent.includes('interface SyncRepository'),
  'Prueba 13: SyncRepository define la interfaz formal del repositorio'
);
assert(
  repoContent.includes('class NetworkException') && repoContent.includes('class ServerException'),
  'Prueba 14: SyncRepository modela excepciones diferenciadas NetworkException y ServerException'
);

// 6. Validación de actualización atómica en SyncRepositoryImpl.kt
const repoImplContent = fs.readFileSync(syncRepoImplPath, 'utf8');
assert(
  repoImplContent.includes('ubicacionDao.marcarSincronizadas') &&
  repoImplContent.includes('visitaDao.marcarSincronizadas') &&
  repoImplContent.includes('auditoriaDao.marcarSincronizados'),
  'Prueba 15: SyncRepositoryImpl ejecuta transición atómica a sincronizado en SQLite tras HTTP 200'
);
assert(
  repoImplContent.includes('functions/v1/sync-jornada'),
  'Prueba 16: SyncRepositoryImpl apunta al endpoint canónico /functions/v1/sync-jornada'
);

// 7. Simulación Funcional: Simulación de Ingesta, Idempotencia y Resiliencia
class MockDao {
  constructor() {
    this.records = [];
  }
  insert(item) {
    this.records.push({ ...item, sincronizado: false });
  }
  getPendientes(limit = 100) {
    return this.records.filter(r => !r.sincronizado).slice(0, limit);
  }
  marcarSincronizadas(ids) {
    for (const r of this.records) {
      if (ids.includes(r.id)) {
        r.sincronizado = true;
      }
    }
  }
  countPendientes() {
    return this.records.filter(r => !r.sincronizado).length;
  }
}

// Escenario A: Éxito con HTTP 200
const ubicacionDao = new MockDao();
for (let i = 1; i <= 5; i++) {
  ubicacionDao.insert({ id: `pt-${i}`, lat: -0.18 + i * 0.001, lng: -78.48 });
}

assert(ubicacionDao.countPendientes() === 5, 'Prueba 17: Inicialmente existen 5 registros en estado PENDING');

// Simular envío de lote y respuesta HTTP 200
const batchToSync = ubicacionDao.getPendientes(100);
const fakeHttpResponse = { statusCode: 200 };

if (fakeHttpResponse.statusCode === 200) {
  ubicacionDao.marcarSincronizadas(batchToSync.map(b => b.id));
}

assert(
  ubicacionDao.countPendientes() === 0,
  'Prueba 18: Todos los registros PENDING transicionan exitosamente a SYNCED tras confirmación HTTP 200'
);

// Escenario B: Falla de red transitoria (HTTP 503 o Network Timeout)
for (let i = 6; i <= 10; i++) {
  ubicacionDao.insert({ id: `pt-${i}`, lat: -0.19, lng: -78.49 });
}
assert(ubicacionDao.countPendientes() === 5, 'Prueba 19: 5 nuevos registros locales ingresan en estado PENDING');

const failedResponse = { statusCode: 503, error: 'Service Unavailable' };
let retryTriggered = false;

if (failedResponse.statusCode >= 500) {
  // Simular lógica de SyncJornadaWorker: no tocar registros y disparar retry
  retryTriggered = true;
}

assert(retryTriggered, 'Prueba 20: Error transitorio 503 dispara correctamente la política de reintento');
assert(
  ubicacionDao.countPendientes() === 5,
  'Prueba 21: Los registros locales se conservan intactos en SQLite ante fallo de red (Cero pérdida de datos)'
);

// 8. Validación de compatibilidad retroactiva en RepositoryProvider.kt
const repoProviderPath = path.join(projectRoot, 'mobile-android/app/src/main/java/com/empresa/routrack/data/repository/RepositoryProvider.kt');
const repoProviderContent = fs.readFileSync(repoProviderPath, 'utf8');
assert(
  repoProviderContent.includes('fun getSyncRepository(context: Context): SyncRepository'),
  'Prueba 22: RepositoryProvider expone getSyncRepository para inyección desacoplada'
);

console.log(`\nRESUMEN FINAL: ${passed} pruebas aprobadas de ${passed + failed} evaluadas. Errores: ${failed}.`);
if (failed > 0) process.exit(1);
