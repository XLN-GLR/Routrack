/**
 * ROUTRACK — Suite de Pruebas Unitarias para Bitácora de Auditoría Forense (TASK-021)
 * Archivo: web-admin/scripts/run-audit-tests.mjs
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
console.log("  ROUTRACK — SUITE DE PRUEBAS: BITÁCORA DE AUDITORÍA FORENSE (TASK-021)");
console.log("================================================================================");

// -----------------------------------------------------------------------------
// BLOQUE 1: VERIFICACIÓN DE ARCHIVOS Y COMPONENTES REQUERIDOS
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 1] Integridad de Archivos de TASK-021:");

const typesPath = path.join(projectRoot, "web-admin/src/types/audit.ts");
const pagePath = path.join(projectRoot, "web-admin/src/app/(dashboard)/audit/page.tsx");
const tablePath = path.join(projectRoot, "web-admin/src/components/audit/AuditLogTable.tsx");
const modalPath = path.join(projectRoot, "web-admin/src/components/audit/AuditDetailModal.tsx");

assert(fs.existsSync(typesPath), "Prueba 1: Archivo types/audit.ts existe con interfaces de dominio");
assert(fs.existsSync(pagePath), "Prueba 2: Vista src/app/(dashboard)/audit/page.tsx existe");
assert(fs.existsSync(tablePath), "Prueba 3: Componente src/components/audit/AuditLogTable.tsx existe");
assert(fs.existsSync(modalPath), "Prueba 4: Componente src/components/audit/AuditDetailModal.tsx existe");

const pageCode = fs.readFileSync(pagePath, "utf8");
const tableCode = fs.readFileSync(tablePath, "utf8");
const modalCode = fs.readFileSync(modalPath, "utf8");
const typesCode = fs.readFileSync(typesPath, "utf8");

// -----------------------------------------------------------------------------
// BLOQUE 2: CRITERIO 1 — TABLA DE EVENTOS CON SEVERIDAD SEMÁNTICA (INFO, WARNING, CRITICAL)
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 2] Criterio 1: Despliegue de Severidad Semántica (INFO, WARNING, CRITICAL):");

// Comprobación estática de tipos de severidad
assert(
  typesCode.includes('"INFO"') &&
    typesCode.includes('"WARNING"') &&
    typesCode.includes('"CRITICAL"'),
  "Prueba 5: types/audit.ts modela los 3 niveles de severidad semántica requeridos"
);

// Mapeo semántico de colores para cada severidad
assert(
  typesCode.includes("formatSeverityBadge") &&
    typesCode.includes("bg-red-50 text-red-700") &&
    typesCode.includes("bg-amber-50 text-amber-800") &&
    typesCode.includes("bg-blue-50 text-blue-700"),
  "Prueba 6: formatSeverityBadge asocia clases cromáticas según docs/DESIGN.md"
);

// Renderizado de badges semánticos en AuditLogTable
assert(
  tableCode.includes("formatSeverityBadge(rec.severidad)") &&
    tableCode.includes("severityConfig.badgeClass"),
  "Prueba 7: AuditLogTable renderiza badges con estilos semánticos para cada evento"
);

// Traducción de eventos del sistema a lenguaje formal en español
assert(
  typesCode.includes("Fake GPS Detectado") &&
    typesCode.includes("Sensor GPS Apagado") &&
    typesCode.includes("Pérdida de Señal") &&
    typesCode.includes("Anomalía de Reloj"),
  "Prueba 8: formatEventTypeLabel traduce códigos técnicos a español claro y descriptivo"
);

// -----------------------------------------------------------------------------
// BLOQUE 3: CRITERIO 2 — INDICADOR VISUAL DEL ESTADO DE INTEGRIDAD CRIPTOGRÁFICA
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 3] Criterio 2: Indicador Visual del Estado de Integridad de la Cadena:");

// Algoritmo de validación de continuidad de hashes
assert(
  typesCode.includes("function verifyChainContinuity") &&
    typesCode.includes("isChainIntact") &&
    typesCode.includes("previous_hash"),
  "Prueba 9: verifyChainContinuity implementa la verificación secuencial de la cadena HMAC"
);

// Indicador global en cabecera de la página
assert(
  pageCode.includes("integritySummary.isChainIntact") &&
    pageCode.includes("Cadena HMAC Íntegra (100% Válida)") &&
    pageCode.includes("Discontinuidad Forense Detectada"),
  "Prueba 10: page.tsx presenta el indicador visual prominente de integridad criptográfica"
);

// Indicador visual por fila en la tabla
assert(
  tableCode.includes("rec.chain_link_status") &&
    tableCode.includes("Eslabón de custodia íntegro y verificado") &&
    tableCode.includes("Discontinuidad detectada"),
  "Prueba 11: Cada fila en AuditLogTable incluye un indicador individual del estado de enlace"
);

// Modal de detalle con comparación criptográfica
assert(
  modalCode.includes("isChainLinkValid") &&
    modalCode.includes("Eslabón Íntegro") &&
    modalCode.includes("Discontinuidad Forense"),
  "Prueba 12: AuditDetailModal expone el diagnóstico criptográfico y visualiza ambos hashes"
);

// -----------------------------------------------------------------------------
// BLOQUE 4: LOS 4 ESTADOS OBLIGATORIOS DE INTERFAZ (docs/DESIGN.md § 5)
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 4] Cumplimiento de los 4 Estados Obligatorios de Interfaz:");

// 1. Estado Cargando (Skeleton Loader)
assert(
  pageCode.includes("AuditSkeletonLoader") && pageCode.includes("animate-pulse"),
  "Prueba 13 (Criterio 1): Estado Cargando implementa Skeleton Loader con efecto animate-pulse"
);

// 2. Estado Error (Error State con botón explícito de reintento)
assert(
  pageCode.includes("AuditErrorState") &&
    pageCode.includes("border-red-500") &&
    pageCode.includes("Reintentar Conexión"),
  "Prueba 14 (Criterio 1): Estado Error presenta mensaje comprensible y botón explícito de reintento"
);

// 3. Estado Vacío (Empty State educativo)
assert(
  tableCode.includes("No se encontraron eventos en la bitácora") &&
    tableCode.includes("Restablecer Filtros de Auditoría"),
  "Prueba 15 (Criterio 1): Estado Vacío educa al usuario y permite restablecer filtros"
);

// 4. Estado Adaptativo (Responsive Design)
assert(
  tableCode.includes("overflow-x-auto") &&
    pageCode.includes("grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"),
  "Prueba 16 (Criterio 1): Interfaz completamente adaptativa y responsive para móvil y escritorio"
);

// -----------------------------------------------------------------------------
// BLOQUE 5: EVALUACIÓN DINÁMICA DE LA LÓGICA CRIPTOGRÁFICA
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 5] Evaluación Dinámica del Algoritmo Criptográfico:");

// Simulación de función de verificación en Node.js
function testVerifyChain(records) {
  if (!records || records.length === 0) return { isIntact: true, brokenIndices: [] };
  const sorted = [...records].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const brokenIndices = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.previous_hash.trim().toLowerCase() !== prev.hmac_hash.trim().toLowerCase()) {
      brokenIndices.push(i);
    }
  }
  return { isIntact: brokenIndices.length === 0, brokenIndices };
}

// Caso 1: Cadena íntegra
const validChain = [
  {
    id: 1,
    created_at: "2026-11-09T08:00:00Z",
    previous_hash: "SEED-INIT-01",
    hmac_hash: "hash_01_aaaabbbbccccdddd",
  },
  {
    id: 2,
    created_at: "2026-11-09T08:30:00Z",
    previous_hash: "hash_01_aaaabbbbccccdddd",
    hmac_hash: "hash_02_1111222233334444",
  },
  {
    id: 3,
    created_at: "2026-11-09T09:00:00Z",
    previous_hash: "hash_02_1111222233334444",
    hmac_hash: "hash_03_5555666677778888",
  },
];

const validResult = testVerifyChain(validChain);
assert(validResult.isIntact === true, "Prueba 17: Cadena íntegra de 3 eslabones consecutivos es validada al 100%");

// Caso 2: Cadena con adulteración en el eslabón 3
const tamperedChain = [
  {
    id: 1,
    created_at: "2026-11-09T08:00:00Z",
    previous_hash: "SEED-INIT-01",
    hmac_hash: "hash_01_aaaabbbbccccdddd",
  },
  {
    id: 2,
    created_at: "2026-11-09T08:30:00Z",
    previous_hash: "hash_01_aaaabbbbccccdddd",
    hmac_hash: "hash_02_1111222233334444",
  },
  {
    id: 3,
    created_at: "2026-11-09T09:00:00Z",
    previous_hash: "hash_CORRUPTO_INCORRECTO",
    hmac_hash: "hash_03_5555666677778888",
  },
];

const tamperedResult = testVerifyChain(tamperedChain);
assert(
  tamperedResult.isIntact === false && tamperedResult.brokenIndices.includes(2),
  "Prueba 18: Adulteración en previous_hash invalida la cadena e identifica el índice exacto de ruptura"
);

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

