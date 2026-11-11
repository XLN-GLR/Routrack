/**
 * ROUTRACK — Tipos y Modelos de Dominio para el Dashboard de Supervisión (TASK-022)
 * Archivo: web-admin/src/types/dashboard.ts
 *
 * Contratos estrictos de TypeScript para las métricas operativas (KPIs),
 * totalizaciones de campo, resúmenes por asesor y series temporales para Recharts.
 */

export interface DashboardKpis {
  vendedoresActivos: number;
  vendedoresTotales: number;
  kilometrosTotales: number;
  visitasTotales: number;
  visitasVerificadas: number;
  visitasFueraRango: number;
  tasaEfectividad: number; // Porcentaje de visitas en geocerca (0 - 100)
  totalClientesAsignados: number;
  clientesVisitados: number;
  tasaCobertura: number; // Porcentaje de cobertura de clientes (0 - 100)
  montoTotalAcordado: number; // En USD
}

export interface SellerPerformanceMetric {
  vendedorId: string;
  nombre: string;
  kilometros: number;
  visitasVerificadas: number;
  visitasFueraRango: number;
  totalVisitas: number;
  tasaEfectividad: number;
  montoAcordado: number;
  estadoTurno: "EN_RUTA" | "DETENIDO" | "FINALIZADO" | "SIN_CONEXION";
}

export interface HourlyDistributionMetric {
  hora: string; // ej: "08:00", "09:00", etc.
  visitas: number;
  kilometros: number;
  verificadas: number;
}

export interface WeeklyTrendMetric {
  dia: string; // "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"
  fecha: string;
  verificadas: number;
  fueraRango: number;
  kilometros: number;
  coberturaPorcentaje: number;
}

/**
 * Calcula las totalizaciones de KPIs operativos a partir de arreglos de registros.
 */
export function calculateDashboardKpis(
  sellers: SellerPerformanceMetric[],
  totalClientesOrg: number
): DashboardKpis {
  if (!sellers || sellers.length === 0) {
    return {
      vendedoresActivos: 0,
      vendedoresTotales: 0,
      kilometrosTotales: 0,
      visitasTotales: 0,
      visitasVerificadas: 0,
      visitasFueraRango: 0,
      tasaEfectividad: 100,
      totalClientesAsignados: totalClientesOrg,
      clientesVisitados: 0,
      tasaCobertura: 0,
      montoTotalAcordado: 0,
    };
  }

  let totalKm = 0;
  let totalVerif = 0;
  let totalOutRange = 0;
  let totalMonto = 0;
  let activosCount = 0;

  for (const s of sellers) {
    totalKm += s.kilometros;
    totalVerif += s.visitasVerificadas;
    totalOutRange += s.visitasFueraRango;
    totalMonto += s.montoAcordado;
    if (s.estadoTurno === "EN_RUTA" || s.estadoTurno === "DETENIDO") {
      activosCount++;
    }
  }

  const totalVisitas = totalVerif + totalOutRange;
  const tasaEfectividad =
    totalVisitas > 0
      ? Math.round((totalVerif / totalVisitas) * 1000) / 10
      : 100;

  // Clientes visitados únicos estimados a partir de visitas verificadas
  const clientesVisitados = Math.min(totalVerif, totalClientesOrg);
  const tasaCobertura =
    totalClientesOrg > 0
      ? Math.min(100, Math.round((clientesVisitados / totalClientesOrg) * 1000) / 10)
      : 0;

  return {
    vendedoresActivos: activosCount,
    vendedoresTotales: sellers.length,
    kilometrosTotales: Math.round(totalKm * 10) / 10,
    visitasTotales: totalVisitas,
    visitasVerificadas: totalVerif,
    visitasFueraRango: totalOutRange,
    tasaEfectividad,
    totalClientesAsignados: totalClientesOrg,
    clientesVisitados,
    tasaCobertura,
    montoTotalAcordado: Math.round(totalMonto * 100) / 100,
  };
}
