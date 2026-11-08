/**
 * ROUTRACK — Esquema de Validación para Edge Function sync-jornada
 * Archivo: supabase/functions/sync-jornada/schema.ts
 * Runtime: Deno / TypeScript (strict)
 */

import {
  SyncBatchPayload,
  SyncTrackingPoint,
  SyncVisitRecord,
  SyncSystemEvent,
  MAX_CLOCK_SKEW_MS,
  MAX_BATCH_TRACKING_POINTS,
  MAX_BATCH_VISITS,
  MAX_BATCH_EVENTS,
  isValidUUID,
  isValidHmacHash
} from '../_shared/syncContracts.ts';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Valida minuciosamente un punto de telemetría GPS.
 */
export function validateTrackingPoint(pt: unknown, index: number): string | null {
  if (!pt || typeof pt !== 'object') {
    return `tracking_points[${index}]: No es un objeto válido`;
  }
  const p = pt as Record<string, unknown>;

  if (!isValidUUID(p.id as string)) {
    return `tracking_points[${index}].id: UUID inválido (${p.id})`;
  }

  const lat = p.latitude as number;
  if (typeof lat !== 'number' || isNaN(lat) || lat < -90.0 || lat > 90.0) {
    return `tracking_points[${index}].latitude: Fuera de rango WGS84 (-90 a 90): ${lat}`;
  }

  const lng = p.longitude as number;
  if (typeof lng !== 'number' || isNaN(lng) || lng < -180.0 || lng > 180.0) {
    return `tracking_points[${index}].longitude: Fuera de rango WGS84 (-180 a 180): ${lng}`;
  }

  const acc = p.accuracy_meters as number;
  if (typeof acc !== 'number' || isNaN(acc) || acc < 0) {
    return `tracking_points[${index}].accuracy_meters: Debe ser un número no negativo: ${acc}`;
  }

  if (typeof p.recorded_at !== 'string' || isNaN(Date.parse(p.recorded_at))) {
    return `tracking_points[${index}].recorded_at: Formato de fecha ISO 8601 inválido`;
  }

  const recTime = new Date(p.recorded_at).getTime();
  const now = Date.now();
  if (recTime > now + MAX_CLOCK_SKEW_MS) {
    return `tracking_points[${index}].recorded_at: Timestamp futuro excede tolerancia de 5 minutos (${p.recorded_at})`;
  }

  if (typeof p.previous_hash !== 'string' || p.previous_hash.trim().length === 0) {
    return `tracking_points[${index}].previous_hash: No puede ser vacío`;
  }

  if (!isValidHmacHash(p.hmac_hash as string)) {
    return `tracking_points[${index}].hmac_hash: Formato hex HMAC-SHA256 inválido (${p.hmac_hash})`;
  }

  return null;
}

/**
 * Valida un registro de visita comercial.
 */
export function validateVisitRecord(v: unknown, index: number): string | null {
  if (!v || typeof v !== 'object') {
    return `visit_records[${index}]: No es un objeto válido`;
  }
  const visit = v as Record<string, unknown>;

  if (!isValidUUID(visit.id as string)) {
    return `visit_records[${index}].id: UUID inválido`;
  }
  if (!isValidUUID(visit.client_id as string)) {
    return `visit_records[${index}].client_id: UUID de cliente inválido`;
  }
  if (typeof visit.check_in_time !== 'string' || isNaN(Date.parse(visit.check_in_time))) {
    return `visit_records[${index}].check_in_time: Formato ISO 8601 inválido`;
  }

  const loc = visit.check_in_location as Record<string, unknown>;
  if (!loc || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') {
    return `visit_records[${index}].check_in_location: Coordenadas requeridas inválidas`;
  }

  if (!isValidHmacHash(visit.hmac_hash as string)) {
    return `visit_records[${index}].hmac_hash: Formato hex HMAC-SHA256 inválido`;
  }

  return null;
}

/**
 * Valida un evento del sistema.
 */
export function validateSystemEvent(e: unknown, index: number): string | null {
  if (!e || typeof e !== 'object') {
    return `system_events[${index}]: No es un objeto válido`;
  }
  const event = e as Record<string, unknown>;

  if (typeof event.event_type !== 'string' || event.event_type.trim().length === 0) {
    return `system_events[${index}].event_type: Requerido`;
  }
  if (typeof event.occurred_at !== 'string' || isNaN(Date.parse(event.occurred_at))) {
    return `system_events[${index}].occurred_at: Formato ISO 8601 inválido`;
  }
  if (!isValidHmacHash(event.hmac_hash as string)) {
    return `system_events[${index}].hmac_hash: Formato hex HMAC-SHA256 inválido`;
  }

  return null;
}

/**
 * Validador integral del payload completo de lote (SyncBatchPayload).
 */
export function validateSyncBatch(payload: unknown): ValidationResult<SyncBatchPayload> {
  if (!payload || typeof payload !== 'object') {
    return { success: false, error: 'El cuerpo de la solicitud debe ser un objeto JSON' };
  }

  const p = payload as Record<string, unknown>;

  if (!isValidUUID(p.sync_batch_id as string)) {
    return { success: false, error: 'sync_batch_id debe ser un UUID v4 válido' };
  }
  if (!isValidUUID(p.shift_id as string)) {
    return { success: false, error: 'shift_id debe ser un UUID v4 válido' };
  }
  if (!isValidUUID(p.organization_id as string)) {
    return { success: false, error: 'organization_id debe ser un UUID v4 válido' };
  }
  if (!isValidUUID(p.seller_id as string)) {
    return { success: false, error: 'seller_id debe ser un UUID v4 válido' };
  }

  if (typeof p.batch_timestamp !== 'string' || isNaN(Date.parse(p.batch_timestamp))) {
    return { success: false, error: 'batch_timestamp debe tener formato ISO 8601 válido' };
  }

  const batchTime = new Date(p.batch_timestamp).getTime();
  if (batchTime > Date.now() + MAX_CLOCK_SKEW_MS) {
    return { success: false, error: 'batch_timestamp excede la tolerancia máxima de reloj futuro (5 minutos)' };
  }

  // Validar límites de volumen por lote
  const points = (Array.isArray(p.tracking_points) ? p.tracking_points : []) as SyncTrackingPoint[];
  if (points.length > MAX_BATCH_TRACKING_POINTS) {
    return { success: false, error: `Excede el máximo de ${MAX_BATCH_TRACKING_POINTS} puntos por lote` };
  }

  const visits = (Array.isArray(p.visit_records) ? p.visit_records : []) as SyncVisitRecord[];
  if (visits.length > MAX_BATCH_VISITS) {
    return { success: false, error: `Excede el máximo de ${MAX_BATCH_VISITS} visitas por lote` };
  }

  const events = (Array.isArray(p.system_events) ? p.system_events : []) as SyncSystemEvent[];
  if (events.length > MAX_BATCH_EVENTS) {
    return { success: false, error: `Excede el máximo de ${MAX_BATCH_EVENTS} eventos por lote` };
  }

  // Validar elementos individuales
  for (let i = 0; i < points.length; i++) {
    const err = validateTrackingPoint(points[i], i);
    if (err) return { success: false, error: err };
  }

  for (let i = 0; i < visits.length; i++) {
    const err = validateVisitRecord(visits[i], i);
    if (err) return { success: false, error: err };
  }

  for (let i = 0; i < events.length; i++) {
    const err = validateSystemEvent(events[i], i);
    if (err) return { success: false, error: err };
  }

  const validated: SyncBatchPayload = {
    sync_batch_id: p.sync_batch_id as string,
    shift_id: p.shift_id as string,
    organization_id: p.organization_id as string,
    seller_id: p.seller_id as string,
    batch_timestamp: p.batch_timestamp as string,
    tracking_points: points,
    visit_records: visits,
    system_events: events
  };

  return { success: true, data: validated };
}
