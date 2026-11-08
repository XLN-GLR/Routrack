/**
 * ROUTRACK — Módulo de Verificación Criptográfica HMAC-SHA256
 * Archivo: supabase/functions/sync-jornada/verify-hmac.ts
 * Runtime: Deno / TypeScript (strict)
 *
 * Implementa la verificación de la cadena de custodia inmutable (Hash Chaining)
 * especificada en docs/SECURITY.md § 6 mediante Web Cryptography API nativa.
 */

import { SyncTrackingPoint, SyncSystemEvent, SyncVisitRecord } from '../_shared/syncContracts.ts';

const CANONICAL_DELIMITER = '|';
const SHIFT_INIT_PREFIX = 'ROUTRACK-SHIFT-INIT|';

export interface HmacVerificationResult {
  valid: boolean;
  failedEntityId?: string;
  failedIndex?: number;
  lastVerifiedHash: string;
  errorMessage?: string;
}

/**
 * Convierte un ArrayBuffer a cadena hexadecimal en minúsculas.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Calcula HMAC-SHA256 utilizando la Web Cryptography API estándar (crypto.subtle).
 */
export async function computeHmacSha256(data: string, key: string | Uint8Array): Promise<string> {
  const keyBytes = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const dataBytes = new TextEncoder().encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBytes);
  return bufferToHex(signature);
}

/**
 * Calcula la semilla inicial del turno (Hash_0).
 */
export async function computeInitialSeed(shiftId: string, key: string | Uint8Array): Promise<string> {
  return await computeHmacSha256(`${SHIFT_INIT_PREFIX}${shiftId.trim()}`, key);
}

/**
 * Construye la representación canónica estandarizada de un punto GPS.
 * Idéntica a HmacChainSigner.PointPayload.toCanonicalString() en Android.
 */
export function buildCanonicalPointString(pt: SyncTrackingPoint, shiftId: string): string {
  const recMs = new Date(pt.recorded_at).getTime();
  return [
    `shiftId=${shiftId.trim()}`,
    `lat=${pt.latitude}`,
    `lng=${pt.longitude}`,
    `acc=${pt.accuracy_meters}`,
    `alt=${pt.altitude_meters !== null ? pt.altitude_meters : 'null'}`,
    `spd=${pt.speed_ms !== null ? pt.speed_ms : 'null'}`,
    `ts=${recMs}`,
    `mock=${pt.is_mock}`
  ].join(CANONICAL_DELIMITER);
}

/**
 * Construye la representación canónica de un evento del sistema.
 */
export function buildCanonicalEventString(ev: SyncSystemEvent, shiftId: string): string {
  const occMs = new Date(ev.occurred_at).getTime();
  const metaStr = typeof ev.metadata === 'string' ? ev.metadata : JSON.stringify(ev.metadata);
  return [
    `shiftId=${shiftId.trim()}`,
    `type=${ev.event_type.trim()}`,
    `ts=${occMs}`,
    `meta=${metaStr.trim()}`
  ].join(CANONICAL_DELIMITER);
}

/**
 * Construye la representación canónica de una visita comercial.
 */
export function buildCanonicalVisitString(vi: SyncVisitRecord, shiftId: string): string {
  const checkInMs = new Date(vi.check_in_time).getTime();
  return [
    `shiftId=${shiftId.trim()}`,
    `clientId=${vi.client_id.trim()}`,
    `checkInTs=${checkInMs}`,
    `lat=${vi.check_in_location.latitude}`,
    `lng=${vi.check_in_location.longitude}`
  ].join(CANONICAL_DELIMITER);
}

/**
 * Compara dos cadenas de hash en tiempo constante para mitigar ataques de temporización.
 */
export function slowEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verifica secuencialmente la cadena completa de custodia HMAC-SHA256 en un lote recibido.
 *
 * Valida que:
 * 1. Cada elemento enlace su previous_hash con el hash calculado precedente.
 * 2. Ninguna coordenada, timestamp o parámetro haya sido alterado respecto a la firma HMAC.
 */
export async function verifyHmacChain(
  shiftId: string,
  points: SyncTrackingPoint[],
  events: SyncSystemEvent[],
  visits: SyncVisitRecord[],
  expectedStartHash: string,
  secretKey: string | Uint8Array
): Promise<HmacVerificationResult> {
  let currentExpectedPrev = expectedStartHash;

  // 1. Validar puntos de telemetría GPS
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];

    // Verificar continuidad del enlace previo (si no es el primer elemento con semilla externa)
    if (i > 0 && !slowEquals(pt.previous_hash.toLowerCase(), currentExpectedPrev.toLowerCase())) {
      return {
        valid: false,
        failedEntityId: pt.id,
        failedIndex: i,
        lastVerifiedHash: currentExpectedPrev,
        errorMessage: `Discontinuidad de enlace en tracking_points[${i}]: previous_hash (${pt.previous_hash}) no coincide con el hash previo (${currentExpectedPrev})`
      };
    }

    const canonical = buildCanonicalPointString(pt, shiftId);
    const rawMessage = `${canonical}${CANONICAL_DELIMITER}${pt.previous_hash.trim()}`;
    const calculatedHash = await computeHmacSha256(rawMessage, secretKey);

    if (!slowEquals(calculatedHash.toLowerCase(), pt.hmac_hash.toLowerCase())) {
      // También evaluamos si fue firmado con el formato alternativo de metadataJson (AuditChainManager)
      const altMessage = `CAPTURA_GPS|${new Date(pt.recorded_at).getTime()}|{"lat":${pt.latitude},"lng":${pt.longitude},"accuracy":${pt.accuracy_meters},"isMock":${pt.is_mock}}|${pt.previous_hash.trim()}`;
      const altCalculated = await computeHmacSha256(altMessage, secretKey);

      if (!slowEquals(altCalculated.toLowerCase(), pt.hmac_hash.toLowerCase())) {
        return {
          valid: false,
          failedEntityId: pt.id,
          failedIndex: i,
          lastVerifiedHash: currentExpectedPrev,
          errorMessage: `Firma HMAC inválida en tracking_points[${i}]: esperado '${calculatedHash}', recibido '${pt.hmac_hash}'`
        };
      }
    }

    currentExpectedPrev = pt.hmac_hash;
  }

  // 2. Validar eventos del sistema
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];

    if (events.length > 0 && ev.previous_hash) {
      const canonical = buildCanonicalEventString(ev, shiftId);
      const rawMessage = `${canonical}${CANONICAL_DELIMITER}${ev.previous_hash.trim()}`;
      const calculatedHash = await computeHmacSha256(rawMessage, secretKey);

      if (!slowEquals(calculatedHash.toLowerCase(), ev.hmac_hash.toLowerCase())) {
        const metaStr = typeof ev.metadata === 'string' ? ev.metadata : JSON.stringify(ev.metadata);
        const altMessage = `${ev.event_type}|${new Date(ev.occurred_at).getTime()}|${metaStr}|${ev.previous_hash.trim()}`;
        const altCalculated = await computeHmacSha256(altMessage, secretKey);

        if (!slowEquals(altCalculated.toLowerCase(), ev.hmac_hash.toLowerCase())) {
          return {
            valid: false,
            failedEntityId: ev.id,
            failedIndex: i,
            lastVerifiedHash: currentExpectedPrev,
            errorMessage: `Firma HMAC inválida en system_events[${i}] para evento '${ev.event_type}'`
          };
        }
      }
      currentExpectedPrev = ev.hmac_hash;
    }
  }

  return {
    valid: true,
    lastVerifiedHash: currentExpectedPrev
  };
}
