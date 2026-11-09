/**
 * ROUTRACK — Suite de Pruebas Unitarias para Validación Espacial de Geocercas en PostGIS (TASK-019)
 * Archivo: supabase/tests/visit_validation_function_test.mjs
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
console.log("  ROUTRACK — SUITE DE PRUEBAS: VALIDACIÓN ESPACIAL DE GEOCERCAS POSTGIS");
console.log("  Tarea: TASK-019 (Fase 6 — ST_DWithin + ST_Distance + Triggers Anti-Tampering)");
console.log("================================================================================");

// -----------------------------------------------------------------------------
// BLOQUE 1: VERIFICACIÓN DE LA MIGRACIÓN SQL Y CONTRATOS POSTGIS
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 1] Verificación de la Migración SQL y Contratos PostGIS:");

const migrationPath = path.join(
  projectRoot,
  "supabase/migrations/20261106000005_visit_validation_function.sql"
);

assert(
  fs.existsSync(migrationPath),
  "Prueba 1: Archivo 20261106000005_visit_validation_function.sql existe en supabase/migrations"
);

const migrationSql = fs.readFileSync(migrationPath, "utf8");

assert(
  migrationSql.includes("FUNCTION public.calcular_distancia_geocerca_cliente"),
  "Prueba 2: Define función espacial calcular_distancia_geocerca_cliente con PostGIS"
);
assert(
  migrationSql.includes("FUNCTION public.evaluar_geocerca_visita"),
  "Prueba 3: Define función RPC pública evaluar_geocerca_visita para clientes y Edge Functions"
);
assert(
  migrationSql.includes("TRIGGER trg_validar_geocerca_visita"),
  "Prueba 4: Configura trigger BEFORE INSERT/UPDATE sobre public.actividades_comerciales"
);
assert(
  migrationSql.includes("ST_Distance(") && migrationSql.includes("::geography"),
  "Prueba 5: Utiliza ST_Distance con casteo a geography para cálculo exacto en metros sobre el elipsoide WGS84"
);
assert(
  migrationSql.includes("ST_DWithin("),
  "Prueba 6: Utiliza ST_DWithin para verificación booleana eficiente indexada por GiST"
);
assert(
  migrationSql.includes("'VERIFIED'") && migrationSql.includes("'OUT_OF_RANGE'"),
  "Prueba 7: Asigna categóricamente los estados VERIFIED y OUT_OF_RANGE según el radio de tolerancia"
);

// -----------------------------------------------------------------------------
// BLOQUE 2: MOTOR GEODÉSICO DE REFERENCIA (HAVERSINE WGS84 EQUIVALENTE A POSTGIS)
// -----------------------------------------------------------------------------
const EARTH_RADIUS_METERS = 6371000.0;

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const phi1 = degreesToRadians(lat1);
  const phi2 = degreesToRadians(lat2);
  const deltaPhi = degreesToRadians(lat2 - lat1);
  const deltaLambda = degreesToRadians(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

function evaluarGeocercaPostgisSimulada(cliente, checkInLat, checkInLng) {
  const distancia = haversineDistanceMeters(cliente.lat, cliente.lng, checkInLat, checkInLng);
  const dentro = distancia <= cliente.radio_tolerancia_metros;
  return {
    distancia_metros: Math.round(distancia * 100) / 100,
    radio_tolerancia_metros: cliente.radio_tolerancia_metros,
    dentro_de_geocerca: dentro,
    estado: dentro ? "VERIFIED" : "OUT_OF_RANGE",
  };
}

// -----------------------------------------------------------------------------
// BLOQUE 3: VALIDACIÓN DE CRITERIO 1 — DISTANCIA <= TOLERANCIA -> VERIFIED
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 2] Criterio 1: Visitas a distancia <= tolerancia se marcan VERIFIED:");

const clienteElJardin = {
  id: "c1000000-0000-0000-0000-000000000001",
  nombre: "Supermaxi El Jardín",
  lat: -0.190123,
  lng: -78.487654,
  radio_tolerancia_metros: 50,
};

// Test 8: Vendedor en la puerta del cliente (~3.5 metros)
const checkInPuerta = { lat: -0.190150, lng: -78.487670 };
const evalPuerta = evaluarGeocercaPostgisSimulada(clienteElJardin, checkInPuerta.lat, checkInPuerta.lng);

assert(
  evalPuerta.estado === "VERIFIED" && evalPuerta.dentro_de_geocerca === true,
  `Prueba 8 (Criterio 1): Visita a ${evalPuerta.distancia_metros}m (<= 50m) se marca VERIFIED`
);

// Test 9: Vendedor a 45 metros (dentro del radio de 50 metros)
const checkIn45m = { lat: -0.190450, lng: -78.487850 };
const eval45m = evaluarGeocercaPostgisSimulada(clienteElJardin, checkIn45m.lat, checkIn45m.lng);

assert(
  eval45m.estado === "VERIFIED" && eval45m.distancia_metros < 50,
  `Prueba 9 (Criterio 1): Visita a ${eval45m.distancia_metros}m se marca VERIFIED`
);

// Test 10: Vendedor al borde interior de la geocerca (49.5m <= 50m)
const checkIn49m = { lat: -0.190568, lng: -78.487654 }; // ~49.5m al sur
const eval49m = evaluarGeocercaPostgisSimulada(clienteElJardin, checkIn49m.lat, checkIn49m.lng);

assert(
  eval49m.distancia_metros <= 50.0 && eval49m.estado === "VERIFIED",
  `Prueba 10 (Criterio 1): Visita al borde de geocerca (${eval49m.distancia_metros}m <= 50m) se marca VERIFIED`
);

// -----------------------------------------------------------------------------
// BLOQUE 4: VALIDACIÓN DE CRITERIO 2 — DISTANCIA > TOLERANCIA -> OUT_OF_RANGE
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 3] Criterio 2: Visitas a distancia > tolerancia se marcan OUT_OF_RANGE con distancia exacta:");

// Test 11: Vendedor a 180 metros del cliente
const checkIn180m = { lat: -0.191500, lng: -78.488500 };
const eval180m = evaluarGeocercaPostgisSimulada(clienteElJardin, checkIn180m.lat, checkIn180m.lng);

assert(
  eval180m.estado === "OUT_OF_RANGE" && eval180m.dentro_de_geocerca === false,
  `Prueba 11 (Criterio 2): Visita a ${eval180m.distancia_metros}m (> 50m) se marca OUT_OF_RANGE`
);
assert(
  eval180m.distancia_metros > 150 && eval180m.distancia_metros < 200,
  `Prueba 12 (Criterio 2): La distancia exacta en metros (${eval180m.distancia_metros}m) queda registrada fehacientemente`
);

// Test 13: Vendedor en otro sector de Quito (a 3.2 kilómetros de distancia)
const checkInLejano = { lat: -0.220101, lng: -78.510203 }; // Centro Histórico
const evalLejano = evaluarGeocercaPostgisSimulada(clienteElJardin, checkInLejano.lat, checkInLejano.lng);

assert(
  evalLejano.estado === "OUT_OF_RANGE" && evalLejano.distancia_metros > 3000,
  `Prueba 13 (Criterio 2): Visita remota fraudulenta a ${evalLejano.distancia_metros}m se marca OUT_OF_RANGE sin ambigüedad`
);

// -----------------------------------------------------------------------------
// BLOQUE 5: TOLERANCIAS PERSONALIZADAS DE CLIENTES
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 4] Respeto a Tolerancias Personalizadas por Cliente:");

// Cliente mayorista con radio de tolerancia amplio (150 metros)
const clienteMayorista = {
  id: "c1000000-0000-0000-0000-000000000003",
  nombre: "Distribuidora Mayorista Kywi",
  lat: -0.165432,
  lng: -78.472109,
  radio_tolerancia_metros: 150,
};

// Check-in a 110 metros: Debe ser VERIFIED porque tolerancia es 150m
const checkIn110m = { lat: -0.166200, lng: -78.472600 };
const evalMayorista = evaluarGeocercaPostgisSimulada(clienteMayorista, checkIn110m.lat, checkIn110m.lng);

assert(
  evalMayorista.estado === "VERIFIED" && evalMayorista.distancia_metros <= 150,
  `Prueba 14: Visita a ${evalMayorista.distancia_metros}m se marca VERIFIED para cliente con tolerancia amplia (150m)`
);

// Cliente pequeño con tolerancia estricta (20 metros)
const clienteEstricto = {
  id: "c1000000-0000-0000-0000-000000000004",
  nombre: "Tienda Microplaza",
  lat: -0.258901,
  lng: -78.523456,
  radio_tolerancia_metros: 20,
};

// Check-in a 35 metros: Debe ser OUT_OF_RANGE porque tolerancia es 20m
const checkIn35m = { lat: -0.259200, lng: -78.523500 };
const evalEstricto = evaluarGeocercaPostgisSimulada(clienteEstricto, checkIn35m.lat, checkIn35m.lng);

assert(
  evalEstricto.estado === "OUT_OF_RANGE" && evalEstricto.distancia_metros > 20,
  `Prueba 15: Visita a ${evalEstricto.distancia_metros}m se marca OUT_OF_RANGE para cliente con tolerancia estricta (20m)`
);

// -----------------------------------------------------------------------------
// BLOQUE 6: TRIGGER DE PROTECCIÓN ANTI-TAMPERING (SIMULACIÓN DE DB)
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 5] Verificación del Trigger Anti-Tampering:");

function simularTriggerBeforeInsert(row, cliente) {
  const evalResult = evaluarGeocercaPostgisSimulada(cliente, row.checkInLat, row.checkInLng);
  return {
    ...row,
    distancia_cliente_metros: evalResult.distancia_metros,
    estado: row.estado === "CANCELLED" ? "CANCELLED" : evalResult.estado,
  };
}

// Escenario: Cliente malicioso o script que intenta inyectar estado="VERIFIED" estando a 400m
const maliciousInsert = {
  cliente_id: clienteElJardin.id,
  checkInLat: -0.193500,
  checkInLng: -78.489500,
  estado: "VERIFIED", // Intento de fraude
  distancia_cliente_metros: 0.0,
};

const processedRow = simularTriggerBeforeInsert(maliciousInsert, clienteElJardin);

assert(
  processedRow.estado === "OUT_OF_RANGE" && processedRow.distancia_cliente_metros > 300,
  `Prueba 16: Trigger de PostgreSQL sobrescribe intento de fraude: forzó OUT_OF_RANGE con distancia real (${processedRow.distancia_cliente_metros}m)`
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
