"use client";

import React from "react";
import { Radio, RefreshCw, Layers } from "lucide-react";

export default function LiveMonitoringPage() {
  return (
    <div className="space-y-6">
      {/* Cabecera del Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
            <Radio className="h-4 w-4 animate-pulse" />
            <span>Monitoreo Activo en Tiempo Real</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Supervisión Geográfica de Fuerza de Ventas
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Posición en vivo, rumbo, velocidad y estado operativo de vendedores activos en campo.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Contenedor del Mapa / Estado Base */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs min-h-[500px] flex flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-4">
          <Layers className="h-7 w-7" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">
          Visor de Monitoreo Cartográfico (Leaflet + OpenStreetMap)
        </h3>
        <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed">
          El componente interactivo de mapas se integrará formalmente en TASK-014 y TASK-015,
          suscribiéndose a la telemetría en vivo con actualización adaptativa y cero costo de APIs.
        </p>
      </div>
    </div>
  );
}
