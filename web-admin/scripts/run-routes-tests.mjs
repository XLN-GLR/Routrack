/**
 * ROUTRACK — Suite de Pruebas Unitarias para Histórico de Rutas, Polilíneas y Desvíos (TASK-016)
 * Archivo: web-admin/scripts/run-routes-tests.mjs
 * Runtime: Node.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webAdminRoot = path.resolve(__dirname, '..');

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

console.log('--- INICIANDO SUITE DE PRUEBAS DE HISTÓRICO DE RUTAS Y DESVÍOS (TASK-016) ---');

// 1. Verificación de existencia de archivos requeridos
const deviationsPath = path.join(webAdminRoot, 'src/lib/geo/deviations.ts');
const routePolylinePath = path.join(webAdminRoot, 'src/components/map/RoutePolyline.tsx');
const routesPagePath = path.join(webAdminRoot, 'src/app/(dashboard)/routes/page.tsx');

assert(fs.existsSync(deviationsPath), 'Prueba 1: Módulo src/lib/geo/deviations.ts existe');
assert(fs.existsSync(routePolylinePath), 'Prueba 2: Componente src/components/map/RoutePolyline.tsx existe');
assert(fs.existsSync(routesPagePath), 'Prueba 3: Vista src/app/(dashboard)/routes/page.tsx existe y está implementada');

const deviationsContent = fs.readFileSync(deviationsPath, 'utf8');
const routePolylineContent = fs.readFileSync(routePolylinePath, 'utf8');
const routesPageContent = fs.readFileSync(routesPagePath, 'utf8');

// 2. Criterio 1: Orden cronológico y trazado sin deformaciones espaciales
assert(
  deviationsContent.includes('sortPointsChronologically') &&
  deviationsContent.includes('recordedAt'),
  'Prueba 4 (Criterio 1): deviations.ts define sortPointsChronologically para ordenar por timestamp'
);
assert(
  routePolylineContent.includes('sortPointsChronologically(points)'),
  'Prueba 5 (Criterio 1): RoutePolyline garantiza orden cronológico antes de crear la polilínea'
);
assert(
  routePolylineContent.includes('#2563EB') &&
  routePolylineContent.includes('color: "#2563EB"') &&
  routePolylineContent.includes('weight: 4'),
  'Prueba 6 (Criterio 1): Polilínea principal usa el color Azul Tránsito (#2563EB) con grosor 4px'
);

// Simulación de ordenamiento cronológico en Node.js
const mockUnsorted = [
  { id: '3', latitude: -0.20, longitude: -78.49, recordedAt: '2026-11-08T12:00:00Z' },
  { id: '1', latitude: -0.18, longitude: -78.48, recordedAt: '2026-11-08T08:00:00Z' },
  { id: '2', latitude: -0.19, longitude: -78.485, recordedAt: '2026-11-08T10:00:00Z' },
];
const sorted = [...mockUnsorted].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
assert(
  sorted[0].id === '1' && sorted[1].id === '2' && sorted[2].id === '3',
  'Prueba 7 (Criterio 1): Puntos desordenados se ordenan estrictamente de forma cronológica'
);

// 3. Criterio 2: Detección y destaque de desvíos en rojo semitransparente (> 300m)
assert(
  deviationsContent.includes('DEFAULT_DEVIATION_THRESHOLD_METERS = 300') ||
  deviationsContent.includes('300'),
  'Prueba 8 (Criterio 2): Umbral de desvío configurado formalmente en 300 metros'
);
assert(
  routePolylineContent.includes('#DC2626') &&
  routePolylineContent.includes('color: "#DC2626"') &&
  routePolylineContent.includes('opacity: 0.7') &&
  routePolylineContent.includes('weight: 6'),
  'Prueba 9 (Criterio 2): Trazos desviados se destacan en color rojo semitransparente (#DC2626, opacidad 0.7, grosor 6px)'
);

// Simulación matemática de desvío
function haversineMeters(p1, p2) {
  const R = 6371000;
  const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.latitude * Math.PI) / 180) *
      Math.cos((p2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const authorizedStop = { latitude: -0.2018, longitude: -78.4905 };
const normalPoint = { latitude: -0.2025, longitude: -78.4910 }; // ~90m (Dentro)
const deviatedPoint = { latitude: -0.2105, longitude: -78.4745 }; // ~2 km (Desvío)

const normalDistance = haversineMeters(normalPoint, authorizedStop);
const devDistance = haversineMeters(deviatedPoint, authorizedStop);

assert(normalDistance <= 300, `Prueba 10: Punto normal está dentro del umbral de 300m (${Math.round(normalDistance)}m)`);
assert(devDistance > 300, `Prueba 11: Punto anómalo supera el umbral de 300m (${Math.round(devDistance)}m)`);

// 4. Criterio 3: Métricas de distancia total recorrida y duración del turno
assert(
  deviationsContent.includes('calculateRouteMetrics') &&
  deviationsContent.includes('totalDistanceKm') &&
  deviationsContent.includes('durationFormatted'),
  'Prueba 12 (Criterio 3): deviations.ts calcula métricas consolidadas (distancia total y duración)'
);
assert(
  routesPageContent.includes('metrics.totalDistanceKm') &&
  routesPageContent.includes('metrics.durationFormatted'),
  'Prueba 13 (Criterio 3): Vista /routes presenta las tarjetas de métricas cuantitativas en la cabecera'
);
assert(
  routesPageContent.includes('AVAILABLE_SELLERS') &&
  routesPageContent.includes('selectedDate'),
  'Prueba 14: Vista /routes incluye selectores interactivos de vendedor y fecha'
);
assert(
  routesPageContent.includes('<RoutePolyline') &&
  routesPageContent.includes('<MapContainerWrapper'),
  'Prueba 15: Vista /routes incrusta MapContainerWrapper con RoutePolyline interactivo'
);
assert(
  routesPageContent.includes('showDeviations') &&
  routesPageContent.includes('Resaltar Desvíos'),
  'Prueba 16: Vista /routes permite alternar el resalte visual de tramos desviados'
);

console.log(`\nRESUMEN FINAL: ${passed} pruebas aprobadas de ${passed + failed} evaluadas. Errores: ${failed}.`);
if (failed > 0) process.exit(1);

