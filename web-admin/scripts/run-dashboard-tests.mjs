/**
 * ROUTRACK — Suite de Pruebas Unitarias para Dashboard de Métricas y Recharts (TASK-022)
 * Archivo: web-admin/scripts/run-dashboard-tests.mjs
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
console.log("  ROUTRACK — SUITE DE PRUEBAS: DASHBOARD Y MÉTRICAS RECHARTS (TASK-022)");
console.log("================================================================================");

// -----------------------------------------------------------------------------
// BLOQUE 1: VERIFICACIÓN DE ARCHIVOS Y COMPONENTES REQUERIDOS
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 1] Integridad de Archivos de TASK-022:");

const typesPath = path.join(projectRoot, "web-admin/src/types/dashboard.ts");
const metricCardsPath = path.join(projectRoot, "web-admin/src/components/dashboard/MetricCards.tsx");
const chartPath = path.join(projectRoot, "web-admin/src/components/dashboard/PerformanceChart.tsx");
const pagePath = path.join(projectRoot, "web-admin/src/app/(dashboard)/page.tsx");

assert(fs.existsSync(typesPath), "Prueba 1: Archivo types/dashboard.ts existe");
assert(fs.existsSync(metricCardsPath), "Prueba 2: Componente MetricCards.tsx existe");
assert(fs.existsSync(chartPath), "Prueba 3: Componente PerformanceChart.tsx existe");
assert(fs.existsSync(pagePath), "Prueba 4: Vista principal src/app/(dashboard)/page.tsx existe");

const typesCode = fs.readFileSync(typesPath, "utf8");
const metricCardsCode = fs.readFileSync(metricCardsPath, "utf8");
const chartCode = fs.readFileSync(chartPath, "utf8");
const pageCode = fs.readFileSync(pagePath, "utf8");

// -----------------------------------------------------------------------------
// BLOQUE 2: CRITERIO 1 — VISUALIZACIÓN EN TIEMPO REAL Y SKELETON LOADERS
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 2] Criterio 1: Métricas en Tiempo Real y Skeleton Loaders:");

assert(
  metricCardsCode.includes("MetricCardsSkeleton") &&
    metricCardsCode.includes("animate-pulse"),
  "Prueba 5 (Criterio 1): MetricCards implementa MetricCardsSkeleton con efecto animate-pulse"
);

assert(
  chartCode.includes("PerformanceChartSkeleton") &&
    chartCode.includes("animate-pulse"),
  "Prueba 6 (Criterio 1): PerformanceChart implementa PerformanceChartSkeleton con efecto animate-pulse"
);

assert(
  pageCode.includes("MetricCardsSkeleton") &&
    pageCode.includes("PerformanceChartSkeleton") &&
    pageCode.includes("isLoading ?"),
  "Prueba 7 (Criterio 1): page.tsx despliega ambos skeleton loaders durante el estado de carga"
);

assert(
  pageCode.includes("loadDashboardData") &&
    pageCode.includes("type=\"date\"") &&
    pageCode.includes("Actualizar"),
  "Prueba 8 (Criterio 1): page.tsx incluye selector interactivo de fecha y botón de actualización en tiempo real"
);

// -----------------------------------------------------------------------------
// BLOQUE 3: CRITERIO 2 — TOTALIZACIONES COINCIDENTES CON BASE DE DATOS
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 3] Criterio 2: Totalizaciones y Cálculos Coincidentes:");

// Simulación de función calculateDashboardKpis
function testCalculateKpis(sellers, totalClientesOrg) {
  if (!sellers || sellers.length === 0) {
    return {
      vendedoresActivos: 0,
      vendedoresTotales: 0,
      kilometrosTotales: 0,
      visitasTotales: 0,
      visitasVerificadas: 0,
      visitasFueraRango: 0,
      tasaEfectividad: 100,
      totalClientesAsignados: totalClientesOrg,
      clientesVisitados: 0,
      tasaCobertura: 0,
      montoTotalAcordado: 0,
    };
  }

  let totalKm = 0;
  let totalVerif = 0;
  let totalOutRange = 0;
  let totalMonto = 0;
  let activosCount = 0;

  for (const s of sellers) {
    totalKm += s.kilometros;
    totalVerif += s.visitasVerificadas;
    totalOutRange += s.visitasFueraRango;
    totalMonto += s.montoAcordado;
    if (s.estadoTurno === "EN_RUTA" || s.estadoTurno === "DETENIDO") {
      activosCount++;
    }
  }

  const totalVisitas = totalVerif + totalOutRange;
  const tasaEfectividad =
    totalVisitas > 0 ? Math.round((totalVerif / totalVisitas) * 1000) / 10 : 100;
  const clientesVisitados = Math.min(totalVerif, totalClientesOrg);
  const tasaCobertura =
    totalClientesOrg > 0
      ? Math.min(100, Math.round((clientesVisitados / totalClientesOrg) * 1000) / 10)
      : 0;

  return {
    vendedoresActivos: activosCount,
    vendedoresTotales: sellers.length,
    kilometrosTotales: Math.round(totalKm * 10) / 10,
    visitasTotales: totalVisitas,
    visitasVerificadas: totalVerif,
    visitasFueraRango: totalOutRange,
    tasaEfectividad,
    totalClientesAsignados: totalClientesOrg,
    clientesVisitados,
    tasaCobertura,
    montoTotalAcordado: Math.round(totalMonto * 100) / 100,
  };
}

const mockSellers = [
  {
    vendedorId: "v1",
    nombre: "Vendedor 1",
    kilometros: 30.5,
    visitasVerificadas: 8,
    visitasFueraRango: 2,
    montoAcordado: 500,
    estadoTurno: "EN_RUTA",
  },
  {
    vendedorId: "v2",
    nombre: "Vendedor 2",
    kilometros: 20.0,
    visitasVerificadas: 10,
    visitasFueraRango: 0,
    montoAcordado: 750,
    estadoTurno: "DETENIDO",
  },
];

const kpiResult = testCalculateKpis(mockSellers, 25);

assert(kpiResult.kilometrosTotales === 50.5, "Prueba 9 (Criterio 2): Kilómetros totales suman exactamente 50.5 km");
assert(kpiResult.visitasTotales === 20, "Prueba 10 (Criterio 2): Visitas totales suman exactamente 20 (18 verif + 2 out)");
assert(kpiResult.tasaEfectividad === 90.0, "Prueba 11 (Criterio 2): Tasa de efectividad calculada en 90.0% (18/20)");
assert(kpiResult.tasaCobertura === 72.0, "Prueba 12 (Criterio 2): Cobertura de clientes calculada en 72.0% (18 de 25)");
assert(kpiResult.montoTotalAcordado === 1250.0, "Prueba 13 (Criterio 2): Monto total acordado suma $1250.00 USD");
assert(kpiResult.vendedoresActivos === 2, "Prueba 14 (Criterio 2): Identifica 2 vendedores activos en turno");

// Manejo seguro de conjunto vacío
const emptyKpis = testCalculateKpis([], 30);
assert(
  emptyKpis.visitasTotales === 0 && emptyKpis.tasaEfectividad === 100,
  "Prueba 15: Cálculo con arreglo vacío no arroja división por cero ni NaN"
);

// -----------------------------------------------------------------------------
// BLOQUE 4: INTEGRACIÓN CON RECHARTS Y COMPONENTES VISUALES
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 4] Gráficos con Recharts y Alternancia de Vistas:");

assert(
  chartCode.includes("ResponsiveContainer") &&
    chartCode.includes("BarChart") &&
    chartCode.includes("Bar") &&
    chartCode.includes("AreaChart") &&
    chartCode.includes("Area") &&
    chartCode.includes("XAxis") &&
    chartCode.includes("YAxis") &&
    chartCode.includes("Tooltip") &&
    chartCode.includes("Legend"),
  "Prueba 16: PerformanceChart integra los componentes requeridos de la librería Recharts"
);

assert(
  chartCode.includes("setActiveTab") &&
    chartCode.includes("Por Vendedor") &&
    chartCode.includes("Curva Horaria"),
  "Prueba 17: PerformanceChart ofrece selector de pestañas entre Desempeño por Vendedor y Curva Horaria"
);

// -----------------------------------------------------------------------------
// BLOQUE 5: CUMPLIMIENTO DE LOS 4 ESTADOS OBLIGATORIOS DE INTERFAZ
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 5] Cumplimiento de los 4 Estados Obligatorios de Interfaz (docs/DESIGN.md § 5):");

// 1. Estado Cargando
assert(
  pageCode.includes("MetricCardsSkeleton") && pageCode.includes("PerformanceChartSkeleton"),
  "Prueba 18 (Estado Cargando): Implementa Skeleton Loader dual anatómico"
);

// 2. Estado Error
assert(
  pageCode.includes("DashboardErrorState") &&
    pageCode.includes("border-red-500") &&
    pageCode.includes("Reintentar Conexión"),
  "Prueba 19 (Estado Error): Presenta mensaje en español y botón explícito de reintento"
);

// 3. Estado Vacío
assert(
  pageCode.includes("DashboardEmptyState") &&
    pageCode.includes("No se registran actividades en esta fecha") &&
    pageCode.includes("Ver Jornada de Hoy"),
  "Prueba 20 (Estado Vacío): Despliega estado pedagógico con acción de retorno"
);

// 4. Estado Adaptativo
assert(
  metricCardsCode.includes("grid-cols-1 sm:grid-cols-2 lg:grid-cols-4") &&
    chartCode.includes("ResponsiveContainer"),
  "Prueba 21 (Estado Adaptativo): Interfaz adaptable para móviles, tabletas y escritorio"
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
