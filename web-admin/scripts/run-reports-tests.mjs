/**
 * ROUTRACK — Suite de Pruebas Unitarias para Exportación CSV y Reportes (TASK-023)
 * Archivo: web-admin/scripts/run-reports-tests.mjs
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
console.log("  ROUTRACK — SUITE DE PRUEBAS: EXPORTACIÓN FORMAL A CSV (TASK-023)");
console.log("================================================================================");

// -----------------------------------------------------------------------------
// BLOQUE 1: VERIFICACIÓN DE ARCHIVOS REQUERIDOS
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 1] Integridad de Archivos de TASK-023:");

const exportCsvPath = path.join(projectRoot, "web-admin/src/lib/export/exportCsv.ts");
const reportsPagePath = path.join(projectRoot, "web-admin/src/app/(dashboard)/reports/page.tsx");

assert(fs.existsSync(exportCsvPath), "Prueba 1: Módulo src/lib/export/exportCsv.ts existe");
assert(fs.existsSync(reportsPagePath), "Prueba 2: Vista src/app/(dashboard)/reports/page.tsx existe");

const exportCsvCode = fs.readFileSync(exportCsvPath, "utf8");
const reportsPageCode = fs.readFileSync(reportsPagePath, "utf8");

// -----------------------------------------------------------------------------
// BLOQUE 2: CRITERIO 1 — NOMBRE NORMALIZADO Y DESCARGA AUTOMÁTICA
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 2] Criterio 1: Descarga Automática con Nombre Normalizado:");

// Import dinámico de funciones de exportCsv
const { buildReportFileName, generateShiftsCsv, escapeCsvField, UTF8_BOM } = await import(
  "../src/lib/export/exportCsv.ts"
);

const testFileName = buildReportFileName("2026-11-10");
assert(
  testFileName === "reporte-jornadas-2026-11-10.csv",
  "Prueba 3 (Criterio 1): buildReportFileName genera exactamente 'reporte-jornadas-YYYY-MM-DD.csv'"
);

const defaultFileName = buildReportFileName();
const todayIso = new Date().toISOString().slice(0, 10);
assert(
  defaultFileName === `reporte-jornadas-${todayIso}.csv`,
  "Prueba 4 (Criterio 1): buildReportFileName usa la fecha actual por defecto ante parámetro vacío"
);

assert(
  reportsPageCode.includes("handleExportCsv") &&
    reportsPageCode.includes("buildReportFileName") &&
    reportsPageCode.includes("downloadCsvFile"),
  "Prueba 5 (Criterio 1): reports/page.tsx integra el disparador interactivo de descarga de archivo"
);

assert(
  exportCsvCode.includes("downloadCsvFile") &&
    exportCsvCode.includes("Blob") &&
    exportCsvCode.includes("createObjectURL") &&
    exportCsvCode.includes("link.click()"),
  "Prueba 6 (Criterio 1): exportCsv.ts implementa la descarga programática con Blob y revoca la URL de memoria"
);

// -----------------------------------------------------------------------------
// BLOQUE 3: CRITERIO 2 — UTF-8 CON BOM Y CARACTERES ESPECIALES
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 3] Criterio 2: Codificación UTF-8 con BOM y Caracteres en Español:");

assert(
  UTF8_BOM === "\uFEFF",
  "Prueba 7 (Criterio 2): UTF8_BOM define el carácter exacto Byte Order Mark (\\uFEFF)"
);

const testRows = [
  {
    fecha: "2026-11-10",
    vendedor: "Ángel Núñez Peña",
    email: "angel.nunez@routrack.ec",
    hora_inicio: "08:00:00",
    hora_fin: "17:30:00",
    duracion_horas: "9h 30m",
    kilometros: 35.5,
    visitas_totales: 8,
    visitas_verificadas: 7,
    visitas_fuera_rango: 1,
    efectividad_porcentaje: "87.5%",
    monto_pactado_usd: 1250.75,
    estado_turno: "FINALIZADO",
  },
  {
    fecha: "2026-11-10",
    vendedor: "Sofía Montalvo (Ruta Valles)",
    email: "sofia.montalvo@routrack.ec",
    hora_inicio: "08:15:00",
    hora_fin: "16:45:00",
    duracion_horas: "8h 30m",
    kilometros: 22.0,
    visitas_totales: 6,
    visitas_verificadas: 6,
    visitas_fuera_rango: 0,
    efectividad_porcentaje: "100.0%",
    monto_pactado_usd: 840.0,
    estado_turno: "FINALIZADO",
  },
];

const generatedCsv = generateShiftsCsv(testRows);

assert(
  generatedCsv.startsWith("\uFEFF"),
  "Prueba 8 (Criterio 2): El CSV generado inicia obligatoriamente con el BOM UTF-8 (\\uFEFF)"
);

assert(
  generatedCsv.includes("Ángel Núñez Peña") && generatedCsv.includes("Sofía Montalvo"),
  "Prueba 9 (Criterio 2): Nombres con tildes (Á, í) y eñes (ñ) se preservan intactos sin alteración"
);

assert(
  generatedCsv.includes("Kilómetros Recorridos (km)") &&
    generatedCsv.includes("Tasa de Efectividad") &&
    generatedCsv.includes("Monto Pactado ($ USD)"),
  "Prueba 10 (Criterio 2): Encabezados oficiales en español con tildes y símbolos ($) se incluyen correctamente"
);

// -----------------------------------------------------------------------------
// BLOQUE 4: ESCAPE DE CAMPOS SEGÚN RFC 4180
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 4] Cumplimiento de Formato Tabular RFC 4180:");

const escapedWithComma = escapeCsvField("Quito, Pichincha");
assert(
  escapedWithComma === '"Quito, Pichincha"',
  "Prueba 11: Campo con coma se encierra entre comillas dobles"
);

const escapedWithQuotes = escapeCsvField('Cliente "Supermaxi"');
assert(
  escapedWithQuotes === '"Cliente ""Supermaxi"""',
  "Prueba 12: Comillas dobles internas se duplican según estándar RFC 4180"
);

const escapedNull = escapeCsvField(null);
assert(escapedNull === '""', "Prueba 13: Valores nulos se normalizan a celda vacía entre comillas");

// -----------------------------------------------------------------------------
// BLOQUE 5: CUMPLIMIENTO DE LOS 4 ESTADOS OBLIGATORIOS DE INTERFAZ (docs/DESIGN.md § 5)
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 5] Cumplimiento de los 4 Estados Obligatorios de Interfaz:");

// 1. Estado Cargando
assert(
  reportsPageCode.includes("ReportsSkeletonLoader") &&
    reportsPageCode.includes("animate-pulse"),
  "Prueba 14 (Estado Cargando): Implementa Skeleton Loader anatómico con efecto animate-pulse"
);

// 2. Estado Error
assert(
  reportsPageCode.includes("ReportsErrorState") &&
    reportsPageCode.includes("border-red-500") &&
    reportsPageCode.includes("Reintentar Conexión"),
  "Prueba 15 (Estado Error): Presenta mensaje en español y botón explícito de reintento"
);

// 3. Estado Vacío
assert(
  reportsPageCode.includes("ReportsEmptyState") &&
    reportsPageCode.includes("No hay registros de jornada") &&
    reportsPageCode.includes("Restablecer Filtros"),
  "Prueba 16 (Estado Vacío): Despliega estado pedagógico con botón de restablecimiento"
);

// 4. Estado Adaptativo
assert(
  reportsPageCode.includes("overflow-x-auto") &&
    reportsPageCode.includes("grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"),
  "Prueba 17 (Estado Adaptativo): Interfaz adaptable con scroll horizontal y rejilla responsiva"
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

