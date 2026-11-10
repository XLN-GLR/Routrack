/**
 * ROUTRACK — Modelo de Dominio y Tipos de Auditoría e Inmutabilidad (TASK-021)
 * Archivo: web-admin/src/types/audit.ts
 *
 * Define los contratos TypeScript estrictos para la bitácora inmutable de eventos
 * del sistema, severidades semánticas, cálculo de continuidad de custodia HMAC-SHA256
 * y métricas forenses según docs/SECURITY.md § 6 y docs/DESIGN.md § 2.
 */

export type AuditSeverity = "INFO" | "WARNING" | "CRITICAL";

export type AuditEventType =
  | "GPS_DISABLED"
  | "SIGNAL_LOST"
  | "MOCK_LOCATION_DETECTED"
  | "TIME_ANOMALY_DETECTED"
  | "SHIFT_OPENED"
  | "SHIFT_CLOSED"
  | "SYNC_BATCH_REJECTED"
  | "HMAC_CHAIN_TAMPERED"
  | string;

export interface AuditLogLocation {
  lat: number;
  lng: number;
}

export interface AuditLogRecord {
  id: string | number;
  organizacion_id: string;
  usuario_id: string | null;
  vendedor_nombre?: string;
  vendedor_email?: string;
  tipo_evento: AuditEventType;
  severidad: AuditSeverity;
  metadatos: Record<string, unknown>;
  ubicacion?: AuditLogLocation | null;
  hmac_hash: string;
  previous_hash: string;
  created_at: string;
  chain_link_status?: "VALID" | "BROKEN" | "SEED";
}

export interface AuditFilters {
  vendedorId: string;
  tipoEvento: string;
  severidad: string;
  fecha: string;
  busqueda: string;
}

export interface AuditIntegritySummary {
  totalEventos: number;
  eventosInfo: number;
  eventosWarning: number;
  eventosCritical: number;
  isChainIntact: boolean;
  discontinuitiesCount: number;
  brokenIndices: number[];
  brokenRecordIds: (string | number)[];
  lastVerifiedHash: string;
}

/**
 * Trunca una cadena de hash HMAC de 64 caracteres para visualización legible en tablas.
 */
export function truncateHash(hash: string, head = 8, tail = 6): string {
  if (!hash || hash.length <= head + tail) return hash || "—";
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

/**
 * Mapeo oficial de severidades a clases Tailwind y etiquetas legibles en español.
 */
export function formatSeverityBadge(severity: AuditSeverity): {
  label: string;
  badgeClass: string;
  dotClass: string;
  borderClass: string;
} {
  switch (severity) {
    case "CRITICAL":
      return {
        label: "Crítico",
        badgeClass: "bg-red-50 text-red-700 border-red-200",
        dotClass: "bg-red-600",
        borderClass: "border-l-4 border-red-600",
      };
    case "WARNING":
      return {
        label: "Advertencia",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
        dotClass: "bg-amber-500",
        borderClass: "border-l-4 border-amber-500",
      };
    case "INFO":
    default:
      return {
        label: "Informativo",
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
        dotClass: "bg-blue-600",
        borderClass: "border-l-4 border-blue-600",
      };
  }
}

/**
 * Traduce y contextualiza los tipos de evento técnicos del sistema a español formal.
 */
export function formatEventTypeLabel(eventType: string): {
  label: string;
  description: string;
  badgeClass: string;
} {
  switch (eventType) {
    case "MOCK_LOCATION_DETECTED":
      return {
        label: "Fake GPS Detectado",
        description: "Coordenada inyectada artificialmente por software de emulación",
        badgeClass: "bg-red-100 text-red-800 border-red-300",
      };
    case "GPS_DISABLED":
      return {
        label: "Sensor GPS Apagado",
        description: "El usuario desactivó el sensor de ubicación en el sistema operativo",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
      };
    case "SIGNAL_LOST":
      return {
        label: "Pérdida de Señal",
        description: "Interrupción de conectividad celular o fijación de satélites GPS",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
      };
    case "TIME_ANOMALY_DETECTED":
      return {
        label: "Anomalía de Reloj",
        description: "Desfase temporal superior a 60s respecto al reloj satelital/atómico",
        badgeClass: "bg-purple-100 text-purple-800 border-purple-300",
      };
    case "SHIFT_OPENED":
      return {
        label: "Turno Iniciado",
        description: "Inicio formal de jornada laboral con generación de semilla HMAC",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
      };
    case "SHIFT_CLOSED":
      return {
        label: "Turno Finalizado",
        description: "Cierre formal de jornada con firma criptográfica de resumen",
        badgeClass: "bg-slate-100 text-slate-800 border-slate-300",
      };
    case "SYNC_BATCH_REJECTED":
      return {
        label: "Lote Sincronización Rechazado",
        description: "Violación de contratos Zod o marcas temporales futuras",
        badgeClass: "bg-red-100 text-red-800 border-red-300",
      };
    case "HMAC_CHAIN_TAMPERED":
      return {
        label: "Cadena HMAC Adulterada",
        description: "Discontinuidad matemática detectada en la secuencia de custodia",
        badgeClass: "bg-red-100 text-red-800 border-red-300",
      };
    default:
      return {
        label: eventType.replace(/_/g, " "),
        description: "Evento del sistema registrado en bitácora",
        badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
      };
  }
}

/**
 * Formatea fechas ISO a formato local comprensible (ej. "09 Nov 2026, 14:32:05").
 */
export function formatAuditTimestamp(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return isoDate;
    return new Intl.DateTimeFormat("es-EC", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return isoDate;
  }
}

/**
 * Validador de continuidad de la cadena criptográfica HMAC (Hash Chaining).
 *
 * Examina una secuencia de eventos de auditoría y comprueba que para cada evento n >= 1
 * (ordenados cronológicamente por created_at), su previous_hash coincida de manera exacta
 * con el hmac_hash del evento anterior n - 1.
 */
export function verifyChainContinuity(records: AuditLogRecord[]): AuditIntegritySummary {
  if (!records || records.length === 0) {
    return {
      totalEventos: 0,
      eventosInfo: 0,
      eventosWarning: 0,
      eventosCritical: 0,
      isChainIntact: true,
      discontinuitiesCount: 0,
      brokenIndices: [],
      brokenRecordIds: [],
      lastVerifiedHash: "—",
    };
  }

  // Ordenar cronológicamente para evaluar la secuencia natural de emisión
  const chronological = [...records].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  let infoCount = 0;
  let warnCount = 0;
  let critCount = 0;
  const brokenIndices: number[] = [];
  const brokenRecordIds: (string | number)[] = [];

  for (let i = 0; i < chronological.length; i++) {
    const current = chronological[i];

    if (current.severidad === "CRITICAL") critCount++;
    else if (current.severidad === "WARNING") warnCount++;
    else infoCount++;

    if (i === 0) {
      current.chain_link_status = "SEED";
      continue;
    }

    const previous = chronological[i - 1];
    const prevClean = (current.previous_hash || "").trim().toLowerCase();
    const expectedClean = (previous.hmac_hash || "").trim().toLowerCase();

    // El enlace es válido si el previous_hash del evento actual coincide exactamente con el hmac_hash del anterior
    const isValidLink = prevClean === expectedClean && prevClean.length > 0;

    if (isValidLink) {
      current.chain_link_status = "VALID";
    } else {
      current.chain_link_status = "BROKEN";
      brokenIndices.push(i);
      brokenRecordIds.push(current.id);
    }
  }

  const isIntact = brokenIndices.length === 0;
  const lastRecord = chronological[chronological.length - 1];

  return {
    totalEventos: chronological.length,
    eventosInfo: infoCount,
    eventosWarning: warnCount,
    eventosCritical: critCount,
    isChainIntact: isIntact,
    discontinuitiesCount: brokenIndices.length,
    brokenIndices,
    brokenRecordIds,
    lastVerifiedHash: lastRecord ? lastRecord.hmac_hash : "—",
  };
}

