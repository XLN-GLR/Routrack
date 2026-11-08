import fs from 'fs';
import path from 'path';

/**
 * Script de validación automatizada para el Foreground Service adaptativo
 * y Activity Recognition en Android (TASK-010).
 */

let passed = 0;
let failed = 0;

function assert(description, condition, details = '') {
  if (condition) {
    passed++;
    console.log(`  [PASS] Aserción ${passed}: ${description}`);
  } else {
    failed++;
    console.error(`  [FAIL] Aserción ${passed + failed}: ${description} - ${details}`);
  }
}

console.log('--- INICIANDO VALIDACIÓN DEL SERVICIO FOREGROUND ADAPTATIVO (TASK-010) ---');

const baseAndroidPath = path.resolve('mobile-android/app/src/main');
const testAndroidPath = path.resolve('mobile-android/app/src/test');

// 1. Existencia de archivos del servicio y receiver
const serviceFile = path.join(baseAndroidPath, 'java/com/routrack/mobile/services/TrackingForegroundService.kt');
const receiverFile = path.join(baseAndroidPath, 'java/com/routrack/mobile/services/ActivityTransitionReceiver.kt');
const testFile = path.join(testAndroidPath, 'java/com/routrack/mobile/services/TrackingForegroundServiceTest.kt');
const manifestFile = path.join(baseAndroidPath, 'AndroidManifest.xml');

assert('Archivo TrackingForegroundService.kt existe', fs.existsSync(serviceFile));
assert('Archivo ActivityTransitionReceiver.kt existe', fs.existsSync(receiverFile));
assert('Archivo TrackingForegroundServiceTest.kt existe', fs.existsSync(testFile));
assert('Archivo AndroidManifest.xml existe', fs.existsSync(manifestFile));

const serviceContent = fs.readFileSync(serviceFile, 'utf-8');
const receiverContent = fs.readFileSync(receiverFile, 'utf-8');
const manifestContent = fs.readFileSync(manifestFile, 'utf-8');

// 2. Criterio de Aceptación 1: Notificación persistente se muestra de inmediato
assert(
  'Notificación persistente con título "ROUTRACK" configurada',
  serviceContent.includes('setContentTitle("ROUTRACK")')
);
assert(
  'Notificación con texto obligatorio visible de jornada activa (LOPDP)',
  serviceContent.includes('ROUTRACK: Seguimiento de jornada activo')
);
assert(
  'Notificación marcada como no descartable (setOngoing = true)',
  serviceContent.includes('.setOngoing(true)')
);
assert(
  'Servicio ejecuta startForeground en el inicio con tipo location',
  serviceContent.includes('startForeground(') && serviceContent.includes('FOREGROUND_SERVICE_TYPE_LOCATION')
);

// 3. Criterio de Aceptación 2: Coordenadas persistidas en Room con metadatos y hash HMAC
assert(
  'Servicio persiste coordenadas y metadatos espaciales mediante TrackingRepository',
  serviceContent.includes('trackingRepository.recordLocation(') &&
  serviceContent.includes('latitud = location.latitude') &&
  serviceContent.includes('precision = location.accuracy')
);
assert(
  'Servicio registra eventos de ciclo de vida con auditoría encadenada',
  serviceContent.includes('recordAuditEvent(') &&
  serviceContent.includes('EVENTO_SERVICE_STARTED') &&
  serviceContent.includes('EVENTO_SERVICE_STOPPED')
);

// 4. Criterio de Aceptación 3: Cese inmediato de recolección al invocar parada
assert(
  'Servicio remueve actualizaciones de FusedLocationClient de inmediato',
  serviceContent.includes('fusedLocationClient.removeLocationUpdates(locationCallback)')
);
assert(
  'Servicio remueve actualizaciones de ActivityRecognitionClient',
  serviceContent.includes('activityRecognitionClient.removeActivityTransitionUpdates(')
);
assert(
  'Servicio actualiza estado de tracking a inactivo (_isTracking.value = false)',
  serviceContent.includes('_isTracking.value = false')
);
assert(
  'Servicio remueve notificación persistente con stopForeground(STOP_FOREGROUND_REMOVE)',
  serviceContent.includes('stopForeground(STOP_FOREGROUND_REMOVE)')
);
assert(
  'Servicio invoca stopSelf() para terminar ejecución en el sistema',
  serviceContent.includes('stopSelf()')
);

// 5. Captura Adaptativa con Activity Recognition (RNF-01)
assert(
  'Perfil STILL configurado para máximo ahorro de batería (90 segundos / 25 metros)',
  serviceContent.includes('90_000L') && serviceContent.includes('25.0f')
);
assert(
  'Perfil WALKING configurado para recorrido a pie (20 segundos / 10 metros)',
  serviceContent.includes('20_000L') && serviceContent.includes('10.0f')
);
assert(
  'Perfil IN_VEHICLE configurado para alta precisión en transporte (10 segundos / 15 metros)',
  serviceContent.includes('10_000L') && serviceContent.includes('15.0f')
);
assert(
  'ActivityTransitionReceiver procesa transiciones ENTER de actividad',
  receiverContent.includes('ACTIVITY_TRANSITION_ENTER') && receiverContent.includes('TrackingForegroundService.onActivityTransitionChanged')
);

// 6. Registro en AndroidManifest.xml
assert(
  'Manifest declara TrackingForegroundService con tipo location',
  manifestContent.includes('android:name="com.routrack.mobile.services.TrackingForegroundService"') &&
  manifestContent.includes('android:foregroundServiceType="location"')
);
assert(
  'Manifest declara ActivityTransitionReceiver',
  manifestContent.includes('android:name="com.routrack.mobile.services.ActivityTransitionReceiver"')
);
assert(
  'Manifest incluye permisos obligatorios de FOREGROUND_SERVICE y ACTIVITY_RECOGNITION',
  manifestContent.includes('android.permission.FOREGROUND_SERVICE') &&
  manifestContent.includes('android.permission.ACTIVITY_RECOGNITION')
);

console.log(`\nRESUMEN FINAL: ${passed} aserciones aprobadas de ${passed + failed} evaluadas. Errores: ${failed}.`);
if (failed > 0) process.exit(1);

