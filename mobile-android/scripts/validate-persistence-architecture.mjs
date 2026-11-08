import fs from 'fs';
import path from 'path';

/**
 * Script de validación automatizada de Clean Architecture, inmutabilidad
 * y desacoplamiento de la capa de persistencia en Android (TASK-008).
 */

const baseAndroidPath = path.resolve('mobile-android/app/src/main/java/com/empresa/routrack');
const testAndroidPath = path.resolve('mobile-android/app/src/test/java/com/empresa/routrack');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assertCheck(name, condition, details = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  [PASS] Aserción ${totalChecks}: ${name}`);
  } else {
    failedChecks++;
    console.error(`  [FAIL] Aserción ${totalChecks}: ${name} - ${details}`);
  }
}

console.log('--- INICIANDO VALIDACIÓN ARQUITECTÓNICA DE PERSISTENCIA Y REPOSITORIOS (TASK-008) ---');

// 1. Verificar existencia de archivos de contratos e implementaciones
const requiredFiles = [
  'data/local/entity/VisitaEntity.kt',
  'data/local/dao/VisitaDao.kt',
  'data/local/dao/JornadaDao.kt',
  'data/local/dao/UbicacionGpsDao.kt',
  'data/local/dao/BitacoraAuditoriaDao.kt',
  'data/local/RoutrackDatabase.kt',
  'data/repository/ShiftRepository.kt',
  'data/repository/ShiftRepositoryImpl.kt',
  'data/repository/TrackingRepository.kt',
  'data/repository/TrackingRepositoryImpl.kt',
  'data/repository/VisitRepository.kt',
  'data/repository/VisitRepositoryImpl.kt',
  'data/repository/RepositoryProvider.kt',
  'data/RoutrackRepository.kt',
  'ui/tracking/TrackingViewModel.kt',
  'service/LocationForegroundService.kt'
];

for (const relPath of requiredFiles) {
  const fullPath = path.join(baseAndroidPath, relPath);
  assertCheck(`Existencia de ${relPath}`, fs.existsSync(fullPath));
}

// 2. Desacoplamiento de TrackingViewModel
const viewModelContent = fs.readFileSync(path.join(baseAndroidPath, 'ui/tracking/TrackingViewModel.kt'), 'utf-8');
assertCheck(
  'TrackingViewModel desacoplado: No importa DAOs directamente',
  !viewModelContent.includes('import com.empresa.routrack.data.local.dao.')
);
assertCheck(
  'TrackingViewModel inyecta ShiftRepository',
  viewModelContent.includes('shiftRepository: ShiftRepository')
);
assertCheck(
  'TrackingViewModel inyecta TrackingRepository',
  viewModelContent.includes('trackingRepository: TrackingRepository')
);
assertCheck(
  'TrackingViewModel no crea instancia de RoutrackDatabase directamente',
  !viewModelContent.includes('RoutrackDatabase.getInstance')
);

// 3. Desacoplamiento de LocationForegroundService
const serviceContent = fs.readFileSync(path.join(baseAndroidPath, 'service/LocationForegroundService.kt'), 'utf-8');
assertCheck(
  'LocationForegroundService desacoplado: No importa DAOs directamente',
  !serviceContent.includes('import com.empresa.routrack.data.local.dao.')
);
assertCheck(
  'LocationForegroundService usa TrackingRepository',
  serviceContent.includes('trackingRepository: TrackingRepository') || serviceContent.includes('trackingRepository =')
);
assertCheck(
  'LocationForegroundService no crea instancia de RoutrackDatabase directamente',
  !serviceContent.includes('RoutrackDatabase.getInstance')
);

// 4. Concurrencia atómica y mitigación de bloqueos en TrackingRepositoryImpl
const trackingRepoContent = fs.readFileSync(path.join(baseAndroidPath, 'data/repository/TrackingRepositoryImpl.kt'), 'utf-8');
assertCheck(
  'TrackingRepositoryImpl usa Mutex para serialización de encadenamiento HMAC',
  trackingRepoContent.includes('Mutex()') && trackingRepoContent.includes('auditChainMutex.withLock')
);
assertCheck(
  'TrackingRepositoryImpl despacha operaciones bajo CoroutineDispatcher IO',
  trackingRepoContent.includes('Dispatchers.IO') && trackingRepoContent.includes('withContext(ioDispatcher)')
);
assertCheck(
  'TrackingRepositoryImpl expone flujos inmutables con flowOn',
  trackingRepoContent.includes('.flowOn(ioDispatcher)')
);

// 5. Soporte de búfer de 10.000 puntos y consultas con límites
const ubicacionDaoContent = fs.readFileSync(path.join(baseAndroidPath, 'data/local/dao/UbicacionGpsDao.kt'), 'utf-8');
assertCheck(
  'UbicacionGpsDao soporta límite en getPendientesSincronizacion para batching',
  ubicacionDaoContent.includes('LIMIT :limite') || ubicacionDaoContent.includes('limite: Int')
);
assertCheck(
  'UbicacionGpsDao incluye método de purga de telemetría antigua sincronizada',
  ubicacionDaoContent.includes('purgarSincronizadasAntiguas')
);
assertCheck(
  'UbicacionGpsDao incluye conteo ligero countTotal sin cargar lista en memoria',
  ubicacionDaoContent.includes('countTotal')
);

// 6. Entidad de Visitas y Registro en Room
const dbContent = fs.readFileSync(path.join(baseAndroidPath, 'data/local/RoutrackDatabase.kt'), 'utf-8');
assertCheck(
  'RoutrackDatabase registra VisitaEntity',
  dbContent.includes('VisitaEntity::class')
);
assertCheck(
  'RoutrackDatabase expone visitaDao()',
  dbContent.includes('fun visitaDao(): VisitaDao')
);

// 7. Pruebas Unitarias de Repositorios presentes
const testFiles = [
  'data/repository/TrackingRepositoryTest.kt',
  'data/repository/ShiftRepositoryTest.kt',
  'data/crypto/AuditChainManagerTest.kt'
];

for (const relTestPath of testFiles) {
  const fullTestPath = path.join(testAndroidPath, relTestPath);
  assertCheck(`Existencia de prueba unitaria ${relTestPath}`, fs.existsSync(fullTestPath));
}

console.log(`\nRESUMEN: ${passedChecks} aserciones aprobadas de ${totalChecks} evaluadas. Errores: ${failedChecks}.`);

if (failedChecks > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
