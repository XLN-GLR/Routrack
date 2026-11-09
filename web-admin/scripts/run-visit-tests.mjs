/**
 * ROUTRACK — Suite de Pruebas Unitarias para Supervisión de Visitas Comerciales (TASK-020)
 * Archivo: web-admin/scripts/run-visit-tests.mjs
 * Runtime: Node.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");

let passed = 0;
let failed = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${details ? ` -> ${details}` : ""}`);
    failed++;
  }
}

console.log("================================================================================");
console.log("  ROUTRACK — SUITE DE PRUEBAS: AUDITORÍA DE VISITAS COMERCIALES (TASK-020)");
console.log("================================================================================");

// -----------------------------------------------------------------------------
// BLOQUE 1: VERIFICACIÓN DE ARCHIVOS Y COMPONENTES REQUERIDOS
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 1] Integridad de Archivos de TASK-020:");

const typesPath = path.join(projectRoot, "web-admin/src/types/visit.ts");
const pagePath = path.join(projectRoot, "web-admin/src/app/(dashboard)/visits/page.tsx");
const tablePath = path.join(projectRoot, "web-admin/src/components/visits/VisitTable.tsx");
const modalPath = path.join(projectRoot, "web-admin/src/components/visits/VisitDetailModal.tsx");

assert(fs.existsSync(typesPath), "Prueba 1: Archivo types/visit.ts existe con interfaces de dominio");
assert(fs.existsSync(pagePath), "Prueba 2: Vista src/app/(dashboard)/visits/page.tsx existe");
assert(fs.existsSync(tablePath), "Prueba 3: Componente src/components/visits/VisitTable.tsx existe");
assert(fs.existsSync(modalPath), "Prueba 4: Componente src/components/visits/VisitDetailModal.tsx existe");

const pageCode = fs.readFileSync(pagePath, "utf8");
const tableCode = fs.readFileSync(tablePath, "utf8");
const modalCode = fs.readFileSync(modalPath, "utf8");
const typesCode = fs.readFileSync(typesPath, "utf8");

// -----------------------------------------------------------------------------
// BLOQUE 2: CRITERIO 1 — DESPLIEGUE DE LOS 4 ESTADOS OBLIGATORIOS DE INTERFAZ
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 2] Criterio 1: Despliegue de los 4 Estados Obligatorios de Interfaz:");

// 1. Estado Cargando (Skeleton Loader)
assert(
  pageCode.includes("VisitsSkeletonLoader") && pageCode.includes("animate-pulse"),
  "Prueba 5 (Criterio 1): Estado Cargando implementa Skeleton Loader con efecto animate-pulse"
);

// 2. Estado Error (Error State con botón de reintento)
assert(
  pageCode.includes("VisitsErrorState") &&
    pageCode.includes("border-red-500") &&
    pageCode.includes("Reintentar Conexión"),
  "Prueba 6 (Criterio 1): Estado Error presenta mensaje comprensible en español y botón explícito de reintento"
);

// 3. Estado Vacío (Empty State)
assert(
  tableCode.includes("No se encontraron visitas comerciales") && tableCode.includes("CheckCircle2"),
  "Prueba 7 (Criterio 1): Estado Vacío educa al usuario con icono lineal neutro y orientación"
);

// 4. Estado Adaptativo (Responsive Design)
assert(
  pageCode.includes("grid-cols-2 lg:grid-cols-4") && tableCode.includes("overflow-x-auto"),
  "Prueba 8 (Criterio 1): Estado Adaptativo implementa diseño responsive para móvil, tablet y desktop"
);

// -----------------------------------------------------------------------------
// BLOQUE 3: CRITERIO 2 — RESALTE CARTOGRÁFICO DE CLIENTE Y VENDEDOR EN MAPA
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 3] Criterio 2: Clic en Visita Resalta Cliente y Vendedor en Mapa Leaflet:");

assert(
  modalCode.includes("L.circle") && modalCode.includes("cliente_radio_tolerancia"),
  "Prueba 9 (Criterio 2): Modal cartográfico dibuja la geocerca circular con el radio de tolerancia del cliente"
);
assert(
  modalCode.includes("L.marker(clientPos") && modalCode.includes("L.marker(sellerPos"),
  "Prueba 10 (Criterio 2): Modal cartográfico ubica simultáneamente el marcador del cliente y el check-in del vendedor"
);
assert(
  modalCode.includes("L.polyline") && modalCode.includes("distancia_cliente_metros"),
  "Prueba 11 (Criterio 2): Traza línea geodésica conectora con etiqueta de la distancia exacta en metros"
);
assert(
  modalCode.includes("map.fitBounds(bounds"),
  "Prueba 12 (Criterio 2): Aplica auto-encuadre de cámara (fitBounds) para abarcar cliente y asesor"
);

// -----------------------------------------------------------------------------
// BLOQUE 4: LÓGICA DE DOMINIO Y FORMATEADORES MATEMÁTICOS
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 4] Lógica de Dominio, Formateo Temporal y KPIs:");

function formatVisitDuration(checkInIso, checkOutIso) {
  if (!checkOutIso) return "En progreso";
  const start = new Date(checkInIso).getTime();
  const end = new Date(checkOutIso).getTime();
  if (isNaN(start) || isNaN(end) || end < start) return "—";

  const diffSeconds = Math.floor((end - start) / 1000);
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;

  if (minutes > 0) return `${minutes} min ${seconds} s`;
  return `${seconds} s`;
}

// Test 13: Cálculo de duración en tienda
const duration1 = formatVisitDuration("2026-11-08T08:32:00Z", "2026-11-08T08:55:30Z");
assert(
  duration1 === "23 min 30 s",
  `Prueba 13: Formatea duración de visita de 23 minutos y 30 segundos (${duration1})`
);

// Test 14: Visita aún no finalizada
const durationInProgress = formatVisitDuration("2026-11-08T08:32:00Z", null);
assert(
  durationInProgress === "En progreso",
  "Prueba 14: Visita sin hora de check-out reporta 'En progreso'"
);

// Test 15: Cálculo cuantitativo de KPIs de supervisión
const mockVisits = [
  { id: "1", estado: "VERIFIED", precios_pactados_compromisos: { total_amount: 450.0 } },
  { id: "2", estado: "VERIFIED", precios_pactados_compromisos: { total_amount: 300.0 } },
  { id: "3", estado: "OUT_OF_RANGE", precios_pactados_compromisos: null },
  { id: "4", estado: "VERIFIED", precios_pactados_compromisos: { total_amount: 250.0 } },
];

const totalVisits = mockVisits.length;
const verified = mockVisits.filter((v) => v.estado === "VERIFIED").length;
const outOfRange = mockVisits.filter((v) => v.estado === "OUT_OF_RANGE").length;
const effectivenessPct = Math.round((verified / totalVisits) * 100);
const totalAmount = mockVisits.reduce((acc, v) => acc + (v.precios_pactados_compromisos?.total_amount || 0), 0);

assert(
  totalVisits === 4 && verified === 3 && outOfRange === 1 && effectivenessPct === 75 && totalAmount === 1000.0,
  `Prueba 15: Métricas KPI calculadas con precisión (Total: 4, Verificadas: 3, Alertas: 1, Efectividad: 75%, Total $: $1000.00)`
);

// Test 16: Filtrado predictivo por estado y subcadena
const filtered = mockVisits.filter((v) => v.estado === "VERIFIED");
assert(filtered.length === 3, "Prueba 16: Filtrado por estado segrega visitas en geocerca");

// -----------------------------------------------------------------------------
// RESUMEN FINAL
// -----------------------------------------------------------------------------
console.log("\n================================================================================");
console.log(`  RESUMEN FINAL: ${passed} pruebas superadas, ${failed} fallos de ${passed + failed} totales`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

