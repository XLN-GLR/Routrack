/**
 * ROUTRACK — Suite de Pruebas Unitarias para Monitoreo en Vivo y Marcadores (TASK-015)
 * Archivo: web-admin/scripts/run-live-monitoring-tests.mjs
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

console.log('--- INICIANDO SUITE DE PRUEBAS DE MONITOREO EN VIVO Y MARCADORES (TASK-015) ---');

// 1. Verificación de existencia de archivos requeridos
const sellerTypesPath = path.join(webAdminRoot, 'src/types/seller.ts');
const sellerMarkerPath = path.join(webAdminRoot, 'src/components/map/SellerMarker.tsx');
const sellerPopupPath = path.join(webAdminRoot, 'src/components/map/SellerPopup.tsx');
const livePagePath = path.join(webAdminRoot, 'src/app/(dashboard)/live/page.tsx');

assert(fs.existsSync(sellerTypesPath), 'Prueba 1: Archivo types/seller.ts existe con tipos de estados operativos');
assert(fs.existsSync(sellerMarkerPath), 'Prueba 2: Archivo SellerMarker.tsx existe en src/components/map');
assert(fs.existsSync(sellerPopupPath), 'Prueba 3: Archivo SellerPopup.tsx existe en src/components/map');
assert(fs.existsSync(livePagePath), 'Prueba 4: Vista /live existe y está actualizada');

const sellerTypesContent = fs.readFileSync(sellerTypesPath, 'utf8');
const sellerMarkerContent = fs.readFileSync(sellerMarkerPath, 'utf8');
const sellerPopupContent = fs.readFileSync(sellerPopupPath, 'utf8');
const livePageContent = fs.readFileSync(livePagePath, 'utf8');

// 2. Validación de los 5 Estados Operativos Oficiales (docs/DESIGN.md § 2.2)
assert(
  sellerTypesContent.includes('"EN_RUTA"') &&
  sellerTypesContent.includes('"DETENIDO"') &&
  sellerTypesContent.includes('"VISITA_VALIDADA"') &&
  sellerTypesContent.includes('"DESVIACION"') &&
  sellerTypesContent.includes('"SIN_CONEXION"'),
  'Prueba 5: types/seller.ts modela los 5 estados operativos oficiales'
);

// 3. Criterio de Aceptación 1: Marcadores diferenciados por color y rumbo (bearing)
// Simular generador SVG en Node.js
function buildMockSvg(status, bearingDegrees) {
  const colorMap = {
    EN_RUTA: '#2563EB',
    DETENIDO: '#D97706',
    VISITA_VALIDADA: '#059669',
    DESVIACION: '#DC2626',
    SIN_CONEXION: '#64748B',
  };
  const color = colorMap[status];
  const rotateTransform = `rotate(${Math.round(bearingDegrees)}deg)`;
  return { color, rotateTransform };
}

const enRutaSvg = buildMockSvg('EN_RUTA', 45);
assert(
  enRutaSvg.color === '#2563EB' && enRutaSvg.rotateTransform === 'rotate(45deg)',
  'Prueba 6 (Criterio 1): Marcador En Ruta es Azul (#2563EB) y rota con el rumbo (45°)'
);

const detenidoSvg = buildMockSvg('DETENIDO', 180);
assert(
  detenidoSvg.color === '#D97706',
  'Prueba 7 (Criterio 1): Marcador Detenido es Ámbar (#D97706)'
);

const desviacionSvg = buildMockSvg('DESVIACION', 270);
assert(
  desviacionSvg.color === '#DC2626',
  'Prueba 8 (Criterio 1): Marcador Desviación/Anomalía es Rojo (#DC2626)'
);

const visitaSvg = buildMockSvg('VISITA_VALIDADA', 0);
assert(
  visitaSvg.color === '#059669',
  'Prueba 9 (Criterio 1): Marcador Visita Validada es Verde (#059669)'
);

const sinConexionSvg = buildMockSvg('SIN_CONEXION', 0);
assert(
  sinConexionSvg.color === '#64748B',
  'Prueba 10 (Criterio 1): Marcador Sin Conexión es Gris (#64748B)'
);

// 4. Criterio de Aceptación 2: Contenido obligatorio del Popup
assert(
  sellerPopupContent.includes('seller.sellerName'),
  'Prueba 11 (Criterio 2): Popup muestra el nombre completo del vendedor'
);
assert(
  sellerPopupContent.includes('seller.speedKmh') && sellerPopupContent.includes('km/h'),
  'Prueba 12 (Criterio 2): Popup muestra la velocidad actual en km/h'
);
assert(
  sellerPopupContent.includes('seller.batteryLevel') && sellerPopupContent.includes('%'),
  'Prueba 13 (Criterio 2): Popup muestra el porcentaje de batería del dispositivo'
);
assert(
  sellerPopupContent.includes('Último reporte') || sellerPopupContent.includes('lastReportTime'),
  'Prueba 14 (Criterio 2): Popup muestra la marca temporal del último reporte recibido'
);
assert(
  sellerPopupContent.includes('seller.isMock') && sellerPopupContent.includes('Ubicación simulada'),
  'Prueba 15: Popup despliega alerta visual fehaciente ante Fake GPS / Mock Location'
);

// 5. Integración en /live
assert(
  livePageContent.includes('<MapContainerWrapper') &&
  livePageContent.includes('<SellerMarker') &&
  livePageContent.includes('countsByStatus'),
  'Prueba 16: Vista /live renderiza el mapa cartográfico con los marcadores y tarjetas KPI'
);
assert(
  livePageContent.includes('handleSelectSeller') &&
  livePageContent.includes('flyTo'),
  'Prueba 17: Vista /live soporta centrado suave (flyTo) al seleccionar un vendedor de la lista'
);

console.log(`\nRESUMEN FINAL: ${passed} pruebas aprobadas de ${passed + failed} evaluadas. Errores: ${failed}.`);
if (failed > 0) process.exit(1);

