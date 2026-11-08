/**
 * ROUTRACK — Esquemas de Validación Zod para Sincronización Offline-First
 * Archivo: web-admin/src/lib/validation/syncSchemas.ts
 *
 * Implementa la validación estricta de doble capa para la ingesta de telemetría,
 * visitas y auditoría, previniendo coordenadas espurias y desajustes temporales.
 */

import { z } from 'zod';
import type { SyncBatchPayload } from '@/types/sync';

/**
 * Margen de tolerancia de desfase de reloj permitido (5 minutos en milisegundos).
 * Conforme a los requerimientos de seguridad, cualquier timestamp con más de
 * 5 minutos en el futuro respecto al servidor es rechazado como anomalía.
 */
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * Fecha mínima histórica aceptable para el sistema (1 de enero de 2024 UTC).
 */
export const MIN_HISTORICAL_TIMESTAMP_MS = new Date('2024-01-01T00:00:00.000Z').getTime();

/**
 * Validador temporal estricto: Formato ISO 8601, sin fechas anteriores a 2024
 * ni timestamps futuros con más de 5 minutos de adelanto respecto al servidor.
 */
export const strictIsoTimestampSchema = z
  .string({
    message: 'La marca de tiempo debe ser una cadena de texto en formato ISO 8601',
  })
  .datetime({ message: 'El formato de fecha/hora debe ser ISO 8601 UTC válido' })
  .refine(
    (isoString) => {
      const timestampMs = new Date(isoString).getTime();
      return !isNaN(timestampMs) && timestampMs >= MIN_HISTORICAL_TIMESTAMP_MS;
    },
    {
      message: 'La marca de tiempo es anterior a la fecha mínima permitida (2024-01-01)',
    }
  )
  .refine(
    (isoString) => {
      const timestampMs = new Date(isoString).getTime();
      const serverNow = Date.now();
      return timestampMs <= serverNow + MAX_CLOCK_SKEW_MS;
    },
    {
      message:
        'La marca de tiempo excede el umbral de tolerancia futura permitido (máximo 5 minutos de desvío)',
    }
  );

/**
 * Validador de firma criptográfica HMAC-SHA256 (64 caracteres hexadecimales).
 */
export const hmacHashSchema = z
  .string({
    message: 'El hash criptográfico HMAC es obligatorio',
  })
  .regex(/^[a-f0-9]{64}$/i, {
    message: 'El hash HMAC debe ser una cadena hexadecimal válida de 64 caracteres (SHA-256)',
  });

/**
 * Esquema de Coordenada Geográfica WGS84.
 */
export const geoCoordinateSchema = z.object({
  latitude: z
    .number({
      message: 'La latitud es obligatoria y debe ser numérica',
    })
    .min(-90.0, { message: 'La latitud no puede ser menor a -90.0 grados' })
    .max(90.0, { message: 'La latitud no puede ser mayor a 90.0 grados' }),
  longitude: z
    .number({
      message: 'La longitud es obligatoria y debe ser numérica',
    })
    .min(-180.0, { message: 'La longitud no puede ser menor a -180.0 grados' })
    .max(180.0, { message: 'La longitud no puede ser mayor a 180.0 grados' }),
});

/**
 * Esquema para Punto de Telemetría GPS (`SyncTrackingPoint`).
 */
export const syncTrackingPointSchema = z.object({
  id: z.string().uuid({ message: 'El identificador del punto debe ser un UUID v4 válido' }),
  latitude: z
    .number()
    .min(-90.0, { message: 'Latitud inválida (rango: -90 a 90)' })
    .max(90.0, { message: 'Latitud inválida (rango: -90 a 90)' }),
  longitude: z
    .number()
    .min(-180.0, { message: 'Longitud inválida (rango: -180 a 180)' })
    .max(180.0, { message: 'Longitud inválida (rango: -180 a 180)' }),
  accuracy_meters: z
    .number()
    .min(0, { message: 'La precisión horizontal en metros no puede ser negativa' })
    .max(5000, { message: 'Precisión espuria excesiva (mayor a 5000 metros)' }),
  speed_ms: z
    .number()
    .min(0, { message: 'La velocidad en m/s no puede ser negativa' })
    .max(150, { message: 'Velocidad no plausible para vehículo terrestre (> 150 m/s)' })
    .nullable()
    .optional(),
  altitude_meters: z
    .number()
    .min(-500, { message: 'Altitud por debajo del límite terrestre razonable' })
    .max(9000, { message: 'Altitud por encima del monte Everest' })
    .nullable()
    .optional(),
  bearing_degrees: z
    .number()
    .min(0.0, { message: 'El rumbo debe ser >= 0.0 grados' })
    .max(360.0, { message: 'El rumbo debe ser <= 360.0 grados' })
    .nullable()
    .optional(),
  battery_level: z
    .number()
    .int({ message: 'El nivel de batería debe ser un número entero' })
    .min(0, { message: 'El nivel de batería debe ser >= 0%' })
    .max(100, { message: 'El nivel de batería debe ser <= 100%' })
    .nullable()
    .optional(),
  is_mock: z.boolean({
    message: 'La bandera de detección de simulación (is_mock) es requerida',
  }),
  recorded_at: strictIsoTimestampSchema,
  previous_hash: hmacHashSchema,
  hmac_hash: hmacHashSchema,
});

/**
 * Esquema para Registro de Visita Comercial (`SyncVisitRecord`).
 */
export const syncVisitRecordSchema = z.object({
  id: z.string().uuid({ message: 'El ID de la visita debe ser un UUID v4 válido' }),
  client_id: z.string().uuid({ message: 'El ID del cliente debe ser un UUID v4 válido' }),
  check_in_time: strictIsoTimestampSchema,
  check_out_time: strictIsoTimestampSchema.nullable().optional(),
  check_in_location: geoCoordinateSchema,
  check_out_location: geoCoordinateSchema.nullable().optional(),
  observations: z
    .string()
    .max(2000, { message: 'Las observaciones no pueden exceder 2000 caracteres' })
    .nullable()
    .optional(),
  agreed_prices_commitments: z.record(z.string(), z.unknown()).nullable().optional(),
  hmac_hash: hmacHashSchema,
});

/**
 * Lista de tipos permitidos para eventos de auditoría.
 */
export const auditEventTypes = [
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
] as const;

/**
 * Lista de severidades permitidas para eventos de auditoría.
 */
export const auditSeverities = ['INFO', 'WARNING', 'CRITICAL'] as const;

/**
 * Esquema para Evento de Auditoría Forense (`SyncSystemEvent`).
 */
export const syncSystemEventSchema = z.object({
  id: z.string().uuid({ message: 'El ID del evento debe ser un UUID válido' }).optional(),
  event_type: z.enum(auditEventTypes, {
    message: 'Tipo de evento de auditoría no reconocido en el sistema',
  }),
  event_severity: z.enum(auditSeverities, {
    message: 'Severidad inválida (debe ser INFO, WARNING o CRITICAL)',
  }),
  occurred_at: strictIsoTimestampSchema,
  metadata: z.record(z.string(), z.unknown(), {
    message: 'Los metadatos del evento deben ser un objeto JSON válido',
  }),
  location: geoCoordinateSchema.nullable().optional(),
  previous_hash: hmacHashSchema,
  hmac_hash: hmacHashSchema,
});

/**
 * Esquema Principal del Lote de Sincronización (`SyncBatchPayloadSchema`).
 */
export const syncBatchPayloadSchema = z.object({
  sync_batch_id: z.string().uuid({
    message: 'El identificador sync_batch_id debe ser un UUID v4 válido para idempotencia',
  }),
  shift_id: z.string().uuid({
    message: 'El shift_id debe ser un UUID v4 válido',
  }),
  organization_id: z.string().uuid({
    message: 'El organization_id debe ser un UUID v4 válido',
  }),
  seller_id: z.string().uuid({
    message: 'El seller_id debe ser un UUID v4 válido',
  }),
  batch_timestamp: strictIsoTimestampSchema,
  tracking_points: z
    .array(syncTrackingPointSchema)
    .max(500, { message: 'El lote excede el tamaño máximo permitido de 500 puntos GPS' }),
  visit_records: z
    .array(syncVisitRecordSchema)
    .max(100, { message: 'El lote excede el máximo de 100 visitas comerciales simultáneas' }),
  system_events: z
    .array(syncSystemEventSchema)
    .max(100, { message: 'El lote excede el máximo de 100 eventos de sistema por transmisión' }),
});

export type ValidatedSyncBatchPayload = z.infer<typeof syncBatchPayloadSchema>;

/**
 * Función de validación segura para la ingesta de datos.
 * Retorna un resultado tipado sin arrojar excepciones no controladas.
 */
export function validateSyncBatchPayload(data: unknown):
  | { success: true; data: SyncBatchPayload }
  | { success: false; error: string; issues: z.ZodIssue[] } {
  const result = syncBatchPayloadSchema.safeParse(data);

  if (!result.success) {
    const primerError = result.error.issues[0]?.message || 'Payload de sincronización no válido';
    return {
      success: false,
      error: primerError,
      issues: result.error.issues,
    };
  }

  return {
    success: true,
    data: result.data as SyncBatchPayload,
  };
}
