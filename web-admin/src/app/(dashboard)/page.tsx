"use client";

import React from "react";
import Link from "next/link";
import {
  Activity,
  Radio,
  Route,
  MapPin,
  CheckCircle2,
  ShieldAlert,
  FileSpreadsheet,
  Users,
  Compass,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardHomePage() {
  const { user } = useAuth();

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
              Plataforma empresarial de trazabilidad geográfica, validación de visitas mediante geocercas
              PostGIS y custodia inmutable de auditoría para equipos comerciales en ruta.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm border border-white/10 text-center min-w-[110px]">
              <span className="block text-2xl font-bold text-emerald-400">0 USD</span>
              <span className="text-xs text-slate-300">Infraestructura</span>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm border border-white/10 text-center min-w-[110px]">
              <span className="block text-2xl font-bold text-blue-400">100%</span>
              <span className="text-xs text-slate-300">RLS Activo</span>
            </div>
          </div>
        </div>
      </section>

      {/* Tarjetas KPI de Métricas Operativas */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Vendedores Activos
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">0</span>
            <span className="text-xs text-slate-500">en jornada</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Equipos móviles sincronizados</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Visitas Verificadas
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">100%</span>
            <span className="text-xs text-emerald-600 font-medium">en rango geocerca</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Validación con ST_DWithin</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Desvíos de Ruta
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Route className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">0</span>
            <span className="text-xs text-slate-500">alertas activas</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Tolerancia máxima 300 m</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Cadena de Integridad
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">Válida</span>
            <span className="text-xs text-slate-500">HMAC-SHA256</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Inmutabilidad garantizada</p>
        </div>
      </section>

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

      {/* Matriz Semántica de Estados Operativos (DESIGN.md) */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">
          Semántica de Estados Operativos en Campo
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
            <span className="inline-block rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white mb-1.5">
              En Ruta
            </span>
            <p className="text-xs text-slate-700 font-medium">Velocidad &gt; 5 km/h</p>
            <p className="text-[11px] text-slate-500 mt-0.5">En movimiento dentro del corredor.</p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <span className="inline-block rounded-full bg-amber-600 px-2 py-0.5 text-[11px] font-bold text-white mb-1.5">
              Detenido
            </span>
            <p className="text-xs text-slate-700 font-medium">Velocidad &lt; 1 km/h (&gt; 3 min)</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Parada estática sin visita activa.</p>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
            <span className="inline-block rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white mb-1.5">
              Visita Validada
            </span>
            <p className="text-xs text-slate-700 font-medium">Check-in &le; tolerancia</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Dentro del radio del cliente.</p>
          </div>

          <div className="rounded-lg border border-red-200 bg-red-50/60 p-3">
            <span className="inline-block rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white mb-1.5">
              Desviación
            </span>
            <p className="text-xs text-slate-700 font-medium">Desvío &gt; 300 metros</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Apartado del corredor planificado.</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="inline-block rounded-full bg-slate-600 px-2 py-0.5 text-[11px] font-bold text-white mb-1.5">
              Sin Conexión
            </span>
            <p className="text-xs text-slate-700 font-medium">&gt; 15 min sin reporte</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Dispositivo offline o sin señal.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
