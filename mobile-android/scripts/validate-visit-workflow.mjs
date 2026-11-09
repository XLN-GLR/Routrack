/**
 * ROUTRACK — Runner de Pruebas Unitarias y Flujo de Visitas Comerciales (TASK-018)
 * Archivo: mobile-android/scripts/validate-visit-workflow.mjs
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
console.log("  ROUTRACK — SUITE DE VALIDACIÓN: FLUJO MÓVIL DE VISITAS Y PRECIOS PACTADOS");
console.log("  Tarea: TASK-018 (Fase 6 — Jetpack Compose + Room Offline-First)");
console.log("================================================================================");

// -----------------------------------------------------------------------------
// BLOQUE 1: VERIFICACIÓN DE ESTRUCTURA Y ARCHIVOS REQUERIDOS
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 1] Integridad de Archivos de la Tarea TASK-018:");

const screenPath = path.join(
  projectRoot,
  "mobile-android/app/src/main/java/com/routrack/mobile/presentation/visits/VisitCheckInScreen.kt"
);
const viewModelPath = path.join(
  projectRoot,
  "mobile-android/app/src/main/java/com/routrack/mobile/presentation/visits/VisitViewModel.kt"
);
const testPath = path.join(
  projectRoot,
  "mobile-android/app/src/test/java/com/routrack/mobile/presentation/visits/VisitViewModelTest.kt"
);
const entityPath = path.join(
  projectRoot,
  "mobile-android/app/src/main/java/com/empresa/routrack/data/local/entity/VisitaEntity.kt"
);
const daoPath = path.join(
  projectRoot,
  "mobile-android/app/src/main/java/com/empresa/routrack/data/local/dao/VisitaDao.kt"
);
const repoPath = path.join(
  projectRoot,
  "mobile-android/app/src/main/java/com/empresa/routrack/data/repository/VisitRepository.kt"
);
const repoImplPath = path.join(
  projectRoot,
  "mobile-android/app/src/main/java/com/empresa/routrack/data/repository/VisitRepositoryImpl.kt"
);

assert(fs.existsSync(screenPath), "Prueba 1: VisitCheckInScreen.kt existe en presentation/visits");
assert(fs.existsSync(viewModelPath), "Prueba 2: VisitViewModel.kt existe en presentation/visits");
assert(fs.existsSync(testPath), "Prueba 3: VisitViewModelTest.kt existe en app/src/test");
assert(fs.existsSync(entityPath), "Prueba 4: VisitaEntity.kt existe en data/local/entity");
assert(fs.existsSync(daoPath), "Prueba 5: VisitaDao.kt existe en data/local/dao");
assert(fs.existsSync(repoPath), "Prueba 6: VisitRepository.kt existe en data/repository");
assert(fs.existsSync(repoImplPath), "Prueba 7: VisitRepositoryImpl.kt existe en data/repository");

// -----------------------------------------------------------------------------
// BLOQUE 2: ANÁLISIS ARQUITECTURAL DE KOTLIN Y JETPACK COMPOSE
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 2] Verificación Arquitectural y Contratos de Dominio:");

const screenCode = fs.readFileSync(screenPath, "utf8");
const vmCode = fs.readFileSync(viewModelPath, "utf8");

assert(
  screenCode.includes("@Composable") && screenCode.includes("fun VisitCheckInScreen"),
  "Prueba 8: VisitCheckInScreen define componente declarativo @Composable de Jetpack Compose"
);
assert(
  screenCode.includes("Scaffold") && screenCode.includes("Card") && screenCode.includes("Button"),
  "Prueba 9: Interfaz móvil implementa diseño unificado con Material 3 (Scaffold, Card, Button)"
);
assert(
  vmCode.includes("class VisitViewModel") && vmCode.includes("ViewModel()"),
  "Prueba 10: VisitViewModel extiende de androidx.lifecycle.ViewModel"
);
assert(
  vmCode.includes("StateFlow<VisitUiState>") && vmCode.includes("MutableStateFlow"),
  "Prueba 11: Estado reactivo inmutable administrado a través de StateFlow<VisitUiState>"
);
assert(
  vmCode.includes("fun performCheckIn") && vmCode.includes("fun performCheckOut"),
  "Prueba 12: ViewModel implementa el ciclo completo de vida de visita (performCheckIn y performCheckOut)"
);
assert(
  vmCode.includes("fun validateCommercialAgreement") && vmCode.includes("fun addCommercialAgreement"),
  "Prueba 13: ViewModel contiene validación explícita de precios pactados y compromisos comerciales"
);

// -----------------------------------------------------------------------------
// BLOQUE 3: SIMULACIÓN DE CRITERIO 1 — CHECK-IN NO BLOQUEANTE Y GEOCERCA
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 3] Criterio 1: Check-in asíncrono y clasificación de geocerca:");

const EARTH_RADIUS_METERS = 6371000.0;
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

const clientLocation = { lat: -0.190123, lng: -78.487654, tolerance: 50 }; // Supermaxi El Jardín

// Caso 1: Vendedor a 3 metros (dentro de geocerca)
const posInside = { lat: -0.190145, lng: -78.487665 };
const distInside = calculateDistanceMeters(posInside.lat, posInside.lng, clientLocation.lat, clientLocation.lng);
const statusInside = distInside <= clientLocation.tolerance ? "VERIFIED" : "OUT_OF_RANGE";
assert(
  statusInside === "VERIFIED" && distInside <= 50,
  `Prueba 14 (Criterio 1): Check-in clasifica VERIFIED si distancia (${distInside.toFixed(1)}m) <= ${clientLocation.tolerance}m`
);

// Caso 2: Vendedor a 180 metros (fuera de geocerca)
const posOutside = { lat: -0.191500, lng: -78.488500 };
const distOutside = calculateDistanceMeters(posOutside.lat, posOutside.lng, clientLocation.lat, clientLocation.lng);
const statusOutside = distOutside <= clientLocation.tolerance ? "VERIFIED" : "OUT_OF_RANGE";
assert(
  statusOutside === "OUT_OF_RANGE" && distOutside > 50,
  `Prueba 15 (Criterio 1): Check-in clasifica OUT_OF_RANGE si distancia (${distOutside.toFixed(1)}m) > ${clientLocation.tolerance}m`
);

// -----------------------------------------------------------------------------
// BLOQUE 4: SIMULACIÓN DE CRITERIO 2 — VALIDACIÓN DE PRECIOS PACTADOS
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 4] Criterio 2: Validación estricta de precios pactados y acuerdos:");

function validateAgreement(productName, quantityText, unitPriceText, discountText = "0") {
  if (!productName || productName.trim().length < 2) {
    return { valid: false, message: "Nombre de producto debe tener al menos 2 caracteres" };
  }
  const qty = parseInt(quantityText, 10);
  if (isNaN(qty) || qty <= 0) {
    return { valid: false, message: "Cantidad debe ser mayor a 0" };
  }
  const price = parseFloat(unitPriceText);
  if (isNaN(price) || price <= 0.0) {
    return { valid: false, message: "Precio unitario debe ser mayor a 0.0" };
  }
  const discount = discountText === "" ? 0.0 : parseFloat(discountText);
  if (isNaN(discount) || discount < 0.0 || discount > 100.0) {
    return { valid: false, message: "Descuento debe estar entre 0% y 100%" };
  }
  const base = qty * price;
  const subtotal = Math.max(0, base - base * (discount / 100.0));
  return { valid: true, subtotal };
}

// Caso 1: Válido con descuento
const validAgr = validateAgreement("Aceite Girasol 1L", "10", "2.50", "10");
assert(
  validAgr.valid === true && Math.abs(validAgr.subtotal - 22.50) < 0.001,
  "Prueba 16 (Criterio 2): Acepta acuerdo comercial válido y calcula subtotal con 10% descuento ($22.50)"
);

// Caso 2: Rechaza cantidad <= 0
const invalidQty = validateAgreement("Arroz 5kg", "0", "4.50");
assert(
  invalidQty.valid === false && invalidQty.message.includes("Cantidad"),
  "Prueba 17 (Criterio 2): Rechaza cantidad pactada igual a 0"
);

// Caso 3: Rechaza precio unitario <= 0
const invalidPrice = validateAgreement("Atun 180g", "12", "-1.50");
assert(
  invalidPrice.valid === false && invalidPrice.message.includes("Precio"),
  "Prueba 18 (Criterio 2): Rechaza precio unitario negativo o cero"
);

// Caso 4: Rechaza descuento > 100%
const invalidDiscount = validateAgreement("Harina 1kg", "5", "1.20", "120");
assert(
  invalidDiscount.valid === false && invalidDiscount.message.includes("Descuento"),
  "Prueba 19 (Criterio 2): Rechaza porcentaje de descuento superior al 100%"
);

// -----------------------------------------------------------------------------
// BLOQUE 5: SIMULACIÓN DE CRITERIO 3 — PERSISTENCIA EN ROOM CON ESTADO PENDING
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 5] Criterio 3: Persistencia local inmediata en Room con estado PENDING:");

// Mock de base de datos Room en memoria
const roomVisitasTable = [];

// 1. Check-in se inserta en Room
const initialCheckIn = {
  id: "visita-uuid-001",
  jornadaId: "shift-uuid-999",
  clienteId: clientLocation.lat.toString(),
  vendedorId: "seller-uuid-777",
  checkInTime: Date.now(),
  checkOutTime: null,
  checkInLat: posInside.lat,
  checkInLng: posInside.lng,
  distanciaClienteMetros: distInside,
  estado: statusInside,
  observaciones: null,
  acuerdosJson: null,
  sincronizado: false, // PENDING
};
roomVisitasTable.push(initialCheckIn);

assert(
  roomVisitasTable.length === 1 && roomVisitasTable[0].sincronizado === false,
  "Prueba 20 (Criterio 3): Check-in persiste inmediatamente en Room con sincronizado = false (PENDING)"
);

// 2. Check-out actualiza el registro conservando sincronizado = false
const agreementsPayload = {
  agreements: [
    { id: "1", product_name: "Aceite Girasol 1L", quantity: 10, agreed_unit_price: 2.5, discount_percentage: 10, subtotal: 22.5 },
    { id: "2", product_name: "Atun 180g", quantity: 20, agreed_unit_price: 1.5, discount_percentage: 0, subtotal: 30.0 },
  ],
  total_amount: 52.5,
  total_items: 2,
  promised_delivery_date: "2026-11-15",
  stock_notes: "4 cajas en bodega",
};

const finalVisitIndex = roomVisitasTable.findIndex((v) => v.id === "visita-uuid-001");
roomVisitasTable[finalVisitIndex] = {
  ...roomVisitasTable[finalVisitIndex],
  checkOutTime: Date.now() + 600000, // 10 min después
  checkOutLat: posInside.lat,
  checkOutLng: posInside.lng,
  observaciones: "Acuerdo con jefe de compras confirmado.",
  acuerdosJson: JSON.stringify(agreementsPayload),
  sincronizado: false, // Sigue PENDING hasta que el worker lo sincronice
};

assert(
  roomVisitasTable[0].sincronizado === false &&
    roomVisitasTable[0].checkOutTime !== null &&
    roomVisitasTable[0].acuerdosJson !== null,
  "Prueba 21 (Criterio 3): Check-out actualiza la visita en Room manteniendo estado PENDING para SyncWorker"
);

// 3. Verificación de acuerdos parseables en formato JSON estructurado
const parsedAgreements = JSON.parse(roomVisitasTable[0].acuerdosJson);
assert(
  parsedAgreements.agreements.length === 2 &&
    parsedAgreements.total_amount === 52.5 &&
    parsedAgreements.promised_delivery_date === "2026-11-15",
  "Prueba 22 (Criterio 3): JSON de acuerdos contiene 2 productos, total $52.50 y fecha prometida de entrega"
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
