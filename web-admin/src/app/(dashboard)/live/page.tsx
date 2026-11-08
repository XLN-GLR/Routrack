"use client";

import React, { useState } from "react";
import { Radio, RefreshCw } from "lucide-react";
import MapContainerWrapper from "@/components/map/MapContainerWrapper";

export default function LiveMonitoringPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

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
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Contenedor del Mapa Interactivo (Leaflet + OpenStreetMap) */}
      <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-xs min-h-[550px] h-[calc(100vh-250px)]">
        <MapContainerWrapper
          key={refreshKey}
          className="w-full h-full min-h-[500px]"
          showControls={true}
        />
      </div>
    </div>
  );
}
