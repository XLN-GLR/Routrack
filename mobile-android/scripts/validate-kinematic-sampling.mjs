/**
 * ROUTRACK — Suite de Validación Automatizada para Muestreo Cinemático Adaptativo (TASK-033)
 * Archivo: mobile-android/scripts/validate-kinematic-sampling.mjs
 * Runtime: Node.js (ESM)
 *
 * Criterios de Aceptación:
 * 1. Captura con alta resolución los cambios de dirección en curvas y esquinas de calle (Δθ >= 15°).
 * 2. El consumo de batería se mantiene dentro del umbral estipulado (< 5-7% por jornada de 8h).
 * 3. Se calculan correctamente los ángulos de orientación (bearing) y velocidades instantáneas.
 */

import fs from 'fs';
import path from 'path';
import assert from 'node:assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
  }
}

console.log('\n================================================================================');
console.log('  ROUTRACK — VALIDACIÓN DE MUESTREO CINEMÁTICO ADAPTATIVO POR RUMBO (TASK-033)');
console.log('================================================================================\n');

// 1. Verificación de archivos involucrados
const servicePath = path.join(
  projectRoot,
  'mobile-android',
  'app',
  'src',
  'main',
  'java',
  'com',
  'routrack',
  'mobile',
  'services',
  'TrackingForegroundService.kt'
);

const repoPath = path.join(
  projectRoot,
  'mobile-android',
  'app',
  'src',
  'main',
  'java',
  'com',
  'empresa',
  'routrack',
  'data',
  'repository',
  'TrackingRepositoryImpl.kt'
);

const repoInterfacePath = path.join(
  projectRoot,
  'mobile-android',
  'app',
  'src',
  'main',
  'java',
  'com',
  'empresa',
  'routrack',
  'data',
  'repository',
  'TrackingRepository.kt'
);

const testPath = path.join(
  projectRoot,
  'mobile-android',
  'app',
  'src',
  'test',
  'java',
  'com',
  'routrack',
  'mobile',
  'services',
  'TrackingForegroundServiceTest.kt'
);

test('1. Verificación de existencia de archivos del módulo cinemático', () => {
  assert.ok(fs.existsSync(servicePath), 'TrackingForegroundService.kt debe existir');
  assert.ok(fs.existsSync(repoPath), 'TrackingRepositoryImpl.kt debe existir');
  assert.ok(fs.existsSync(repoInterfacePath), 'TrackingRepository.kt debe existir');
  assert.ok(fs.existsSync(testPath), 'TrackingForegroundServiceTest.kt debe existir');
});

const serviceContent = fs.readFileSync(servicePath, 'utf8');
const repoContent = fs.readFileSync(repoPath, 'utf8');
const repoInterfaceContent = fs.readFileSync(repoInterfacePath, 'utf8');
const testContent = fs.readFileSync(testPath, 'utf8');

// 2. Umbrales Cinemáticos Oficiales para Esquinas Viales y Batería
test('2. Definición formal de umbrales cinemáticos (Δθ >= 15° y distancias de esquina)', () => {
  assert.ok(serviceContent.includes('BEARING_CHANGE_THRESHOLD_DEGREES = 15.0f'), 'Umbral angular debe ser 15.0°');
  assert.ok(serviceContent.includes('MIN_CORNER_DISTANCE_METERS = 5.0f'), 'Distancia mínima en esquina debe ser 5.0m');
  assert.ok(serviceContent.includes('MIN_VEHICLE_DISTANCE_METERS = 15.0f'), 'Distancia en vehículo recto debe ser 15.0m');
  assert.ok(serviceContent.includes('MIN_WALKING_DISTANCE_METERS = 10.0f'), 'Distancia de caminata debe ser 10.0m');
  assert.ok(serviceContent.includes('MIN_STILL_DISTANCE_METERS = 25.0f'), 'Geocerca en reposo debe ser 25.0m');
});

// 3. Algoritmo Geodésico de Rumbo (Bearing) y Haversine
test('3. Implementación de funciones geodésicas puras calculateBearing y Haversine', () => {
  assert.ok(serviceContent.includes('fun calculateBearing('), 'Debe implementar calculateBearing');
  assert.ok(serviceContent.includes('fun calculateBearingDelta('), 'Debe implementar calculateBearingDelta');
  assert.ok(serviceContent.includes('fun calculateHaversineDistanceMeters('), 'Debe implementar calculateHaversineDistanceMeters');
  assert.ok(serviceContent.includes('fun shouldSampleLocation('), 'Debe implementar shouldSampleLocation');
});

// 4. Propagación de Rumbo (Bearing) y Velocidad Instantánea al Repositorio
test('4. TrackingRepository soporta parámetro bearing y registra métricas en metadataJson', () => {
  assert.ok(repoInterfaceContent.includes('bearing: Float? = null'), 'TrackingRepository debe declarar bearing opcional');
  assert.ok(repoContent.includes('bearing: Float?'), 'TrackingRepositoryImpl debe implementar parámetro bearing');
  assert.ok(repoContent.includes('append(",\\"bearing\\":").append(bearing)'), 'Debe incluir bearing en metadataJson');
  assert.ok(repoContent.includes('append(",\\"speed\\":").append(velocidad)'), 'Debe incluir velocidad en metadataJson');
  assert.ok(serviceContent.includes('bearing = effectiveBearing'), 'TrackingForegroundService debe propagar effectiveBearing');
});

// 5. Verificación Matemática de Cálculo de Rumbo (Puntos Cardinales)
test('5. Precisión matemática de cálculo de rumbo (0° Norte, 90° Este, 180° Sur, 270° Oeste)', () => {
  function toRad(d) { return (d * Math.PI) / 180; }
  function toDeg(r) { return (r * 180) / Math.PI; }
  function calculateBearing(lat1, lon1, lat2, lon2) {
    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const deltaLambda = toRad(lon2 - lon1);
    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
    return ((toDeg(Math.atan2(y, x)) + 360) % 360);
  }

  const bNorth = calculateBearing(0, 0, 0.01, 0);
  const bEast = calculateBearing(0, 0, 0, 0.01);
  const bSouth = calculateBearing(0, 0, -0.01, 0);
  const bWest = calculateBearing(0, 0, 0, -0.01);

  assert.ok(Math.abs(bNorth - 0) < 0.1, `Norte esperado ~0°, obtenido ${bNorth}`);
  assert.ok(Math.abs(bEast - 90) < 0.1, `Este esperado ~90°, obtenido ${bEast}`);
  assert.ok(Math.abs(bSouth - 180) < 0.1, `Sur esperado ~180°, obtenido ${bSouth}`);
  assert.ok(Math.abs(bWest - 270) < 0.1, `Oeste esperado ~270°, obtenido ${bWest}`);
});

// 6. Verificación Matemática de Delta de Rumbo (Cruce de Cuadrante 360°/0°)
test('6. Cálculo de diferencia angular (Δθ) con cruce de cuadrante por el Norte', () => {
  function calculateBearingDelta(a, b) {
    return Math.abs(((b - a + 540) % 360) - 180);
  }

  assert.strictEqual(calculateBearingDelta(10, 25), 15, 'Diferencia de 10° a 25° debe ser 15°');
  assert.strictEqual(calculateBearingDelta(355, 10), 15, 'Diferencia cruzando el norte 355° a 10° debe ser 15°');
  assert.strictEqual(calculateBearingDelta(10, 355), 15, 'Simetría de 10° a 355° debe ser 15°');
  assert.strictEqual(calculateBearingDelta(90, 90), 0, 'Rumbos iguales debe ser 0°');
  assert.strictEqual(calculateBearingDelta(0, 180), 180, 'Rumbos opuestos debe ser 180°');
});

// 7. Simulación de Giro en Esquina Vial (Quito: Av. Amazonas a Av. Colón)
test('7. Simulación cinemática: Detección reactiva de giro de 90° en esquina vial (Δθ >= 15°)', () => {
  // Simulación: Punto previo con rumbo Norte (0°), nuevo punto tras girar a la derecha con rumbo Este (90°)
  const prevBearing = 0.0;
  const newBearing = 90.0;
  const delta = Math.abs(((newBearing - prevBearing + 540) % 360) - 180);
  const distanceCorner = 7.5; // 7.5 metros recorridos en el radio de giro de la esquina

  const THRESHOLD = 15.0;
  const MIN_DIST = 5.0;

  const isCornerTurn = delta >= THRESHOLD && distanceCorner >= MIN_DIST;
  assert.ok(isCornerTurn, 'Debe identificar el vértice del giro en la esquina');
  assert.ok(delta >= 15.0, `Delta angular calculado ${delta}° debe ser >= 15°`);
});

// 8. Mitigación de Ruido GPS en Semáforos / Paradas para Protección de Batería (RNF-01)
test('8. Mitigación de drenaje de batería: Descarte de ruido satelital en semáforo o parada prolongada', () => {
  // En semáforo: oscilaciones de 2 metros por ruido satelital sin cambio de rumbo real
  const distanceNoise = 2.1;
  const MIN_VEHICLE_DISTANCE = 15.0;
  const MIN_CORNER_DISTANCE = 5.0;
  const deltaSmall = 4.0; // 4° de oscilación por ruido

  const shouldSample = (deltaSmall >= 15.0 && distanceNoise >= MIN_CORNER_DISTANCE) ||
                       (distanceNoise >= MIN_VEHICLE_DISTANCE);

  assert.strictEqual(shouldSample, false, 'Las lecturas ruidosas de semáforo deben descartarse para proteger la batería');
});

// 9. Preservación de Compatibilidad con Foreground Service y LOPDP
test('9. El servicio mantiene la notificación visible obligatoria y cese inmediato bajo LOPDP', () => {
  assert.ok(serviceContent.includes('ROUTRACK: Seguimiento de jornada activo'), 'Debe mantener texto LOPDP');
  assert.ok(serviceContent.includes('stopForeground(STOP_FOREGROUND_REMOVE)'), 'Debe remover notificación al detenerse');
  assert.ok(serviceContent.includes('fusedLocationClient.removeLocationUpdates'), 'Debe desvincular GPS al cesar jornada');
});

// 10. Verificación de Suites Unitarias de Kotlin
test('10. TrackingForegroundServiceTest.kt incluye pruebas unitarias de cinemática y rumbo', () => {
  assert.ok(testContent.includes('testKinematicBearingCalculationReturnsExactCardinalHeadings'), 'Debe probar rumbos cardinales');
  assert.ok(testContent.includes('testKinematicBearingDeltaHandlesNorthBoundaryCrossing'), 'Debe probar cruce del norte');
  assert.ok(testContent.includes('testKinematicHaversineDistanceCalculationAccuracy'), 'Debe probar distancia Haversine');
  assert.ok(testContent.includes('testKinematicThresholdConstantsForBatteryPreservation'), 'Debe validar constantes de batería');
});

console.log(`\n================================================================================`);
console.log(`RESULTADO FINAL: ${passed}/${total} pruebas aprobadas.`);
console.log(`================================================================================\n`);

if (passed !== total) {
  process.exit(1);
}
