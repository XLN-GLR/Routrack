/**
 * ROUTRACK — Tipos e Interfaces para el Monitoreo en Vivo de Vendedores
 * Archivo: web-admin/src/types/seller.ts
 */

/**
 * Los 5 estados operativos oficiales definidos en docs/DESIGN.md § 2.2
 */
export type SellerOperationalStatus =
  | "EN_RUTA"
  | "DETENIDO"
  | "VISITA_VALIDADA"
  | "DESVIACION"
  | "SIN_CONEXION";

/**
 * Datos consolidados de telemetría y estado operativo de un vendedor en campo.
 */
export interface SellerLiveState {
  sellerId: string;
  sellerName: string;
  email: string;
  phone?: string;
  shiftId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  speedKmh: number;
  bearingDegrees: number; // 0 - 360 grados de orientación espacial
  batteryLevel: number; // 0 - 100 %
  isMock: boolean; // Detección de Fake GPS / Mock Location
  status: SellerOperationalStatus;
  lastReportTime: string; // ISO 8601
  currentClientName?: string; // Nombre del cliente si está en visita
  deviationReason?: string; // Motivo si está en estado de desviación
}

/**
 * Configuración visual y semántica para cada estado operativo según docs/DESIGN.md.
 */
export interface OperationalStatusConfig {
  label: string;
  colorHex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotColorClass: string;
  description: string;
}

export const OPERATIONAL_STATUS_CONFIGS: Record<SellerOperationalStatus, OperationalStatusConfig> = {
  EN_RUTA: {
    label: "En Ruta",
    colorHex: "#2563EB",
    bgClass: "bg-blue-600",
    textClass: "text-blue-700",
    borderClass: "border-blue-300",
    dotColorClass: "bg-blue-600",
    description: "Vendedor en tránsito vehicular o pedestre con velocidad > 5 km/h",
  },
  DETENIDO: {
    label: "Detenido",
    colorHex: "#D97706",
    bgClass: "bg-amber-600",
    textClass: "text-amber-700",
    borderClass: "border-amber-300",
    dotColorClass: "bg-amber-600",
    description: "Vendedor en jornada pero detenido (> 3 min sin visita activa)",
  },
  VISITA_VALIDADA: {
    label: "Visita Validada",
    colorHex: "#059669",
    bgClass: "bg-emerald-600",
    textClass: "text-emerald-700",
    borderClass: "border-emerald-300",
    dotColorClass: "bg-emerald-600",
    description: "Check-in activo dentro de la geocerca del cliente (radio <= 50m)",
  },
  DESVIACION: {
    label: "Desviación Detectada",
    colorHex: "#DC2626",
    bgClass: "bg-red-600",
    textClass: "text-red-700",
    borderClass: "border-red-300",
    dotColorClass: "bg-red-600",
    description: "Vendedor apartado de la ruta (> 300m) o con Fake GPS activo",
  },
  SIN_CONEXION: {
    label: "Sin Conexión",
    colorHex: "#64748B",
    bgClass: "bg-slate-500",
    textClass: "text-slate-700",
    borderClass: "border-slate-300",
    dotColorClass: "bg-slate-500",
    description: "Más de 15 minutos sin reporte de telemetría GPS o sin señal celular",
  },
};

/**
 * Datos iniciales fehacientes de vendedores en campo en la zona de Quito, Ecuador (WGS 84).
 * Abarca los 5 estados operativos estipulados en docs/DESIGN.md.
 */
export const INITIAL_LIVE_SELLERS: SellerLiveState[] = [
  {
    sellerId: "vendedor-001-carlos",
    sellerName: "Carlos Mendoza",
    email: "carlos.mendoza@routrack.ec",
    phone: "+593 99 123 4567",
    shiftId: "shift-uuid-001",
    latitude: -0.1785,
    longitude: -78.482,
    accuracyMeters: 6.2,
    speedKmh: 32.5,
    bearingDegrees: 45, // Noreste hacia Av. Naciones Unidas
    batteryLevel: 84,
    isMock: false,
    status: "EN_RUTA",
    lastReportTime: new Date(Date.now() - 45 * 1000).toISOString(),
  },
  {
    sellerId: "vendedor-002-diana",
    sellerName: "Diana Paredes",
    email: "diana.paredes@routrack.ec",
    phone: "+593 98 765 4321",
    shiftId: "shift-uuid-002",
    latitude: -0.1942,
    longitude: -78.4951,
    accuracyMeters: 4.8,
    speedKmh: 0.0,
    bearingDegrees: 180,
    batteryLevel: 68,
    isMock: false,
    status: "DETENIDO",
    lastReportTime: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
  },
  {
    sellerId: "vendedor-003-jorge",
    sellerName: "Jorge Alarcón",
    email: "jorge.alarcon@routrack.ec",
    phone: "+593 99 888 7777",
    shiftId: "shift-uuid-003",
    latitude: -0.1865,
    longitude: -78.4712,
    accuracyMeters: 3.5,
    speedKmh: 0.0,
    bearingDegrees: 90,
    batteryLevel: 92,
    isMock: false,
    status: "VISITA_VALIDADA",
    lastReportTime: new Date(Date.now() - 90 * 1000).toISOString(),
    currentClientName: "Supermercado Santa María (Plaza Foch)",
  },
  {
    sellerId: "vendedor-004-luis",
    sellerName: "Luis Morales",
    email: "luis.morales@routrack.ec",
    phone: "+593 97 111 2233",
    shiftId: "shift-uuid-004",
    latitude: -0.2115,
    longitude: -78.5132,
    accuracyMeters: 14.0,
    speedKmh: 48.0,
    bearingDegrees: 270,
    batteryLevel: 41,
    isMock: true, // Mock Location detectado
    status: "DESVIACION",
    lastReportTime: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    deviationReason: "Fake GPS detectado / Desvío > 450m del corredor asignado",
  },
  {
    sellerId: "vendedor-005-sofia",
    sellerName: "Sofía Benítez",
    email: "sofia.benitez@routrack.ec",
    phone: "+593 96 333 4455",
    shiftId: "shift-uuid-005",
    latitude: -0.1625,
    longitude: -78.468,
    accuracyMeters: 25.0,
    speedKmh: 0.0,
    bearingDegrees: 0,
    batteryLevel: 12,
    isMock: false,
    status: "SIN_CONEXION",
    lastReportTime: new Date(Date.now() - 26 * 60 * 1000).toISOString(),
  },
];
