/**
 * ROUTRACK — Pruebas de Validación de Contratos Zod para Sincronización
 * Archivo: web-admin/src/lib/validation/syncSchemas.test.ts
 *
 * Valida de forma estricta y cuantitativa los contratos de sincronización offline-first,
 * detección de timestamps futuros anómalos, coordenadas espurias y hashes inválidos.
 */

import {
  validateSyncBatchPayload,
  MAX_CLOCK_SKEW_MS,
} from './syncSchemas';
import type { SyncBatchPayload } from '@/types/sync';

// Objeto de prueba base con UUIDs RFC 4122 válidos
export const createValidPayload = (): SyncBatchPayload => ({
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
      check_in_location: {
        latitude: -0.18055,
        longitude: -78.46771,
      },
      check_out_location: {
        latitude: -0.180555,
        longitude: -78.467715,
      },
      observations: 'Visita exitosa con reposición acordada.',
      agreed_prices_commitments: {
        agreed_discount_pct: 5.0,
        unit_price_pactado: 12.5,
      },
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

export function runTests(): boolean {
  console.log('--- INICIANDO SUITE DE PRUEBAS ZOD: CONTRATOS DE SINCRONIZACIÓN ROUTRACK ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Caso válido
  const validPayload = createValidPayload();
  const resValid = validateSyncBatchPayload(validPayload);
  assert(resValid.success, 'Validación exitosa de lote completo válido');

  // 2. Timestamp futuro mayor a 5 minutos (debe fallar)
  const futurePayload = createValidPayload();
  const futureTime = new Date(Date.now() + MAX_CLOCK_SKEW_MS + 60000).toISOString();
  futurePayload.tracking_points[0].recorded_at = futureTime;
  const resFuture = validateSyncBatchPayload(futurePayload);
  assert(
    !resFuture.success && resFuture.error.includes('tolerancia futura'),
    'Rechazo estricto de timestamp futuro anómalo (> 5 minutos)'
  );

  // 3. Coordenada espuria: Latitud fuera de rango (-95)
  const invalidLatPayload = createValidPayload();
  invalidLatPayload.tracking_points[0].latitude = -95.0;
  const resInvalidLat = validateSyncBatchPayload(invalidLatPayload);
  assert(
    !resInvalidLat.success && resInvalidLat.error.includes('Latitud inválida'),
    'Rechazo estricto de latitud fuera de rango (-95.0)'
  );

  // 4. Coordenada espuria: Longitud fuera de rango (190)
  const invalidLngPayload = createValidPayload();
  invalidLngPayload.tracking_points[0].longitude = 190.0;
  const resInvalidLng = validateSyncBatchPayload(invalidLngPayload);
  assert(
    !resInvalidLng.success && resInvalidLng.error.includes('Longitud inválida'),
    'Rechazo estricto de longitud fuera de rango (190.0)'
  );

  // 5. Precisión negativa (-1 metro)
  const negAccuracyPayload = createValidPayload();
  negAccuracyPayload.tracking_points[0].accuracy_meters = -1.0;
  const resNegAcc = validateSyncBatchPayload(negAccuracyPayload);
  assert(!resNegAcc.success, 'Rechazo estricto de precisión negativa');

  // 6. Hash HMAC manipulado (longitud incorrecta o caracteres inválidos)
  const invalidHmacPayload = createValidPayload();
  invalidHmacPayload.tracking_points[0].hmac_hash = 'not-a-valid-sha256-hash';
  const resInvalidHmac = validateSyncBatchPayload(invalidHmacPayload);
  assert(
    !resInvalidHmac.success && resInvalidHmac.error.includes('hash HMAC'),
    'Rechazo estricto de hash HMAC corrupto o incompleto'
  );

  // 7. UUID malformado
  const invalidUuidPayload = createValidPayload();
  invalidUuidPayload.sync_batch_id = '123-not-a-uuid';
  const resInvalidUuid = validateSyncBatchPayload(invalidUuidPayload);
  assert(!resInvalidUuid.success, 'Rechazo estricto de sync_batch_id no UUID');

  // 8. Lote sin puntos pero con eventos del sistema válidos
  const emptyPointsPayload = createValidPayload();
  emptyPointsPayload.tracking_points = [];
  emptyPointsPayload.visit_records = [];
  const resEmptyPoints = validateSyncBatchPayload(emptyPointsPayload);
  assert(resEmptyPoints.success, 'Validación exitosa de lote con 0 puntos y solo eventos del sistema');

  console.log(`\nRESULTADOS: ${passed} pasados, ${failed} fallados de ${passed + failed} pruebas.`);
  return failed === 0;
}
