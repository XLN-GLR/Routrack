/**
 * ROUTRACK — Suite de Pruebas Unitarias para Visor de Mapas Leaflet (TASK-014)
 * Archivo: web-admin/scripts/run-map-tests.mjs
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

console.log('--- INICIANDO SUITE DE PRUEBAS DEL VISOR DE MAPAS (TASK-014) ---');

const mapViewPath = path.join(webAdminRoot, 'src/components/map/MapView.tsx');
const mapWrapperPath = path.join(webAdminRoot, 'src/components/map/MapContainerWrapper.tsx');
const livePagePath = path.join(webAdminRoot, 'src/app/(dashboard)/live/page.tsx');

// 1. Verificación de existencia de componentes
assert(fs.existsSync(mapViewPath), 'Prueba 1: Componente MapView.tsx existe en src/components/map');
assert(fs.existsSync(mapWrapperPath), 'Prueba 2: Componente MapContainerWrapper.tsx existe en src/components/map');
assert(fs.existsSync(livePagePath), 'Prueba 3: Página /live integra el visor cartográfico');

const mapViewContent = fs.readFileSync(mapViewPath, 'utf8');
const mapWrapperContent = fs.readFileSync(mapWrapperPath, 'utf8');
const livePageContent = fs.readFileSync(livePagePath, 'utf8');

// 2. Criterio 1: Carga dinámica y prevención de errores de hidratación SSR
assert(
  mapWrapperContent.includes('ssr: false'),
  'Prueba 4 (Criterio 1): MapContainerWrapper implementa carga dinámica con { ssr: false } para prevenir errores de hidratación'
);
assert(
  mapWrapperContent.includes('MapLoadingSkeleton'),
  'Prueba 5 (Criterio 1): MapContainerWrapper provee skeleton visual con spinner durante la carga en cliente'
);
assert(
  mapViewContent.startsWith('"use client";'),
  'Prueba 6: MapView.tsx está marcado formalmente como Client Component ("use client")'
);

// 3. Criterio 2: Proveedor de teselas responde a NEXT_PUBLIC_MAP_TILE_PROVIDER_URL
assert(
  mapViewContent.includes('process.env.NEXT_PUBLIC_MAP_TILE_PROVIDER_URL'),
  'Prueba 7 (Criterio 2): MapView lee la variable de entorno NEXT_PUBLIC_MAP_TILE_PROVIDER_URL'
);
assert(
  mapViewContent.includes('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
  'Prueba 8 (Criterio 2): MapView define URL por defecto de OpenStreetMap ($0 USD)'
);
assert(
  mapViewContent.includes('NEXT_PUBLIC_MAP_ATTRIBUTION'),
  'Prueba 9: MapView lee y aplica la atribución oficial de OpenStreetMap'
);

// 4. Parámetros geográficos y controles interactivos
assert(
  mapViewContent.includes('-0.180653') && mapViewContent.includes('-78.467834'),
  'Prueba 10: Coordenadas geográficas por defecto centradas en Quito, Ecuador ([-0.180653, -78.467834])'
);
assert(
  mapViewContent.includes('DEFAULT_MAP_ZOOM = 13') || mapViewContent.includes('zoom = 13') || mapViewContent.includes('zoom = DEFAULT_MAP_ZOOM'),
  'Prueba 11: Nivel de zoom inicial predeterminado en 13 para resolución a nivel de calle'
);
assert(
  mapViewContent.includes('handleZoomIn') &&
  mapViewContent.includes('handleZoomOut') &&
  mapViewContent.includes('handleRecenter'),
  'Prueba 12: Controles personalizados de Zoom In, Zoom Out y Recentrado implementados'
);

// 5. Integración en la vista de monitoreo en vivo (/live)
assert(
  livePageContent.includes('MapContainerWrapper'),
  'Prueba 13: Vista /live importa e incrusta MapContainerWrapper'
);
assert(
  !livePageContent.includes('El componente interactivo de mapas se integrará formalmente'),
  'Prueba 14: Placeholder de desarrollo anterior fue removido de la vista /live'
);

console.log(`\nRESUMEN FINAL: ${passed} pruebas aprobadas de ${passed + failed} evaluadas. Errores: ${failed}.`);
if (failed > 0) process.exit(1);
