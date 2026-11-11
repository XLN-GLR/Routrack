"use client";

import React from "react";
import {
  Users,
  Route,
  CheckCircle2,
  Percent,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Radio,
} from "lucide-react";
import { DashboardKpis } from "@/types/dashboard";

interface MetricCardsProps {
  kpis: DashboardKpis;
  isLoading?: boolean;
}

/**
 * Skeleton Loader anatómico para las tarjetas KPI de métricas operativas (docs/DESIGN.md § 5.1).
 */
export function MetricCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-3 w-28 rounded-sm bg-slate-200 animate-pulse" />
            <div className="h-9 w-9 rounded-lg bg-slate-200 animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <div className="h-8 w-24 rounded-md bg-slate-200 animate-pulse" />
            <div className="h-3.5 w-36 rounded-sm bg-slate-200 animate-pulse" />
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div className="h-3 w-20 rounded-sm bg-slate-200 animate-pulse" />
            <div className="h-3 w-14 rounded-sm bg-slate-200 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MetricCards({ kpis, isLoading = false }: MetricCardsProps) {
  if (isLoading) {
    return <MetricCardsSkeleton />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* KPI 1: Cobertura de Clientes Asignados */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Cobertura de Clientes
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Percent className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">
            {kpis.tasaCobertura}%
          </span>
          <span className="text-xs text-slate-500 font-medium">
            ({kpis.clientesVisitados} de {kpis.totalClientesAsignados})
          </span>
        </div>
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">Efectividad de ruta</span>
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Objetivo &gt; 80%</span>
          </span>
        </div>
      </div>

      {/* KPI 2: Kilómetros Totales Recorridos */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Kilómetros Recorridos
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Route className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">
            {kpis.kilometrosTotales.toLocaleString("es-EC", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}{" "}
            km
          </span>
          <span className="text-xs text-slate-500">acumulados</span>
        </div>
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">Promedio por asesor</span>
          <span className="font-semibold text-slate-700">
            {kpis.vendedoresTotales > 0
              ? (kpis.kilometrosTotales / kpis.vendedoresTotales).toFixed(1)
              : "0.0"}{" "}
            km/vendedor
          </span>
        </div>
      </div>

      {/* KPI 3: Tasa de Visitas Verificadas (ST_DWithin) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Visitas Verificadas
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">
            {kpis.tasaEfectividad}%
          </span>
          <span className="text-xs text-emerald-600 font-semibold">
            {kpis.visitasVerificadas} en geocerca
          </span>
        </div>
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">Alertas fuera de rango</span>
          <span
            className={`font-semibold ${
              kpis.visitasFueraRango > 0 ? "text-amber-600" : "text-slate-600"
            }`}
          >
            {kpis.visitasFueraRango} visitas
          </span>
        </div>
      </div>

      {/* KPI 4: Vendedores Activos en Ruta */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Fuerza Comercial Activa
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600">
            <Radio className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">
            {kpis.vendedoresActivos}
          </span>
          <span className="text-xs text-slate-500 font-medium">
            de {kpis.vendedoresTotales} en jornada
          </span>
        </div>
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">Monto total pactado</span>
          <span className="font-bold text-purple-700">
            ${kpis.montoTotalAcordado.toLocaleString("es-EC", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
export default MetricCards;

