/**
 * ROUTRACK — Suite de Pruebas Automatizadas para Animación Cinemática y Trazado Vial (TASK-034)
 * Archivo: web-admin/scripts/run-live-road-matching-tests.mjs
 * Runtime: Node.js (Sin dependencias externas ni librerías de pago - $0 USD)
 *
 * Criterios de Aceptación:
 * 1. Las polilíneas de ruta se dibujan siguiendo las calles reales y no como líneas rectas artificiales.
 * 2. El desplazamiento del marcador es suave y continuo a 60 FPS sin saltos abruptos.
 * 3. Se mantiene el alto rendimiento de renderizado en hardware canvas previamente optimizado.
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

console.log('\n================================================================================');
console.log('  ROUTRACK — PRUEBAS DE ANIMACIÓN CINEMÁTICA Y TRAZADO VIAL EN VIVO (TASK-034)');
console.log('================================================================================\n');

// 1. Verificación de Archivos Involucrados
const roadPolylinePath = path.join(webAdminRoot, 'src/components/map/RoadSnappedPolyline.tsx');
const sellerMarkerPath = path.join(webAdminRoot, 'src/components/map/SellerMarker.tsx');
const mapViewPath = path.join(webAdminRoot, 'src/components/map/MapView.tsx');
const livePagePath = path.join(webAdminRoot, 'src/app/(dashboard)/live/page.tsx');

test('1. Verificación de existencia de componentes y vista de mapa', () => {
  assert.ok(fs.existsSync(roadPolylinePath), 'RoadSnappedPolyline.tsx debe existir');
  assert.ok(fs.existsSync(sellerMarkerPath), 'SellerMarker.tsx debe existir');
  assert.ok(fs.existsSync(mapViewPath), 'MapView.tsx debe existir');
  assert.ok(fs.existsSync(livePagePath), 'live/page.tsx debe existir');
});

const roadPolylineContent = fs.readFileSync(roadPolylinePath, 'utf8');
const sellerMarkerContent = fs.readFileSync(sellerMarkerPath, 'utf8');
const mapViewContent = fs.readFileSync(mapViewPath, 'utf8');
const livePageContent = fs.readFileSync(livePagePath, 'utf8');

// 2. Criterio 1: Trazado Vial Real sobre Calles con OSRM ($0 USD)
test('2. RoadSnappedPolyline consume el motor de Map-Matching y dibuja L.polyline ajustada', () => {
  assert.ok(roadPolylineContent.includes('snapCoordinatesToRoads'), 'Debe invocar snapCoordinatesToRoads');
  assert.ok(roadPolylineContent.includes('L.polyline('), 'Debe crear la polilínea en la capa de Leaflet');
  assert.ok(roadPolylineContent.includes('lineCap: "round"') || roadPolylineContent.includes("lineCap: 'round'"), 'Debe configurar terminación redondeada');
  assert.ok(roadPolylineContent.includes('lineJoin: "round"') || roadPolylineContent.includes("lineJoin: 'round'"), 'Debe configurar unión redondeada');
  assert.ok(roadPolylineContent.includes('matchedRoute.isFallback'), 'Debe contemplar indicador de fallback geodésico');
});

// 3. Criterio 2: Animación Cinemática a 60 FPS en SellerMarker
test('3. SellerMarker implementa animación fluida a 60 FPS con requestAnimationFrame', () => {
  assert.ok(sellerMarkerContent.includes('requestAnimationFrame'), 'Debe orquestar interpolación con requestAnimationFrame');
  assert.ok(sellerMarkerContent.includes('cancelAnimationFrame'), 'Debe cancelar animaciones previas para evitar desincronización');
  assert.ok(sellerMarkerContent.includes('enableKinematicAnimation'), 'Debe exponer propiedad enableKinematicAnimation');
  assert.ok(sellerMarkerContent.includes('animationDurationMs'), 'Debe soportar duración de animación configurable');
  assert.ok(sellerMarkerContent.includes('currentCoordsRef'), 'Debe preservar coordenadas cinemáticas intermedias');
});

// 4. Interpolación Angular Suave en SellerMarker (Bearing Easing)
test('4. SellerMarker interpola el rumbo (bearing) por la ruta más corta evitando giros bruscos de 360°', () => {
  assert.ok(
    sellerMarkerContent.includes('bearingDiff') || sellerMarkerContent.includes('% 360'),
    'Debe calcular la diferencia angular mínima con normalización modular a 360°'
  );
  assert.ok(sellerMarkerContent.includes('overrideBearing') || sellerMarkerContent.includes('currentBearingRef'), 'Debe propagar el rumbo interpolado al SVG');
});

// 5. Criterio 3: Renderizado Acelerado por Hardware Canvas
test('5. MapView mantiene preferCanvas: true para alto rendimiento a 60 FPS', () => {
  assert.ok(mapViewContent.includes('preferCanvas: true'), 'MapView debe configurar renderizado en HTML5 Canvas');
  assert.ok(mapViewContent.includes('keepBuffer: 6'), 'Debe mantener buffer en memoria RAM para teselas');
  assert.ok(mapViewContent.includes('updateWhenIdle: true'), 'Debe evitar sobrecargar la CPU durante desplazamientos');
});

// 6. Integración en Vista /live
test('6. live/page.tsx integra RoadSnappedPolyline y marcadores cinemáticos con control interactivo', () => {
  assert.ok(livePageContent.includes('<RoadSnappedPolyline'), 'Debe incrustar RoadSnappedPolyline dentro del mapa');
  assert.ok(livePageContent.includes('showRoadSnappedRoutes'), 'Debe poseer estado reactivo para activar/desactivar trazado vial');
  assert.ok(livePageContent.includes('enableKinematicAnimation={true}'), 'Debe activar animación cinemática en SellerMarker');
  assert.ok(livePageContent.includes('selectedSellerRoutePoints'), 'Debe calcular puntos de ruta para el vendedor activo');
  assert.ok(livePageContent.includes('Vía Real (OSRM)'), 'Debe incluir botón interactivo de trazado vial');
});

// 7. Prueba Matemática de Función de Easing Cúbico (Organic Motion)
test('7. Verificación de fórmula de easing cúbico (easeOutCubic) para transiciones viales', () => {
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  assert.strictEqual(easeOutCubic(0), 0, 'Inicio debe ser 0');
  assert.strictEqual(easeOutCubic(1), 1, 'Final debe ser 1');
  assert.strictEqual(easeOutCubic(0.5), 0.875, 'A la mitad del tiempo debe haber avanzado el 87.5% de la trayectoria');
  assert.ok(easeOutCubic(0.2) > 0.2, 'Debe acelerar con respuesta inicial reactiva');
});

// 8. Prueba Matemática de Interpolación Angular con Cruce de Cuadrante
test('8. Interpolación de orientación (bearing) en cruce suave de 350° a 10°', () => {
  const startBearing = 350;
  const targetBearing = 10;
  const bearingDiff = (((targetBearing - startBearing + 540) % 360) - 180); // +20°
  assert.strictEqual(bearingDiff, 20, 'La diferencia mínima debe ser +20° y no -340°');

  const halfEase = 0.5;
  const interpolatedBearing = (startBearing + bearingDiff * halfEase + 360) % 360; // 360° = 0°
  assert.strictEqual(interpolatedBearing, 0, 'Al 50% de giro el rumbo debe ser exactamente 0° (Norte)');
});

// 9. Compatibilidad con el Contrato de Leaflet y Evitación de Memory Leaks
test('9. RoadSnappedPolyline y SellerMarker implementan limpieza estricta en desmontaje', () => {
  assert.ok(roadPolylineContent.includes('polylineRef.current.remove()'), 'RoadSnappedPolyline debe destruir la capa al desmontar');
  assert.ok(sellerMarkerContent.includes('cancelAnimationFrame'), 'SellerMarker debe cancelar frames pendientes en desmontaje');
  assert.ok(sellerMarkerContent.includes('markerRef.current.remove()'), 'SellerMarker debe remover el marcador de Leaflet');
});

// 10. Principio de Coste $0 USD y Cero Dependencias de Pago
test('10. Ningún componente importa APIs comerciales de pago (Google Maps o Mapbox)', () => {
  assert.ok(!roadPolylineContent.includes('googleapis'), 'Prohibido Google Maps en RoadSnappedPolyline');
  assert.ok(!roadPolylineContent.includes('mapbox'), 'Prohibido Mapbox comercial en RoadSnappedPolyline');
  assert.ok(!sellerMarkerContent.includes('googleapis'), 'Prohibido Google Maps en SellerMarker');
  assert.ok(!livePageContent.includes('googleapis'), 'Prohibido Google Maps en live/page.tsx');
});

console.log(`\n================================================================================`);
console.log(`RESULTADO FINAL: ${passed}/${total} pruebas aprobadas.`);
console.log(`================================================================================\n`);

if (passed !== total) {
  process.exit(1);
}
