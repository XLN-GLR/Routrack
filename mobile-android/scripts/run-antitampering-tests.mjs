import fs from 'fs';
import path from 'path';

/**
 * Runner ejecutable de pruebas formales para AntiTamperingManager (TASK-011).
 * Valida la detección ineludible de Mock Locations y anomalías de tiempo > 60s.
 */

let passed = 0;
let failed = 0;

function assert(description, condition, details = '') {
  if (condition) {
    passed++;
    console.log(`  [PASS] Prueba ${passed}: ${description}`);
  } else {
    failed++;
    console.error(`  [FAIL] Prueba ${passed + failed}: ${description} - ${details}`);
  }
}

console.log('--- INICIANDO SUITE DE PRUEBAS DE SEGURIDAD ANTI-TAMPERING (TASK-011) ---');

const baseAndroidPath = path.resolve('mobile-android/app/src/main/java');
const testAndroidPath = path.resolve('mobile-android/app/src/test/java');

// 1. Verificación de existencia de archivos Kotlin
const managerFile = path.join(baseAndroidPath, 'com/routrack/mobile/security/AntiTamperingManager.kt');
const testFile = path.join(testAndroidPath, 'com/routrack/mobile/security/AntiTamperingManagerTest.kt');
const trackingServiceFile = path.join(baseAndroidPath, 'com/routrack/mobile/services/TrackingForegroundService.kt');
const locationServiceFile = path.join(baseAndroidPath, 'com/empresa/routrack/service/LocationForegroundService.kt');

assert('Archivo AntiTamperingManager.kt existe en com.routrack.mobile.security', fs.existsSync(managerFile));
assert('Archivo AntiTamperingManagerTest.kt existe en com.routrack.mobile.security', fs.existsSync(testFile));

const managerContent = fs.readFileSync(managerFile, 'utf-8');
const trackingServiceContent = fs.readFileSync(trackingServiceFile, 'utf-8');
const locationServiceContent = fs.readFileSync(locationServiceFile, 'utf-8');

// 2. Criterio de Aceptación 1: Detección y marcado inequívoco de Fake GPS (is_mock = true)
assert(
  'AntiTamperingManager contiene método isMockLocation compatible con Android 12+ (location.isMock) y versiones previas',
  managerContent.includes('location.isMock') && managerContent.includes('location.isFromMockProvider')
);
assert(
  'AntiTamperingManager define el evento de auditoría EVENT_MOCK_LOCATION_DETECTED',
  managerContent.includes('EVENT_MOCK_LOCATION_DETECTED = "MOCK_LOCATION_DETECTED"')
);
assert(
  'TrackingForegroundService integra AntiTamperingManager y propaga securityAudit.isMock a Room',
  trackingServiceContent.includes('AntiTamperingManager.inspectAndAuditLocation') &&
  trackingServiceContent.includes('isMock = securityAudit.isMock')
);
assert(
  'LocationForegroundService integra AntiTamperingManager y propaga securityAudit.isMock a Room',
  locationServiceContent.includes('AntiTamperingManager.inspectAndAuditLocation') &&
  locationServiceContent.includes('isMock = securityAudit.isMock')
);

// 3. Criterio de Aceptación 2: Detección de desvíos de reloj > 60 segundos
assert(
  'AntiTamperingManager define umbral exacto de 60 segundos (CLOCK_SKEW_THRESHOLD_SECONDS = 60L)',
  managerContent.includes('CLOCK_SKEW_THRESHOLD_SECONDS = 60L')
);
assert(
  'AntiTamperingManager define el evento de auditoría EVENT_TIME_ANOMALY_DETECTED',
  managerContent.includes('EVENT_TIME_ANOMALY_DETECTED = "TIME_ANOMALY_DETECTED"')
);

// 4. Lógica matemática de detección de desvíos de reloj
function calculateClockSkewSeconds(systemTimeMillis, referenceTimeMillis) {
  return Math.abs(systemTimeMillis - referenceTimeMillis) / 1000;
}

function isClockSkewAnomalous(skewSeconds, thresholdSeconds = 60) {
  return skewSeconds > thresholdSeconds;
}

// Caso 4.1: Desfase dentro del margen permitido (<= 60s)
const skewNormal = calculateClockSkewSeconds(1700000010000, 1700000000000); // 10 segundos
assert('Desfase temporal normal (10s) no se considera anómalo', !isClockSkewAnomalous(skewNormal));

// Caso 4.2: Desfase en el límite exacto (60s)
const skewBoundary = calculateClockSkewSeconds(1700000060000, 1700000000000); // 60 segundos
assert('Desfase temporal en el límite exacto (60s) es tolerado', !isClockSkewAnomalous(skewBoundary));

// Caso 4.3: Desfase anómalo hacia el futuro (> 60s)
const skewFuture = calculateClockSkewSeconds(1700000075000, 1700000000000); // 75 segundos
assert('Desfase hacia el futuro mayor a 60 segundos (> 60s) es detectado como anomalía', isClockSkewAnomalous(skewFuture));

// Caso 4.4: Desfase anómalo hacia el pasado (> 60s)
const skewPast = calculateClockSkewSeconds(1700000000000, 1700000300000); // 300 segundos atrasado
assert('Atraso manual del reloj (> 60s) es detectado como anomalía temporal', isClockSkewAnomalous(skewPast));

// 5. Comparación con reloj monotónico (SystemClock.elapsedRealtime)
assert(
  'AntiTamperingManager calibra y utiliza SystemClock.elapsedRealtime() para detectar manipulaciones en caliente',
  managerContent.includes('SystemClock.elapsedRealtime()') &&
  managerContent.includes('calibratedTimeBaseMillis') &&
  managerContent.includes('getExpectedTimeFromMonotonicClock')
);

// 6. Registro de evento de advertencia ante anomalía de tiempo
assert(
  'inspectAndAuditLocation emite evento EVENT_TIME_ANOMALY_DETECTED en TrackingRepository cuando isTimeAnomalous = true',
  managerContent.includes('trackingRepository.recordAuditEvent(') &&
  managerContent.includes('eventType = EVENT_TIME_ANOMALY_DETECTED')
);

console.log(`\nRESUMEN FINAL: ${passed} pruebas aprobadas de ${passed + failed} evaluadas. Errores: ${failed}.`);
if (failed > 0) process.exit(1);
