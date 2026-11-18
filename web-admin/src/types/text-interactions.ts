/**
 * ROUTRACK — Definiciones de Tipos para Auditoría de Interacciones de Texto (TASK-031)
 * Archivo: web-admin/src/types/text-interactions.ts
 */

export interface TextInteractionRecord {
  id: string;
  organizacion_id: string;
  jornada_id: string;
  vendedor_id: string;
  vendedor_nombre?: string;
  vendedor_email?: string;
  paquete_aplicacion: string;
  nombre_aplicacion: string | null;
  texto_capturado: string;
  registrado_en: string; // ISO 8601 UTC
  previous_hash: string;
  hmac_hash: string;
  created_at?: string;
}

export interface TextInteractionFilterState {
  searchQuery: string;
  selectedPackage: string; // "ALL" o package name (ej. "com.whatsapp")
  startDate: string;
  endDate: string;
  selectedSellerId: string; // "ALL" o ID de vendedor
}

export interface TextInteractionSummary {
  totalInteractions: number;
  totalWhatsApp: number;
  totalMessaging: number;
  totalOther: number;
  uniqueSellersCount: number;
}

/**
 * Filtra interacciones de texto de acuerdo a los criterios seleccionados.
 */
export function filterTextInteractions(
  records: TextInteractionRecord[],
  filters: TextInteractionFilterState
): TextInteractionRecord[] {
  return records.filter((item) => {
    // 1. Filtro por búsqueda de texto comercial o nombre de app
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      const matchText = item.texto_capturado.toLowerCase().includes(q);
      const matchApp = (item.nombre_aplicacion || "").toLowerCase().includes(q);
      const matchPkg = item.paquete_aplicacion.toLowerCase().includes(q);
      const matchSeller = (item.vendedor_nombre || "").toLowerCase().includes(q);
      if (!matchText && !matchApp && !matchPkg && !matchSeller) {
        return false;
      }
    }

    // 2. Filtro por paquete / aplicación
    if (filters.selectedPackage !== "ALL") {
      if (item.paquete_aplicacion !== filters.selectedPackage) {
        return false;
      }
    }

    // 3. Filtro por vendedor
    if (filters.selectedSellerId !== "ALL") {
      if (item.vendedor_id !== filters.selectedSellerId) {
        return false;
      }
    }

    // 4. Filtro por rango de fecha
    if (filters.startDate) {
      const itemDate = item.registrado_en.substring(0, 10);
      if (itemDate < filters.startDate) return false;
    }
    if (filters.endDate) {
      const itemDate = item.registrado_en.substring(0, 10);
      if (itemDate > filters.endDate) return false;
    }

    return true;
  });
}

/**
 * Calcula métricas agregadas de interacciones de texto para tarjetas de resumen.
 */
export function calculateTextInteractionSummary(
  records: TextInteractionRecord[]
): TextInteractionSummary {
  let totalWhatsApp = 0;
  let totalMessaging = 0;
  let totalOther = 0;
  const uniqueSellers = new Set<string>();

  for (const r of records) {
    uniqueSellers.add(r.vendedor_id);
    const pkg = r.paquete_aplicacion.toLowerCase();
    if (pkg.includes("whatsapp")) {
      totalWhatsApp++;
    } else if (pkg.includes("messaging") || pkg.includes("mms") || pkg.includes("sms")) {
      totalMessaging++;
    } else {
      totalOther++;
    }
  }

  return {
    totalInteractions: records.length,
    totalWhatsApp,
    totalMessaging,
    totalOther,
    uniqueSellersCount: uniqueSellers.size,
  };
}

/**
 * Dataset demostrativo representativo para pruebas en panel web (Quito, Ecuador).
 */
export const DEMO_TEXT_INTERACTIONS: TextInteractionRecord[] = [
  {
    id: "ti-001",
    organizacion_id: "org-001",
    jornada_id: "sh-9801",
    vendedor_id: "vendedor-001",
    vendedor_nombre: "Carlos Mendoza",
    vendedor_email: "carlos.mendoza@routrack.ec",
    paquete_aplicacion: "com.whatsapp",
    nombre_aplicacion: "WhatsApp",
    texto_capturado: "Confirmado descuento del 12% por volumen en cajas de aceite Los Andes.",
    registrado_en: "2026-11-10T09:15:30.000Z",
    previous_hash: "ROUTRACK-SHIFT-INIT|sh-9801",
    hmac_hash: "3a9c7b12d5e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6",
  },
  {
    id: "ti-002",
    organizacion_id: "org-001",
    jornada_id: "sh-9801",
    vendedor_id: "vendedor-001",
    vendedor_nombre: "Carlos Mendoza",
    vendedor_email: "carlos.mendoza@routrack.ec",
    paquete_aplicacion: "com.whatsapp",
    nombre_aplicacion: "WhatsApp",
    texto_capturado: "La entrega se realizará mañana antes de las 11:00 AM en bodega central.",
    registrado_en: "2026-11-10T10:45:10.000Z",
    previous_hash: "3a9c7b12d5e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6",
    hmac_hash: "7f1b3d5e9a2c4e6f8b0d2a4c6e8f0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e",
  },
  {
    id: "ti-003",
    organizacion_id: "org-001",
    jornada_id: "sh-9802",
    vendedor_id: "vendedor-002",
    vendedor_nombre: "Diana Paredes",
    vendedor_email: "diana.paredes@routrack.ec",
    paquete_aplicacion: "com.google.android.apps.messaging",
    nombre_aplicacion: "Mensajes Google",
    texto_capturado: "Precio unitario pactado $14.50 incluido IVA para Minimarket El Trébol.",
    registrado_en: "2026-11-10T11:30:00.000Z",
    previous_hash: "ROUTRACK-SHIFT-INIT|sh-9802",
    hmac_hash: "5e8a2b4c6d0f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1b",
  },
  {
    id: "ti-004",
    organizacion_id: "org-001",
    jornada_id: "sh-9802",
    vendedor_id: "vendedor-002",
    vendedor_nombre: "Diana Paredes",
    vendedor_email: "diana.paredes@routrack.ec",
    paquete_aplicacion: "com.whatsapp",
    nombre_aplicacion: "WhatsApp",
    texto_capturado: "Plazo de crédito acordado: 15 días previa recepción de factura electrónica.",
    registrado_en: "2026-11-10T14:10:45.000Z",
    previous_hash: "5e8a2b4c6d0f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1b",
    hmac_hash: "9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1b3d5f7a9c1e3b5d7f9a1b3d5f7a9c1e",
  },
  {
    id: "ti-005",
    organizacion_id: "org-001",
    jornada_id: "sh-9803",
    vendedor_id: "vendedor-003",
    vendedor_nombre: "Jorge Alarcón",
    vendedor_email: "jorge.alarcon@routrack.ec",
    paquete_aplicacion: "com.whatsapp",
    nombre_aplicacion: "WhatsApp",
    texto_capturado: "Cliente solicita reposición de 5 unidades sin costo por daño en transporte.",
    registrado_en: "2026-11-10T16:05:22.000Z",
    previous_hash: "ROUTRACK-SHIFT-INIT|sh-9803",
    hmac_hash: "2c4e6f8a0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6f8a0b2d4f6a8c0e2b4d",
  },
];
