/**
 * ROUTRACK — Contratos Compartidos de Sincronización (Edge Functions & Supabase)
 * Archivo: supabase/functions/_shared/syncContracts.ts
 *
 * Módulo común TypeScript para Supabase Edge Functions (Deno runtime).
 * Define las estructuras de datos, interfaces y validadores requeridos
 * para la ingesta idempotente por lotes y verificación de cadena de custodia.
 */

export type UUID = string;

export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';
export type ShiftStatus = 'OPEN' | 'CLOSED' | 'ABORTED';
export type VisitStatus = 'VERIFIED' | 'OUT_OF_RANGE' | 'CANCELLED';

export type AuditEventType =
  | 'GPS_DISABLED'
  | 'SIGNAL_LOST'
  | 'MOCK_LOCATION_DETECTED'
  | 'SHIFT_OPENED'
  | 'SHIFT_CLOSED'
  | 'SERVICE_STARTED'
  | 'SERVICE_STOPPED'
  | 'BATTERY_LOW'
  | 'TIME_ANOMALY_DETECTED'
  | 'CAPTURA_GPS';

export type AuditEventSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

export interface SyncTrackingPoint {
  id: UUID;
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  speed_ms: number | null;
  altitude_meters: number | null;
  bearing_degrees: number | null;
  battery_level: number | null;
  is_mock: boolean;
  recorded_at: string;
  previous_hash: string;
  hmac_hash: string;
}

export interface AgreedPricesCommitments {
  agreed_discount_pct?: number;
  promised_delivery_date?: string;
  order_intent_units?: number;
  unit_price_pactado?: number;
  notes?: string;
  [key: string]: unknown;
}

export interface SyncVisitRecord {
  id: UUID;
  client_id: UUID;
  check_in_time: string;
  check_out_time: string | null;
  check_in_location: GeoCoordinate;
  check_out_location?: GeoCoordinate | null;
  observations?: string | null;
  agreed_prices_commitments?: AgreedPricesCommitments | null;
  hmac_hash: string;
}

export interface SyncSystemEvent {
  id?: UUID;
  event_type: AuditEventType;
  event_severity: AuditEventSeverity;
  occurred_at: string;
  metadata: Record<string, unknown>;
  location?: GeoCoordinate | null;
  previous_hash: string;
  hmac_hash: string;
}

export interface SyncBatchPayload {
  sync_batch_id: UUID;
  shift_id: UUID;
  organization_id: UUID;
  seller_id: UUID;
  batch_timestamp: string;
  tracking_points: SyncTrackingPoint[];
  visit_records: SyncVisitRecord[];
  system_events: SyncSystemEvent[];
}

export interface SyncBatchSummary {
  tracking_points_persisted: number;
  tracking_points_ignored_conflict: number;
  visit_records_persisted: number;
  audit_events_persisted: number;
}

export interface SyncChainState {
  last_verified_hash: string;
  chain_integrity_valid: boolean;
}

export interface VisitEvaluationResult {
  visit_id: UUID;
  evaluated_status: VisitStatus;
  distance_to_client_meters: number;
  tolerance_meters: number;
}

export interface SyncBatchResponse {
  status: 'SUCCESS';
  sync_batch_id: UUID;
  processed_at: string;
  summary: SyncBatchSummary;
  chain_state: SyncChainState;
  visits_evaluation: VisitEvaluationResult[];
}

export interface SyncBatchErrorResponse {
  status: 'ERROR';
  error_code:
    | 'INVALID_PAYLOAD'
    | 'HMAC_CHAIN_TAMPERED'
    | 'FUTURE_TIMESTAMP_REJECTED'
    | 'UNAUTHORIZED_ORGANIZATION'
    | 'SHIFT_NOT_FOUND'
    | 'INTERNAL_PERSISTENCE_ERROR';
  message: string;
  failed_entity_id?: UUID;
  timestamp: string;
}

export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
export const MAX_BATCH_TRACKING_POINTS = 500;
export const MAX_BATCH_VISITS = 100;
export const MAX_BATCH_EVENTS = 100;

/**
 * Validador básico sin dependencias para su uso directo en entornos Edge/Deno.
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof uuid === 'string' && uuidRegex.test(uuid);
}

export function isValidHmacHash(hash: string): boolean {
  const hmacRegex = /^[a-f0-9]{64}$/i;
  return typeof hash === 'string' && hmacRegex.test(hash);
}

export function isTimestampSkewAcceptable(isoString: string, maxSkewMs = MAX_CLOCK_SKEW_MS): boolean {
  const timeMs = new Date(isoString).getTime();
  if (isNaN(timeMs)) return false;
  const now = Date.now();
  return timeMs <= now + maxSkewMs;
}
