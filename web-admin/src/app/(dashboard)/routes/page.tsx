"use client";

import React from "react";
import { Route, Calendar, User } from "lucide-react";

export default function RoutesHistoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
            <Route className="h-4 w-4" />
            <span>Trazabilidad Espacial</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Histórico de Trayectorias y Desvíos
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Polilíneas cronológicas de recorridos diarios y análisis de desviación espacial en PostGIS.
          </p>
        </div>

        {/* Filtros de Vendedor y Fecha */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-xs">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span>Hoy</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-xs">
            <User className="h-3.5 w-3.5 text-slate-400" />
            <span>Todos los Asesores</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs min-h-[450px] flex flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 mb-4">
          <Route className="h-7 w-7" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">
          Reconstrucción de Rutas Diarias
        </h3>
        <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed">
          Módulo preparado para renderizar polilíneas de jornadas consolidadas (`ST_MakeLine`)
          y segmentos con desvío &gt; 300 metros conforme a TASK-007 y TASK-016.
        </p>
      </div>
    </div>
  );
}
