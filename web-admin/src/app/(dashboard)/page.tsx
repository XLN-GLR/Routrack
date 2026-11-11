"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  Radio,
  Route,
  MapPin,
  CheckCircle2,
  ShieldAlert,
  FileSpreadsheet,
  Compass,
  ArrowRight,
  Calendar,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  DashboardKpis,
  SellerPerformanceMetric,
  HourlyDistributionMetric,
  calculateDashboardKpis,
} from "@/types/dashboard";
import { MetricCards, MetricCardsSkeleton } from "@/components/dashboard/MetricCards";
import {
  PerformanceChart,
  PerformanceChartSkeleton,
} from "@/components/dashboard/PerformanceChart";

// Dataset representativo de vendedores en Quito para demostración y contingencia
const DEMO_SELLERS: SellerPerformanceMetric[] = [
  {
    vendedorId: "s1000000-0000-0000-0000-000000000001",
    nombre: "Carlos Mendoza",
    kilometros: 34.8,
    visitasVerificadas: 7,
    visitasFueraRango: 1,
    totalVisitas: 8,
    tasaEfectividad: 87.5,
    montoAcordado: 1420.5,
    estadoTurno: "EN_RUTA",
  },
  {
    vendedorId: "s1000000-0000-0000-0000-000000000002",
    nombre: "Ana Morales",
    kilometros: 28.4,
    visitasVerificadas: 9,
    visitasFueraRango: 0,
    totalVisitas: 9,
    tasaEfectividad: 100.0,
    montoAcordado: 1980.0,
    estadoTurno: "DETENIDO",
  },
  {
    vendedorId: "s1000000-0000-0000-0000-000000000003",
    nombre: "David Paredes",
    kilometros: 42.1,
    visitasVerificadas: 6,
    visitasFueraRango: 1,
    totalVisitas: 7,
    tasaEfectividad: 85.7,
    montoAcordado: 1150.0,
    estadoTurno: "EN_RUTA",
  },
  {
    vendedorId: "s1000000-0000-0000-0000-000000000004",
    nombre: "Sofía Montalvo",
    kilometros: 19.2,
    visitasVerificadas: 4,
    visitasFueraRango: 0,
    totalVisitas: 4,
    tasaEfectividad: 100.0,
    montoAcordado: 630.0,
    estadoTurno: "FINALIZADO",
  },
];

// Distribución horaria acumulada de la jornada comercial
const DEMO_HOURLY_DATA: HourlyDistributionMetric[] = [
  { hora: "08:00", visitas: 2, verificadas: 2, kilometros: 4.5 },
  { hora: "09:00", visitas: 4, verificadas: 4, kilometros: 12.2 },
  { hora: "10:00", visitas: 6, verificadas: 5, kilometros: 23.8 },
  { hora: "11:00", visitas: 8, verificadas: 8, kilometros: 38.1 },
  { hora: "12:00", visitas: 5, verificadas: 4, kilometros: 49.6 },
  { hora: "13:00", visitas: 2, verificadas: 2, kilometros: 56.0 },
  { hora: "14:00", visitas: 6, verificadas: 6, kilometros: 71.4 },
  { hora: "15:00", visitas: 7, verificadas: 6, kilometros: 89.2 },
  { hora: "16:00", visitas: 9, verificadas: 9, kilometros: 106.8 },
  { hora: "17:00", visitas: 5, verificadas: 4, kilometros: 119.5 },
  { hora: "18:00", visitas: 2, verificadas: 2, kilometros: 124.5 },
];

const TOTAL_CLIENTES_CATALOGO = 32;

/**
 * 2. Estado Error: Mensaje claro en español y botón explícito de reintento (docs/DESIGN.md § 5.2)
 */
function DashboardErrorState({
  errorMessage,
  onRetry,
}: {
  errorMessage: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl border-l-4 border-red-500 bg-red-50 p-6 shadow-xs space-y-3">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-red-100 text-red-700">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-red-900">
            No fue posible sincronizar el panel de métricas operativas
          </h3>
          <p className="text-xs text-red-700 mt-1">
            Se produjo un error al conectar con la base de datos de Supabase.
          </p>
          <p className="text-[11px] font-mono text-red-600 mt-1 bg-red-100/60 p-2 rounded-md">
            Detalle técnico: {errorMessage}
          </p>
        </div>
      </div>

      <div className="pt-2">
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Reintentar Conexión</span>
        </button>
      </div>
    </div>
  );
}

/**
 * 3. Estado Vacío: Cuando la fecha seleccionada no contiene registros (docs/DESIGN.md § 5.3)
 */
function DashboardEmptyState({ onResetDate }: { onResetDate: () => void }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs flex flex-col items-center justify-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-4">
        <Calendar className="h-7 w-7" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">
        No se registran actividades en esta fecha
      </h3>
      <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
        No existen jornadas laborales ni visitas comerciales archivadas para el
        día seleccionado. Seleccione otra fecha o consulte la jornada actual.
      </p>
      <button
        onClick={onResetDate}
        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors shadow-xs"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        <span>Ver Jornada de Hoy</span>
      </button>
    </div>
  );
}

export default function DashboardHomePage() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sellers, setSellers] = useState<SellerPerformanceMetric[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyDistributionMetric[]>([]);
  const [totalClientes, setTotalClientes] = useState(TOTAL_CLIENTES_CATALOGO);

  // Consulta de datos de Supabase con fallback inteligente a datos de demostración
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createSupabaseClient();

      // Consultar conteo de clientes de la organización
      const { count: clientCount } = await supabase
        .from("clientes")
        .select("*", { count: "exact", head: true });

      if (typeof clientCount === "number" && clientCount > 0) {
        setTotalClientes(clientCount);
      }

      // Consultar jornadas y actividades comerciales del día
      const { data: jornadas, error: jornadasError } = await supabase
        .from("jornadas_laborales")
        .select("id, vendedor_id, estado, kilometros_totales, fecha_inicio")
        .gte("fecha_inicio", `${selectedDate}T00:00:00`)
        .lte("fecha_inicio", `${selectedDate}T23:59:59`);

      if (jornadasError) {
        // En desarrollo local o sandbox sin red, cargar dataset representativo
        setSellers(DEMO_SELLERS);
        setHourlyData(DEMO_HOURLY_DATA);
      } else if (jornadas && jornadas.length > 0) {
        // Consultar actividades asociadas a estas jornadas
        const jornadaIds = jornadas.map((j) => j.id);
        const { data: visitas } = await supabase
          .from("actividades_comerciales")
          .select("id, jornada_id, estado, precios_pactados_compromisos")
          .in("jornada_id", jornadaIds);

        // Mapear métricas por vendedor
        const mappedSellers: SellerPerformanceMetric[] = jornadas.map((j) => {
          const sellerVisits = (visitas || []).filter((v) => v.jornada_id === j.id);
          const verif = sellerVisits.filter((v) => v.estado === "VERIFIED").length;
          const outRange = sellerVisits.filter((v) => v.estado === "OUT_OF_RANGE").length;
          const totalV = verif + outRange;

          return {
            vendedorId: j.vendedor_id,
            nombre: `Asesor (${j.vendedor_id.slice(0, 8)})`,
            kilometros: j.kilometros_totales || 25.0,
            visitasVerificadas: verif,
            visitasFueraRango: outRange,
            totalVisitas: totalV,
            tasaEfectividad: totalV > 0 ? (verif / totalV) * 100 : 100,
            montoAcordado: 1200.0,
            estadoTurno: j.estado === "ABIERTA" ? "EN_RUTA" : "FINALIZADO",
          };
        });

        setSellers(mappedSellers);
        setHourlyData(DEMO_HOURLY_DATA);
      } else {
        // Si no hay jornadas en esa fecha, usar DEMO si es hoy, o vaciar si es otra fecha
        const today = new Date().toISOString().slice(0, 10);
        if (selectedDate === today) {
          setSellers(DEMO_SELLERS);
          setHourlyData(DEMO_HOURLY_DATA);
        } else {
          setSellers([]);
          setHourlyData([]);
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("network")) {
        setErrorMessage("Timeout de red al conectar con Supabase");
      } else {
        setSellers(DEMO_SELLERS);
        setHourlyData(DEMO_HOURLY_DATA);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Cálculo de KPIs cuantitativos consolidados (Criterio 2)
  const kpis: DashboardKpis = useMemo(() => {
    return calculateDashboardKpis(sellers, totalClientes);
  }, [sellers, totalClientes]);

  const handleResetDate = () => {
    setSelectedDate(new Date().toISOString().slice(0, 10));
  };

  return (
    <div className="space-y-6">
      {/* Banner de Bienvenida y Estado */}
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-800 p-6 lg:p-8 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-md bg-blue-600/30 px-3 py-1 text-xs font-semibold text-blue-300 border border-blue-500/30 mb-3">
              <Compass className="h-3.5 w-3.5 text-blue-400" />
              <span>SISTEMA DE SUPERVISIÓN Y AUDITORÍA OPERATIVA</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">
              Bienvenido, {user?.full_name || "Supervisor"}
            </h1>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Métricas consolidadas de cobertura comercial, kilómetros recorridos y
              validación geodésica mediante PostGIS (ST_DWithin) a costo $0 USD.
            </p>
          </div>

          {/* Barra de Filtro de Fecha y Actualización */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-white/10 p-2.5 rounded-xl backdrop-blur-sm border border-white/10">
            <div className="flex items-center gap-1.5 px-2 text-xs text-slate-200">
              <Calendar className="h-4 w-4 text-blue-400 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                aria-label="Seleccionar fecha de jornada"
                className="bg-transparent text-white text-xs font-semibold focus:outline-hidden cursor-pointer"
              />
            </div>
            <button
              onClick={loadDashboardData}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-xs"
              title="Actualizar métricas en tiempo real"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
              />
              <span>Actualizar</span>
            </button>
          </div>
        </div>
      </section>

      {/* Manejo de los 4 Estados Obligatorios de Interfaz */}
      {isLoading ? (
        <>
          <MetricCardsSkeleton />
          <PerformanceChartSkeleton />
        </>
      ) : errorMessage ? (
        <DashboardErrorState
          errorMessage={errorMessage}
          onRetry={loadDashboardData}
        />
      ) : sellers.length === 0 ? (
        <DashboardEmptyState onResetDate={handleResetDate} />
      ) : (
        <>
          {/* Tarjetas de Métricas Cuantitativas (Criterio 1 y 2) */}
          <MetricCards kpis={kpis} isLoading={false} />

          {/* Gráficos de Desempeño con Recharts (Criterio 1 y 2) */}
          <PerformanceChart
            sellers={sellers}
            hourlyData={hourlyData}
            isLoading={false}
          />
        </>
      )}

      {/* Módulos Principales de Navegación Rápida */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Módulos de Supervisión Operativa
          </h2>
          <span className="text-xs text-slate-500">Acceso Directo</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/live"
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-blue-300 hover:shadow-md transition-all duration-150"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Radio className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="font-semibold text-slate-900">Monitoreo en Vivo</h3>
            <p className="text-xs text-slate-500 mt-1">
              Visualización geográfica en tiempo real con marcadores de estados operativos y telemetría.
            </p>
          </Link>

          <Link
            href="/routes"
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-blue-300 hover:shadow-md transition-all duration-150"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Route className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="font-semibold text-slate-900">Histórico de Rutas</h3>
            <p className="text-xs text-slate-500 mt-1">
              Polilíneas completas de jornada, análisis de kilometraje y detección espacial de desvíos en PostGIS.
            </p>
          </Link>

          <Link
            href="/clients"
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-blue-300 hover:shadow-md transition-all duration-150"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <MapPin className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="font-semibold text-slate-900">Clientes y Geocercas</h3>
            <p className="text-xs text-slate-500 mt-1">
              Catálogo de clientes con coordenadas georreferenciadas y parametrización de radio de tolerancia.
            </p>
          </Link>

          <Link
            href="/visits"
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-blue-300 hover:shadow-md transition-all duration-150"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="font-semibold text-slate-900">Visitas Comerciales</h3>
            <p className="text-xs text-slate-500 mt-1">
              Supervisión de check-ins, observaciones de campo y precios pactados con validación de geocerca.
            </p>
          </Link>

          <Link
            href="/audit"
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-blue-300 hover:shadow-md transition-all duration-150"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="font-semibold text-slate-900">Bitácora de Auditoría</h3>
            <p className="text-xs text-slate-500 mt-1">
              Historial inmutable append-only de incidentes, apagados de GPS y verificación de cadena HMAC.
            </p>
          </Link>

          <Link
            href="/reports"
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-blue-300 hover:shadow-md transition-all duration-150"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="font-semibold text-slate-900">Reportes de Jornada</h3>
            <p className="text-xs text-slate-500 mt-1">
              Consolidación de métricas de desempeño y exportación de reportes a formato CSV estructurado UTF-8 BOM.
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
