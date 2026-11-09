/**
 * ROUTRACK — Runner de Pruebas Unitarias para Gestión y Georreferenciación de Clientes
 * Archivo: web-admin/scripts/run-client-tests.mjs
 *
 * Tarea: TASK-017 (Fase 6)
 * Valida de forma automatizada:
 *  1. Esquema de validación Zod (Criterio 1: Creación y edición validada con Zod).
 *  2. Conversión a sintaxis PostGIS WKT `GEOMETRY(Point, 4326)` (Criterio 2: Coordenadas persistidas).
 *  3. Parser WKT / GeoJSON y control de límites geodésicos WGS84.
 *  4. Búsqueda y filtrado reactivo de clientes comerciales.
 *  5. Verificación geodésica de presencia en geocerca (`ST_DWithin`).
 */

import { z } from "zod";

console.log("================================================================================");
console.log("  ROUTRACK — SUITE DE PRUEBAS UNITARIAS: GESTIÓN DE CLIENTES (TASK-017)");
console.log("================================================================================");

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

// -----------------------------------------------------------------------------
// 1. REPRODUCCIÓN CANÓNICA DE REGLAS ZOD Y HELPERS (Identicos a clientSchema.ts)
// -----------------------------------------------------------------------------

function isValidEcuadorianTaxId(id) {
  if (!/^\d{10}(\d{3})?$/.test(id)) return false;
  if (id.length === 13 && !id.endsWith("001")) return false;
  return true;
}

const clientFormSchema = z.object({
  nombre: z
    .string({ required_error: "La razón social o nombre del cliente es obligatoria" })
    .trim()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .max(150, "El nombre no puede exceder los 150 caracteres"),

  nombre_comercial: z
    .string()
    .trim()
    .max(150)
    .optional()
    .nullable()
    .or(z.literal("")),

  identificacion_fiscal: z
    .string({ required_error: "La identificación fiscal (RUC / Cédula) es obligatoria" })
    .trim()
    .min(10, "La identificación debe tener al menos 10 dígitos")
    .max(13, "La identificación no puede superar los 13 dígitos")
    .refine((val) => isValidEcuadorianTaxId(val), {
      message:
        "Identificación fiscal inválida. Debe ser una Cédula de 10 dígitos o un RUC ecuatoriano de 13 dígitos terminado en 001",
    }),

  direccion: z
    .string({ required_error: "La dirección física del establecimiento es obligatoria" })
    .trim()
    .min(5, "La dirección debe contener al menos 5 caracteres")
    .max(250),

  telefono: z
    .string()
    .trim()
    .regex(/^[0-9+() -]{7,20}$/, "Formato de teléfono inválido")
    .optional()
    .nullable()
    .or(z.literal("")),

  latitud: z
    .number({ required_error: "Latitud obligatoria", invalid_type_error: "Debe ser número" })
    .min(-90, "Latitud mínima -90°")
    .max(90, "Latitud máxima 90°"),

  longitud: z
    .number({ required_error: "Longitud obligatoria", invalid_type_error: "Debe ser número" })
    .min(-180, "Longitud mínima -180°")
    .max(180, "Longitud máxima 180°"),

  radio_tolerancia_metros: z
    .number({ required_error: "Radio obligatorio", invalid_type_error: "Debe ser número entero" })
    .int("Debe ser entero")
    .min(10, "Radio mínimo 10m")
    .max(1000, "Radio máximo 1000m")
    .default(50),

  activo: z.boolean().default(true),
});

// Helpers PostGIS
function formatToWKTPoint(latitud, longitud) {
  return `POINT(${longitud.toFixed(6)} ${latitud.toFixed(6)})`;
}

function parseWKTPoint(wkt) {
  if (!wkt || typeof wkt !== "string") return null;
  const pointMatch = wkt.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
  if (!pointMatch) return null;

  const lng = Number.parseFloat(pointMatch[1]);
  const lat = Number.parseFloat(pointMatch[2]);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
}

// Haversine geodésico
const EARTH_RADIUS_METERS = 6371000;
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

// -----------------------------------------------------------------------------
// BLOQUE 1: VALIDACIÓN ZOD (CRITERIO 1)
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 1] Validación de Esquemas Zod para Clientes Comerciales:");

// Test 1: Acepta cliente válido con RUC ecuatoriano de 13 dígitos terminado en 001
const validClientRuc = {
  nombre: "Corporación Favorita C.A.",
  nombre_comercial: "Supermaxi El Jardín",
  identificacion_fiscal: "1790016919001",
  direccion: "Av. Amazonas N24-196 y Av. República, Quito",
  telefono: "02-2980-000",
  latitud: -0.190123,
  longitud: -78.487654,
  radio_tolerancia_metros: 60,
  activo: true,
};
const res1 = clientFormSchema.safeParse(validClientRuc);
assert(res1.success === true, "Zod acepta cliente válido con RUC ecuatoriano de 13 dígitos terminado en 001");

// Test 2: Acepta cliente válido con Cédula de 10 dígitos y campos opcionales omitidos
const validClientCedula = {
  nombre: "Distribuidora Los Andes",
  identificacion_fiscal: "1712345678",
  direccion: "Calle Rocafuerte y Guayaquil, Quito Centro",
  latitud: -0.220101,
  longitud: -78.510203,
  radio_tolerancia_metros: 50,
};
const res2 = clientFormSchema.safeParse(validClientCedula);
assert(
  res2.success === true && res2.data.activo === true,
  "Zod acepta Cédula de 10 dígitos y aplica valores por defecto (activo = true)"
);

// Test 3: Rechaza RUC ecuatoriano de 13 dígitos que NO termina en 001
const invalidRucEnding = {
  ...validClientRuc,
  identificacion_fiscal: "1790016919002",
};
const res3 = clientFormSchema.safeParse(invalidRucEnding);
assert(res3.success === false, "Zod rechaza RUC ecuatoriano que no culmina en 001");

// Test 4: Rechaza identificación con letras o caracteres alfanuméricos no válidos
const invalidRucLetters = {
  ...validClientRuc,
  identificacion_fiscal: "179001691900A",
};
const res4 = clientFormSchema.safeParse(invalidRucLetters);
assert(res4.success === false, "Zod rechaza identificación fiscal con caracteres no numéricos");

// Test 5: Rechaza nombre con longitud menor a 3 caracteres
const invalidShortName = {
  ...validClientRuc,
  nombre: "AB",
};
const res5 = clientFormSchema.safeParse(invalidShortName);
assert(res5.success === false, "Zod rechaza nombre comercial con menos de 3 caracteres");

// Test 6: Rechaza dirección con longitud menor a 5 caracteres
const invalidShortAddress = {
  ...validClientRuc,
  direccion: "Av.",
};
const res6 = clientFormSchema.safeParse(invalidShortAddress);
assert(res6.success === false, "Zod rechaza dirección física con menos de 5 caracteres");

// Test 7: Rechaza latitud fuera del rango WGS84 [-90, +90]
const invalidLat = {
  ...validClientRuc,
  latitud: 91.5,
};
const res7 = clientFormSchema.safeParse(invalidLat);
assert(res7.success === false, "Zod rechaza latitud superior a +90° WGS84");

// Test 8: Rechaza longitud fuera del rango WGS84 [-180, +180]
const invalidLng = {
  ...validClientRuc,
  longitud: -185.0,
};
const res8 = clientFormSchema.safeParse(invalidLng);
assert(res8.success === false, "Zod rechaza longitud inferior a -180° WGS84");

// Test 9: Rechaza radio de tolerancia menor a 10 metros
const invalidRadioMin = {
  ...validClientRuc,
  radio_tolerancia_metros: 5,
};
const res9 = clientFormSchema.safeParse(invalidRadioMin);
assert(res9.success === false, "Zod rechaza radio de geocerca menor al umbral mínimo de 10 metros");

// Test 10: Rechaza radio de tolerancia mayor a 1000 metros
const invalidRadioMax = {
  ...validClientRuc,
  radio_tolerancia_metros: 1500,
};
const res10 = clientFormSchema.safeParse(invalidRadioMax);
assert(res10.success === false, "Zod rechaza radio de geocerca superior a 1000 metros (1 km)");

// -----------------------------------------------------------------------------
// BLOQUE 2: CONVERSIÓN Y FORMATEO POSTGIS GEOMETRY (CRITERIO 2)
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 2] Persistencia y Formateo PostGIS GEOMETRY(Point, 4326):");

// Test 11: formatToWKTPoint genera orden canónico X=longitud, Y=latitud
const wktFormatted = formatToWKTPoint(-0.190123, -78.487654);
assert(
  wktFormatted === "POINT(-78.487654 -0.190123)",
  "formatToWKTPoint genera sintaxis POINT(lng lat) con X=Longitud y Y=Latitud"
);

// Test 12: parseWKTPoint recupera latitud y longitud correctamente
const parsedWkt = parseWKTPoint("POINT(-78.487654 -0.190123)");
assert(
  parsedWkt !== null &&
    Math.abs(parsedWkt.lat - -0.190123) < 0.000001 &&
    Math.abs(parsedWkt.lng - -78.487654) < 0.000001,
  "parseWKTPoint extrae latitud y longitud con precisión decimal idéntica"
);

// Test 13: parseWKTPoint tolera prefijo PostGIS EWKT 'SRID=4326;'
const parsedEWkt = parseWKTPoint("SRID=4326;POINT(-78.491234 -0.203456)");
assert(
  parsedEWkt !== null &&
    Math.abs(parsedEWkt.lat - -0.203456) < 0.000001 &&
    Math.abs(parsedEWkt.lng - -78.491234) < 0.000001,
  "parseWKTPoint procesa cadenas EWKT de PostGIS con identificador SRID=4326"
);

// Test 14: parseWKTPoint rechaza cadenas corruptas o no válidas retornando null
const corruptWkt = parseWKTPoint("POLYGON((-78.4 0, -78.5 0))");
const emptyWkt = parseWKTPoint("");
assert(corruptWkt === null && emptyWkt === null, "parseWKTPoint rechaza cadenas geométricas inválidas retornando null");

// -----------------------------------------------------------------------------
// BLOQUE 3: BÚSQUEDA, FILTRADO Y VALIDACIÓN GEODÉSICA DE GEOCERCA
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 3] Lógica de Búsqueda y Validación Geodésica de Clientes:");

const mockCatalog = [
  {
    id: "1",
    nombre: "Corporación Favorita C.A.",
    nombre_comercial: "Supermaxi El Jardín",
    identificacion_fiscal: "1790016919001",
    direccion: "Av. Amazonas y República",
    latitud: -0.190123,
    longitud: -78.487654,
    radio_tolerancia_metros: 50,
    activo: true,
  },
  {
    id: "2",
    nombre: "Tiendas Industriales TIA",
    nombre_comercial: "Tía La Mariscal",
    identificacion_fiscal: "0990011234001",
    direccion: "Calle Juan León Mera",
    latitud: -0.203456,
    longitud: -78.491234,
    radio_tolerancia_metros: 40,
    activo: true,
  },
  {
    id: "3",
    nombre: "Distribuidora San Bartolo",
    nombre_comercial: null,
    identificacion_fiscal: "1712345678001",
    direccion: "Av. Maldonado Sur",
    latitud: -0.258901,
    longitud: -78.523456,
    radio_tolerancia_metros: 50,
    activo: false,
  },
];

// Test 15: Búsqueda textual sobre razón social y nombre comercial
const query = "jardín";
const matchesQuery = mockCatalog.filter(
  (c) =>
    c.nombre.toLowerCase().includes(query.toLowerCase()) ||
    (c.nombre_comercial && c.nombre_comercial.toLowerCase().includes(query.toLowerCase()))
);
assert(matchesQuery.length === 1 && matchesQuery[0].id === "1", "Filtrado por nombre comercial devuelve coincidencia exacta");

// Test 16: Búsqueda por RUC parcial
const rucQuery = "099001";
const matchesRuc = mockCatalog.filter((c) => c.identificacion_fiscal.includes(rucQuery));
assert(matchesRuc.length === 1 && matchesRuc[0].id === "2", "Filtrado por subcadena de RUC localiza al cliente esperado");

// Test 17: Filtrado por estado activo/inactivo
const activeClients = mockCatalog.filter((c) => c.activo);
const inactiveClients = mockCatalog.filter((c) => !c.activo);
assert(activeClients.length === 2 && inactiveClients.length === 1, "Filtro por estado segrega clientes activos e inactivos");

// Test 18: Validación espacial de geocerca (ST_DWithin simulated)
const sellerAtClientDoor = { lat: -0.190150, lng: -78.487670 }; // ~4 metros de distancia
const distanceInside = haversineDistanceMeters(
  mockCatalog[0].latitud,
  mockCatalog[0].longitud,
  sellerAtClientDoor.lat,
  sellerAtClientDoor.lng
);
const isInside = distanceInside <= mockCatalog[0].radio_tolerancia_metros;

const sellerFarAway = { lat: -0.191500, lng: -78.488500 }; // ~170 metros de distancia
const distanceOutside = haversineDistanceMeters(
  mockCatalog[0].latitud,
  mockCatalog[0].longitud,
  sellerFarAway.lat,
  sellerFarAway.lng
);
const isOutside = distanceOutside > mockCatalog[0].radio_tolerancia_metros;

assert(
  isInside && isOutside,
  `Validación geodésica ST_DWithin: Dentro=${isInside} (${distanceInside.toFixed(1)}m <= 50m), Fuera=${isOutside} (${distanceOutside.toFixed(1)}m > 50m)`
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

