/**
 * ROUTRACK — Tipos y Modelos de Dominio para Auditoría de Visitas Comerciales
 * Archivo: web-admin/src/types/visit.ts
 *
 * Cumple con el esquema de la tabla `actividades_comerciales` de PostgreSQL / PostGIS
 * y los requerimientos de supervisión operativa de TASK-020.
 */

export type VisitStatus = "VERIFIED" | "OUT_OF_RANGE" | "CANCELLED";

export interface AgreementItem {
  id: string;
  product_name: string;
  quantity: number;
  agreed_unit_price: number;
  discount_percentage: number;
  subtotal: number;
}

export interface VisitAgreementsPayload {
  agreements: AgreementItem[];
  total_amount: number;
  total_items: number;
  promised_delivery_date?: string | null;
  stock_notes?: string | null;
}

export interface VisitRecord {
  id: string;
  organizacion_id: string;
  jornada_id: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_nombre_comercial?: string | null;
  cliente_identificacion: string;
  cliente_direccion: string;
  cliente_lat: number;
  cliente_lng: number;
  cliente_radio_tolerancia: number;
  vendedor_id: string;
  vendedor_nombre: string;
  hora_check_in: string; // ISO 8601
  hora_check_out: string | null; // ISO 8601
  check_in_lat: number;
  check_in_lng: number;
  check_out_lat: number | null;
  check_out_lng: number | null;
  distancia_cliente_metros: number;
  estado: VisitStatus;
  observaciones: string | null;
  precios_pactados_compromisos: VisitAgreementsPayload | null;
  hmac_hash: string;
  created_at: string;
}

export interface VisitFilters {
  vendedor_id: string; // 'ALL' o UUID
  estado: "ALL" | VisitStatus;
  search_query: string;
  fecha: string; // 'YYYY-MM-DD'
}

export interface VisitKpis {
  total_visitas: number;
  verificadas: number;
  fuera_de_rango: number;
  tasa_efectividad_pct: number;
  monto_total_pactado: number;
}

/**
 * Calcula la duración formateada de una visita en minutos y segundos.
 */
export function formatVisitDuration(checkInIso: string, checkOutIso: string | null): string {
  if (!checkOutIso) return "En progreso";
  const start = new Date(checkInIso).getTime();
  const end = new Date(checkOutIso).getTime();
  if (isNaN(start) || isNaN(end) || end < start) return "—";

  const diffSeconds = Math.floor((end - start) / 1000);
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;

  if (minutes > 0) {
    return `${minutes} min ${seconds} s`;
  }
  return `${seconds} s`;
}

/**
 * Formatea una hora en formato amigable HH:mm en zona horaria local.
 */
export function formatTimeDisplay(isoString: string | null): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("es-EC", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "—";
  }
}

