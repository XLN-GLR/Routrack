/**
 * ROUTRACK — Runner de Validación de Contratos Zod para Sincronización
 * Archivo: web-admin/scripts/run-sync-tests.mjs
 */

import { z } from 'zod';

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MIN_HISTORICAL_TIMESTAMP_MS = new Date('2024-01-01T00:00:00.000Z').getTime();

const strictIsoTimestampSchema = z
  .string({ message: 'La marca de tiempo debe ser una cadena de texto en formato ISO 8601' })
  .datetime({ message: 'El formato de fecha/hora debe ser ISO 8601 UTC válido' })
  .refine(
    (isoString) => {
      const timestampMs = new Date(isoString).getTime();
      return !isNaN(timestampMs) && timestampMs >= MIN_HISTORICAL_TIMESTAMP_MS;
    },
    { message: 'La marca de tiempo es anterior a la fecha mínima permitida (2024-01-01)' }
  )
  .refine(
    (isoString) => {
      const timestampMs = new Date(isoString).getTime();
      const serverNow = Date.now();
      return timestampMs <= serverNow + MAX_CLOCK_SKEW_MS;
    },
    { message: 'La marca de tiempo excede el umbral de tolerancia futura permitido (máximo 5 minutos de desvío)' }
  );

const hmacHashSchema = z
  .string({ message: 'El hash criptográfico HMAC es obligatorio' })
  .regex(/^[a-f0-9]{64}$/i, {
    message: 'El hash HMAC debe ser una cadena hexadecimal válida de 64 caracteres (SHA-256)',
  });

const geoCoordinateSchema = z.object({
  latitude: z.number().min(-90.0).max(90.0),
  longitude: z.number().min(-180.0).max(180.0),
});

const syncTrackingPointSchema = z.object({
  id: z.string().uuid(),
  latitude: z.number().min(-90.0, { message: 'Latitud inválida (rango: -90 a 90)' }).max(90.0, { message: 'Latitud inválida (rango: -90 a 90)' }),
  longitude: z.number().min(-180.0, { message: 'Longitud inválida (rango: -180 a 180)' }).max(180.0, { message: 'Longitud inválida (rango: -180 a 180)' }),
  accuracy_meters: z.number().min(0, { message: 'La precisión horizontal en metros no puede ser negativa' }).max(5000),
  speed_ms: z.number().min(0).max(150).nullable().optional(),
  altitude_meters: z.number().min(-500).max(9000).nullable().optional(),
  bearing_degrees: z.number().min(0.0).max(360.0).nullable().optional(),
  battery_level: z.number().int().min(0).max(100).nullable().optional(),
  is_mock: z.boolean(),
  recorded_at: strictIsoTimestampSchema,
  previous_hash: hmacHashSchema,
  hmac_hash: hmacHashSchema,
});

const syncVisitRecordSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  check_in_time: strictIsoTimestampSchema,
  check_out_time: strictIsoTimestampSchema.nullable().optional(),
  check_in_location: geoCoordinateSchema,
  check_out_location: geoCoordinateSchema.nullable().optional(),
  observations: z.string().max(2000).nullable().optional(),
  agreed_prices_commitments: z.record(z.string(), z.unknown()).nullable().optional(),
  hmac_hash: hmacHashSchema,
});

const syncSystemEventSchema = z.object({
  id: z.string().uuid().optional(),
  event_type: z.enum([
    'GPS_DISABLED',
    'SIGNAL_LOST',
    'MOCK_LOCATION_DETECTED',
    'SHIFT_OPENED',
    'SHIFT_CLOSED',
    'SERVICE_STARTED',
    'SERVICE_STOPPED',
    'BATTERY_LOW',
    'TIME_ANOMALY_DETECTED',
    'CAPTURA_GPS',
  ]),
  event_severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
  occurred_at: strictIsoTimestampSchema,
  metadata: z.record(z.string(), z.unknown()),
  location: geoCoordinateSchema.nullable().optional(),
  previous_hash: hmacHashSchema,
  hmac_hash: hmacHashSchema,
});

const syncBatchPayloadSchema = z.object({
  sync_batch_id: z.string().uuid(),
  shift_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  seller_id: z.string().uuid(),
  batch_timestamp: strictIsoTimestampSchema,
  tracking_points: z.array(syncTrackingPointSchema).max(500),
  visit_records: z.array(syncVisitRecordSchema).max(100),
  system_events: z.array(syncSystemEventSchema).max(100),
});

function validateSyncBatchPayload(data) {
  const result = syncBatchPayloadSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0]?.message || 'Payload no válido',
      issues: result.error.issues,
    };
  }
  return { success: true, data: result.data };
}

// Suite de Pruebas
console.log('--- INICIANDO EJECUCIÓN FORMAL DE PRUEBAS DE CONTRATOS ZOD (TASK-005) ---');
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

const createValidPayload = () => ({
  sync_batch_id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
  shift_id: 'b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e',
  organization_id: 'c3d4e5f6-a1b2-4c3d-ab4e-5f6a7b8c9d0e',
  seller_id: 'd4e5f6a1-b2c3-4d4e-bc5f-6a7b8c9d0e1f',
  batch_timestamp: new Date().toISOString(),
  tracking_points: [
    {
      id: 'e5f6a1b2-c3d4-4e5f-8a6b-7c8d9e0f1a2b',
      latitude: -0.180653,
      longitude: -78.467834,
      accuracy_meters: 4.5,
      speed_ms: 12.3,
      altitude_meters: 2815.0,
      bearing_degrees: 182.5,
      battery_level: 84,
      is_mock: false,
      recorded_at: new Date(Date.now() - 60000).toISOString(),
      previous_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      hmac_hash: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
    },
  ],
  visit_records: [
    {
      id: 'f6a1b2c3-d4e5-4f6a-9b7c-8d9e0f1a2b3c',
      client_id: 'a7b8c9d0-e1f2-4a3b-8c5d-6e7f8a9b0c1d',
      check_in_time: new Date(Date.now() - 120000).toISOString(),
      check_out_time: new Date(Date.now() - 30000).toISOString(),
      check_in_location: { latitude: -0.18055, longitude: -78.46771 },
      check_out_location: { latitude: -0.180555, longitude: -78.467715 },
      observations: 'Visita presencial verificada con inventario.',
      agreed_prices_commitments: { agreed_discount_pct: 5.0, unit_price_pactado: 12.5 },
      hmac_hash: '5d41402abc4b2a76b9719d911017c5926c4592a2a095a8946764516335a90d8a',
    },
  ],
  system_events: [
    {
      event_type: 'GPS_DISABLED',
      event_severity: 'WARNING',
      occurred_at: new Date(Date.now() - 180000).toISOString(),
      metadata: { reason: 'USER_SETTINGS_TOGGLE', battery_pct: 84 },
      previous_hash: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
      hmac_hash: '7a38b1d9236a287b4699fb42e126a1b24f5a31e138a3901bcae0350d738f615e',
    },
  ],
});

// Prueba 1: Caso válido
const validPayload = createValidPayload();
const resValid = validateSyncBatchPayload(validPayload);
if (!resValid.success) {
  console.log('DEBUG ISSUES resValid:', JSON.stringify(resValid.issues, null, 2));
}
assert(resValid.success, 'Prueba 1: Aprobación de lote de sincronización completo y válido');

// Prueba 2: Timestamp futuro anómalo (> 5 minutos)
const futurePayload = createValidPayload();
futurePayload.tracking_points[0].recorded_at = new Date(Date.now() + MAX_CLOCK_SKEW_MS + 60000).toISOString();
const resFuture = validateSyncBatchPayload(futurePayload);
assert(!resFuture.success && resFuture.error.includes('tolerancia futura'), 'Prueba 2: Rechazo de timestamp futuro (> 5 minutos)');

// Prueba 3: Latitud fuera de rango (-95.0)
const invalidLat = createValidPayload();
invalidLat.tracking_points[0].latitude = -95.0;
const resLat = validateSyncBatchPayload(invalidLat);
assert(!resLat.success && resLat.error.includes('Latitud inválida'), 'Prueba 3: Rechazo de latitud fuera de rango (-95.0)');

// Prueba 4: Longitud fuera de rango (190.0)
const invalidLng = createValidPayload();
invalidLng.tracking_points[0].longitude = 190.0;
const resLng = validateSyncBatchPayload(invalidLng);
assert(!resLng.success && resLng.error.includes('Longitud inválida'), 'Prueba 4: Rechazo de longitud fuera de rango (190.0)');

// Prueba 5: Precisión negativa (-5m)
const invalidAcc = createValidPayload();
invalidAcc.tracking_points[0].accuracy_meters = -5.0;
const resAcc = validateSyncBatchPayload(invalidAcc);
assert(!resAcc.success && resAcc.error.includes('no puede ser negativa'), 'Prueba 5: Rechazo de precisión horizontal negativa');

// Prueba 6: Hash HMAC adulterado
const invalidHmac = createValidPayload();
invalidHmac.tracking_points[0].hmac_hash = 'adulterated_hash_123';
const resHmac = validateSyncBatchPayload(invalidHmac);
assert(!resHmac.success && resHmac.error.includes('hash HMAC'), 'Prueba 6: Rechazo de firma HMAC adulterada o incompleta');

// Prueba 7: UUID no conforme
const invalidUuid = createValidPayload();
invalidUuid.sync_batch_id = 'not-a-valid-uuid';
const resUuid = validateSyncBatchPayload(invalidUuid);
assert(!resUuid.success, 'Prueba 7: Rechazo de sync_batch_id con formato no UUID');

// Prueba 8: Lote con eventos y sin puntos GPS
const emptyPoints = createValidPayload();
emptyPoints.tracking_points = [];
const resEmpty = validateSyncBatchPayload(emptyPoints);
assert(resEmpty.success, 'Prueba 8: Aprobación de lote con arreglo de puntos vacío');

console.log(`\nRESUMEN FINAL: ${passed} pruebas aprobadas, ${failed} pruebas falladas.`);
if (failed > 0) process.exit(1);
