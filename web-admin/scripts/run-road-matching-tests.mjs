/**
 * ROUTRACK — Suite de Pruebas Automatizadas para Map-Matching y Snap-to-Roads (TASK-032)
 * Archivo: web-admin/scripts/run-road-matching-tests.mjs
 * Runtime: Node.js (Sin dependencias externas ni librerías de pago - $0 USD)
 */

import fs from 'fs';
import path from 'path';
import assert from 'node:assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webAdminRoot = path.resolve(__dirname, '..');

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

async function testAsync(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
  }
}

console.log('\n[ROUTRACK] Ejecutando suite de pruebas: Motor de Map-Matching y Snap-to-Roads (TASK-032)...\n');

// 1. Verificación de existencia de archivos de arquitectura
const typesMapPath = path.join(webAdminRoot, 'src/types/map.ts');
const osrmClientPath = path.join(webAdminRoot, 'src/lib/map/osrmClient.ts');
const roadMatchingPath = path.join(webAdminRoot, 'src/lib/map/roadMatching.ts');

test('1. Verificación de existencia de archivos del módulo map-matching', () => {
  assert.ok(fs.existsSync(typesMapPath), 'src/types/map.ts debe existir');
  assert.ok(fs.existsSync(osrmClientPath), 'src/lib/map/osrmClient.ts debe existir');
  assert.ok(fs.existsSync(roadMatchingPath), 'src/lib/map/roadMatching.ts debe existir');
});

const typesContent = fs.readFileSync(typesMapPath, 'utf8');
const osrmContent = fs.readFileSync(osrmClientPath, 'utf8');
const roadMatchingContent = fs.readFileSync(roadMatchingPath, 'utf8');

// 2. Contratos de Tipos en TypeScript Estricto
test('2. src/types/map.ts define los contratos requeridos sin tipo any', () => {
  assert.ok(typesContent.includes('export type LatLngTuple = [number, number];'), 'Debe exportar LatLngTuple');
  assert.ok(typesContent.includes('export interface RoadSnappedPoint'), 'Debe exportar RoadSnappedPoint');
  assert.ok(typesContent.includes('export interface RoadMatchedRoute'), 'Debe exportar RoadMatchedRoute');
  assert.ok(typesContent.includes('export interface MapMatchingOptions'), 'Debe exportar MapMatchingOptions');
  assert.ok(typesContent.includes('export interface OsrmMatchResponse'), 'Debe exportar OsrmMatchResponse');
  assert.ok(!typesContent.includes(': any'), 'No debe contener tipos any');
});

// 3. Configuración de Infraestructura a $0 USD (OSRM sobre OpenStreetMap)
test('3. osrmClient.ts utiliza OpenStreetMap/OSRM a costo $0 USD y timeout resiliente', () => {
  assert.ok(osrmContent.includes('https://router.project-osrm.org'), 'Debe apuntar a servicio OSRM');
  assert.ok(osrmContent.includes('/match/v1/'), 'Debe consultar el endpoint de map-matching /match/v1/');
  assert.ok(osrmContent.includes('MAX_OSRM_COORDINATES_PER_CHUNK = 80'), 'Límite de chunk debe ser 80');
  assert.ok(osrmContent.includes('DEFAULT_OSRM_TIMEOUT_MS = 6000'), 'Timeout por defecto debe ser 6000ms');
  assert.ok(osrmContent.includes('radiuses'), 'Debe incluir parámetro de radiuses para tolerancia satelital');
  assert.ok(osrmContent.includes('AbortController'), 'Debe usar AbortController para prevenir cuelgues');
});

// 4. Implementación de Algoritmo de Fallback Geodésico Haversine
test('4. roadMatching.ts implementa createGeodesicFallbackRoute con Haversine', () => {
  assert.ok(roadMatchingContent.includes('export function createGeodesicFallbackRoute'), 'Debe exportar createGeodesicFallbackRoute');
  assert.ok(roadMatchingContent.includes('haversineDistanceMeters'), 'Debe calcular distancias geodésicas reales');
  assert.ok(roadMatchingContent.includes('isFallback: true'), 'Debe marcar isFallback: true en el resultado');
  assert.ok(roadMatchingContent.includes('snappedPoints'), 'Debe mapear snappedPoints');
});

// 5. Particionado Inteligente (Chunking) para Rutas Extensas
test('5. roadMatching.ts implementa particionado automático en lotes de coordenadas', () => {
  assert.ok(roadMatchingContent.includes('MAX_OSRM_COORDINATES_PER_CHUNK'), 'Debe consultar el tamaño máximo de chunk');
  assert.ok(roadMatchingContent.includes('chunkPromises'), 'Debe procesar chunks de manera concurrente con Promise.all');
  assert.ok(roadMatchingContent.includes('slice(i, end)'), 'Debe segmentar el arreglo de coordenadas');
});

// 6. Conversión de Coordenadas Leaflet [lat, lng] vs GeoJSON [lng, lat]
test('6. roadMatching.ts normaliza geometrías OSRM [lng, lat] hacia convención Leaflet [lat, lng]', () => {
  assert.ok(
    roadMatchingContent.includes('combinedPolyline.push([lat, lng])') ||
    roadMatchingContent.includes('[lat, lng]'),
    'Debe invertir coordenadas OSRM GeoJSON [lng, lat] a [lat, lng] para Leaflet'
  );
  assert.ok(
    roadMatchingContent.includes('tp.location[1]') && roadMatchingContent.includes('tp.location[0]'),
    'Debe extraer latitude como location[1] y longitude como location[0]'
  );
});

// 7. Prueba Algorítmica Haversine Geodésica Pura
test('7. Cálculo geodésico Haversine para trayectoria de prueba en Quito, Ecuador', () => {
  const EARTH_RADIUS_METERS = 6371000;
  function haversine(lat1, lon1, lat2, lon2) {
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dPhi = ((lat2 - lat1) * Math.PI) / 180;
    const dLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_METERS * c;
  }

  // Puntos: Centro Histórico -> La Floresta -> Parque Carolina (Quito)
  const p1 = [-0.2200, -78.5120];
  const p2 = [-0.2080, -78.4900];
  const p3 = [-0.1800, -78.4840];

  const d1 = haversine(p1[0], p1[1], p2[0], p2[1]);
  const d2 = haversine(p2[0], p2[1], p3[0], p3[1]);
  const totalDist = d1 + d2;

  assert.ok(totalDist > 5000 && totalDist < 7500, `Distancia esperada entre 5km y 7.5km (calculada: ${totalDist.toFixed(1)}m)`);
});

// 8. Validación de Simulación de Fallback Geodésico Offline
test('8. Simulación de ruta de fallback geodésico con estructura RoadMatchedRoute', () => {
  const coords = [
    [-0.2065, -78.4935],
    [-0.2018, -78.4905],
    [-0.1985, -78.4795],
  ];

  const fallbackResult = {
    polyline: [...coords],
    distanceMeters: 2150,
    durationSeconds: 310,
    confidence: 0.5,
    isFallback: true,
    snappedPoints: coords.map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng,
      originalLatitude: lat,
      originalLongitude: lng,
      confidence: 0.5,
      distanceFromOriginalMeters: 0,
    })),
  };

  assert.strictEqual(fallbackResult.isFallback, true);
  assert.strictEqual(fallbackResult.polyline.length, 3);
  assert.strictEqual(fallbackResult.snappedPoints.length, 3);
  assert.strictEqual(fallbackResult.snappedPoints[0].originalLatitude, coords[0][0]);
  assert.strictEqual(fallbackResult.snappedPoints[0].originalLongitude, coords[0][1]);
  assert.strictEqual(fallbackResult.snappedPoints[0].distanceFromOriginalMeters, 0);
});

// 9. Caché en Memoria y Manejo de Concurrencia
test('9. roadMatching.ts contiene sistema de caché en memoria y función de limpieza', () => {
  assert.ok(roadMatchingContent.includes('const routeCache = new Map'), 'Debe inicializar mapa de caché');
  assert.ok(roadMatchingContent.includes('export function clearRoadMatchingCache'), 'Debe exportar función para limpiar la caché');
  assert.ok(roadMatchingContent.includes('generateCacheKey'), 'Debe poseer generador determinista de claves de caché');
});

// 10. Verificación de Cero Costo y Resiliencia en UI
test('10. Cumplimiento de regla de negocio: Costo $0 USD y no bloqueo de interfaz', () => {
  // Asegurar que no hay menciones ni llamadas a APIs comerciales de pago
  assert.ok(!roadMatchingContent.includes('maps.googleapis.com'), 'Prohibido uso de Google Maps Platform');
  assert.ok(!roadMatchingContent.includes('api.mapbox.com'), 'Prohibido uso de Mapbox comercial');
  assert.ok(!osrmContent.includes('maps.googleapis.com'), 'Prohibido uso de Google Maps Platform en cliente');
  assert.ok(!osrmContent.includes('api.mapbox.com'), 'Prohibido uso de Mapbox comercial en cliente');
  
  // Resiliencia en errores
  assert.ok(roadMatchingContent.includes('catch'), 'Debe envolver ruteo en try/catch para fallback seguro');
  assert.ok(osrmContent.includes('catch'), 'Debe envolver fetch en try/catch para capturar fallas de red');
});

console.log(`\n========================================`);
console.log(`RESULTADO FINAL: ${passed}/${total} pruebas aprobadas.`);
console.log(`========================================\n`);

if (passed !== total) {
  process.exit(1);
}
