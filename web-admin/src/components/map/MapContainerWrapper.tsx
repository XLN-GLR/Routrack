"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Loader2, MapPin } from "lucide-react";
import type { MapViewProps } from "./MapView";

/**
 * Skeleton de carga visual para el mapa mientras se inicializa el runtime en cliente.
 * Previene discrepancias de hidratación de Next.js (SSR mismatch) y saltos de layout (CLS).
 */
export function MapLoadingSkeleton({ className = "w-full h-full min-h-[450px]" }: { className?: string }) {
  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-center ${className}`}
      aria-label="Cargando visor de mapas"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 mb-3 animate-pulse">
        <MapPin className="h-6 w-6" />
      </div>
      <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        <span>Cargando mapa interactivo (OpenStreetMap)...</span>
      </div>
      <p className="text-[11px] text-slate-400 mt-1">
        Inicializando motor de renderizado cartográfico
      </p>
    </div>
  );
}

/**
 * Componente dinámico de Mapa con carga asíncrona exclusiva en cliente (`ssr: false`).
 *
 * Cumple con el Criterio 1 de TASK-014: Renderizado fluido sin errores de hidratación
 * de Next.js en servidor al aislar las referencias a las APIs de navegador (`window`, `document`, `navigator`).
 */
const DynamicMapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <MapLoadingSkeleton />,
});

/**
 * Exportación oficial del contenedor de mapa para uso directo en cualquier vista de web-admin.
 */
export default function MapContainerWrapper(props: MapViewProps) {
  return <DynamicMapView {...props} />;
}
