"use client";

import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { BarChart3, LineChart, TrendingUp, Info } from "lucide-react";
import {
  SellerPerformanceMetric,
  HourlyDistributionMetric,
} from "@/types/dashboard";

interface PerformanceChartProps {
  sellers: SellerPerformanceMetric[];
  hourlyData: HourlyDistributionMetric[];
  isLoading?: boolean;
}

/**
 * Skeleton Loader para los gráficos de desempeño (docs/DESIGN.md § 5.1).
 */
export function PerformanceChartSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1.5">
          <div className="h-4 w-44 rounded-sm bg-slate-200 animate-pulse" />
          <div className="h-3 w-64 rounded-sm bg-slate-200 animate-pulse" />
        </div>
        <div className="h-8 w-56 rounded-lg bg-slate-200 animate-pulse" />
      </div>

      <div className="h-[320px] w-full rounded-xl bg-slate-100 animate-pulse flex items-center justify-center">
        <span className="text-xs text-slate-400 font-medium">
          Cargando métricas y gráficos Recharts...
        </span>
      </div>
    </div>
  );
}

// Tooltip personalizado para el gráfico de vendedores
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

function SellerCustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl bg-slate-900/95 p-3.5 shadow-xl border border-slate-800 text-white text-xs space-y-1.5 min-w-[190px]">
        <p className="font-bold text-slate-100 border-b border-slate-800 pb-1">
          {label}
        </p>
        {payload.map((entry, index) => (
          <div
            key={`tooltip-item-${index}`}
            className="flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-slate-300">{entry.name}:</span>
            </div>
            <span className="font-mono font-bold text-white">
              {entry.name.includes("Kilómetros")
                ? `${entry.value.toFixed(1)} km`
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

// Tooltip personalizado para la distribución horaria
function HourlyCustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl bg-slate-900/95 p-3.5 shadow-xl border border-slate-800 text-white text-xs space-y-1.5 min-w-[180px]">
        <p className="font-bold text-slate-100 border-b border-slate-800 pb-1">
          Hora: {label}
        </p>
        {payload.map((entry, index) => (
          <div
            key={`hourly-item-${index}`}
            className="flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-slate-300">{entry.name}:</span>
            </div>
            <span className="font-mono font-bold text-white">
              {entry.name.includes("Kilómetros")
                ? `${entry.value.toFixed(1)} km`
                : `${entry.value} visitas`}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export function PerformanceChart({
  sellers,
  hourlyData,
  isLoading = false,
}: PerformanceChartProps) {
  const [activeTab, setActiveTab] = useState<"sellers" | "hourly">("sellers");
  const [isMounted, setIsMounted] = useState(false);

  // Asegurar montaje en cliente para evitar hydration mismatch con SVGs de Recharts
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (isLoading || !isMounted) {
    return <PerformanceChartSkeleton />;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
      {/* Cabecera del Gráfico con Selector de Pestañas */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              {activeTab === "sellers"
                ? "Desempeño y Cobertura por Asesor Comercial"
                : "Evolución Horaria de Visitas y Trazabilidad"}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeTab === "sellers"
              ? "Comparativa de kilómetros recorridos, visitas en geocerca y alertas fuera de rango."
              : "Ritmo de actividad de la jornada comercial entre las 08:00 y las 18:00 horas."}
          </p>
        </div>

        {/* Selector de Pestañas */}
        <div className="flex items-center rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("sellers")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              activeTab === "sellers"
                ? "bg-white text-blue-700 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Por Vendedor</span>
          </button>
          <button
            onClick={() => setActiveTab("hourly")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              activeTab === "hourly"
                ? "bg-white text-blue-700 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <LineChart className="h-3.5 w-3.5" />
            <span>Curva Horaria</span>
          </button>
        </div>
      </div>

      {/* Renderizado del Gráfico Recharts */}
      <div className="h-[340px] w-full pt-2">
        {activeTab === "sellers" ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sellers}
              margin={{ top: 15, right: 20, left: 0, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="nombre"
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={{ stroke: "#cbd5e1" }}
                tickLine={false}
                interval={0}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={{ stroke: "#cbd5e1" }}
                tickLine={false}
              />
              <Tooltip content={<SellerCustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: "12px", fontSize: "11px" }}
              />
              <Bar
                name="Kilómetros Recorridos"
                dataKey="kilometros"
                fill="#2563EB"
                radius={[4, 4, 0, 0]}
                maxBarSize={45}
              />
              <Bar
                name="Visitas Verificadas"
                dataKey="visitasVerificadas"
                fill="#059669"
                radius={[4, 4, 0, 0]}
                maxBarSize={45}
              />
              <Bar
                name="Alertas Fuera de Rango"
                dataKey="visitasFueraRango"
                fill="#DC2626"
                radius={[4, 4, 0, 0]}
                maxBarSize={45}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={hourlyData}
              margin={{ top: 15, right: 20, left: 0, bottom: 25 }}
            >
              <defs>
                <linearGradient id="colorVisitas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorKm" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="hora"
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={{ stroke: "#cbd5e1" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={{ stroke: "#cbd5e1" }}
                tickLine={false}
              />
              <Tooltip content={<HourlyCustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: "12px", fontSize: "11px" }}
              />
              <Area
                type="monotone"
                name="Visitas Verificadas"
                dataKey="verificadas"
                stroke="#059669"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorVisitas)"
              />
              <Area
                type="monotone"
                name="Kilómetros de Ruta"
                dataKey="kilometros"
                stroke="#2563EB"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorKm)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Nota descriptiva al pie */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
        <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
        <span>
          Las visitas se categorizan de forma automática en el motor PostGIS
          mediante la función <code>ST_DWithin(cliente.ubicacion, checkin.ubicacion, radio)</code>.
        </span>
      </div>
    </div>
  );
}
export default PerformanceChart;

