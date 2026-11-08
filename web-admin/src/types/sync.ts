/**
 * ROUTRACK — Contratos y Tipos de Sincronización Offline-First
 * Archivo: web-admin/src/types/sync.ts
 *
 * Define los tipos TypeScript estrictos para el intercambio de lotes (batching)
 * entre el cliente Android y el backend Supabase (Edge Functions / PostgreSQL).
 */

export type UUID = string;

/**
 * Estados de sincronización local y remota.
 */
export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';

/**
 * Estados formales de una jornada laboral.
 */
export type ShiftStatus = 'OPEN' | 'CLOSED' | 'ABORTED';

/**
 * Estados de evaluación geoespacial de una visita comercial.
 */
export type VisitStatus = 'VERIFIED' | 'OUT_OF_RANGE' | 'CANCELLED';

/**
 * Tipología de eventos de auditoría y anomalías de seguridad en campo.
 */
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

/**
 * Severidad del evento de auditoría.
 */
export type AuditEventSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

/**
 * Coordenada geográfica simple.
 */
export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

/**
 * Punto de telemetría GPS capturado en campo con firma de integridad HMAC-SHA256.
 */
export interface SyncTrackingPoint {
  /** Identificador único UUID v4 generado en el cliente móvil */
  id: UUID;
  /** Latitud en grados decimales WGS84 (-90.0 a 90.0) */
  latitude: number;
  /** Longitud en grados decimales WGS84 (-180.0 a 180.0) */
  longitude: number;
  /** Precisión horizontal estimada del sensor en metros */
  accuracy_meters: number;
  /** Velocidad de desplazamiento instantánea en metros por segundo */
  speed_ms: number | null;
  /** Altitud sobre el nivel del mar en metros */
  altitude_meters: number | null;
  /** Rumbo u orientación en grados (0.0 a 360.0) */
  bearing_degrees: number | null;
  /** Nivel de batería del dispositivo (0 a 100) */
  battery_level: number | null;
  /** Indicador de si la coordenada proviene de un proveedor simulado (Fake GPS) */
  is_mock: boolean;
  /** Marca de tiempo UTC de captura en formato ISO 8601 */
  recorded_at: string;
  /** Hash HMAC-SHA256 del registro cronológico inmediatamente anterior */
  previous_hash: string;
  /** Hash HMAC-SHA256 encadenado de este registro */
  hmac_hash: string;
}

/**
 * Estructura de compromisos comerciales y acuerdos de precios pactados con el cliente.
 */
export interface AgreedPricesCommitments {
  agreed_discount_pct?: number;
  promised_delivery_date?: string;
  order_intent_units?: number;
  unit_price_pactado?: number;
  notes?: string;
  [key: string]: unknown;
}

/**
 * Registro de visita comercial presencial con check-in y geocerca.
 */
export interface SyncVisitRecord {
  /** Identificador único UUID v4 generado en el dispositivo móvil */
  id: UUID;
  /** Identificador del cliente visitado */
  client_id: UUID;
  /** Hora de inicio de visita en formato ISO 8601 UTC */
  check_in_time: string;
  /** Hora de egreso o cierre de visita en formato ISO 8601 UTC */
  check_out_time: string | null;
  /** Coordenada física capturada en el momento del check-in */
  check_in_location: GeoCoordinate;
  /** Coordenada física capturada en el momento del check-out */
  check_out_location?: GeoCoordinate | null;
  /** Observaciones cualitativas de la visita */
  observations?: string | null;
  /** Acuerdos comerciales estructurados */
  agreed_prices_commitments?: AgreedPricesCommitments | null;
  /** Firma HMAC del registro de visita */
  hmac_hash: string;
}

/**
 * Evento del sistema para la bitácora inmutable de auditoría forense.
 */
export interface SyncSystemEvent {
  /** Identificador único UUID v4 opcional generado en cliente */
  id?: UUID;
  /** Tipo normalizado de evento */
  event_type: AuditEventType;
  /** Severidad semántica */
  event_severity: AuditEventSeverity;
  /** Timestamp UTC del evento en formato ISO 8601 */
  occurred_at: string;
  /** Metadatos estructurados del incidente */
  metadata: Record<string, unknown>;
  /** Ubicación geográfica asociada al evento si estuvo disponible */
  location?: GeoCoordinate | null;
  /** Hash HMAC previo en la cadena */
  previous_hash: string;
  /** Hash HMAC actual */
  hmac_hash: string;
}

/**
 * Paquete de sincronización por lotes (Batch Payload) transmitido vía HTTPS TLS 1.3
 * desde el cliente móvil hacia la Edge Function de Supabase.
 */
export interface SyncBatchPayload {
  /** Identificador único del lote de sincronización para control de idempotencia */
  sync_batch_id: UUID;
  /** Identificador de la jornada laboral a la que pertenecen los datos */
  shift_id: UUID;
  /** Identificador de la organización (inquilino multi-tenant) */
  organization_id: UUID;
  /** Identificador del perfil del vendedor que recolectó los datos */
  seller_id: UUID;
  /** Timestamp de emisión del lote en formato ISO 8601 UTC */
  batch_timestamp: string;
  /** Lista de puntos de telemetría GPS (máximo 100 por lote recomendado) */
  tracking_points: SyncTrackingPoint[];
  /** Lista de visitas comerciales registradas durante el intervalo */
  visit_records: SyncVisitRecord[];
  /** Lista de eventos de auditoría y anomalías operativas */
  system_events: SyncSystemEvent[];
}

/**
 * Resumen de persistencia retornado por la Edge Function.
 */
export interface SyncBatchSummary {
  tracking_points_persisted: number;
  tracking_points_ignored_conflict: number;
  visit_records_persisted: number;
  audit_events_persisted: number;
}

/**
 * Estado de validación de la cadena criptográfica retornado al cliente.
 */
export interface SyncChainState {
  last_verified_hash: string;
  chain_integrity_valid: boolean;
}

/**
 * Evaluación de geocerca de visitas calculada en backend mediante PostGIS ST_DWithin.
 */
export interface VisitEvaluationResult {
  visit_id: UUID;
  evaluated_status: VisitStatus;
  distance_to_client_meters: number;
  tolerance_meters: number;
}

/**
 * Respuesta exitosa (HTTP 200) tras el procesamiento idempotente del lote.
 */
export interface SyncBatchResponse {
  status: 'SUCCESS';
  sync_batch_id: UUID;
  processed_at: string;
  summary: SyncBatchSummary;
  chain_state: SyncChainState;
  visits_evaluation: VisitEvaluationResult[];
}

/**
 * Respuesta de error de validación o adulteración criptográfica (HTTP 400 / 422).
 */
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
