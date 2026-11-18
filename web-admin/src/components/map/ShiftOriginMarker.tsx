"use client";

import { useEffect, useRef } from "react";
import type L from "leaflet";
import type { LatLngTuple } from "@/types/map";
import { useMapInstance } from "./MapView";

export interface ShiftOriginMarkerProps {
  point: LatLngTuple;
  sellerName: string;
  label?: string;
  startTime?: string;
  map?: L.Map | null;
}

let cachedLeaflet: typeof import("leaflet") | null = null;
async function getLeaflet() {
  if (cachedLeaflet) return cachedLeaflet;
  const LModule = await import("leaflet");
  cachedLeaflet = (LModule.default || LModule) as typeof import("leaflet");
  return cachedLeaflet;
}

/**
 * Marcador visual de alta precisión para indicar el punto de partida / origen
 * de la jornada activa del vendedor en el mapa en vivo (/live).
 */
export default function ShiftOriginMarker({
  point,
  sellerName,
  label = "Inicio de Jornada",
  startTime,
  map: externalMap,
}: ShiftOriginMarkerProps) {
  const contextMap = useMapInstance();
  const map = externalMap || contextMap;
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!map || !point) return;

    let isMounted = true;

    getLeaflet().then((L) => {
      if (!isMounted || !map) return;

      // Limpiar marcador anterior si existe
      if (markerRef.current) {
        try {
          if (map.hasLayer(markerRef.current)) {
            map.removeLayer(markerRef.current);
          }
        } catch {
          // Protección contra desmontaje
        }
        markerRef.current = null;
      }

      // Icono HTML enriquecido: Pin esmeralda con icono de bandera de salida
      const originIcon = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group" style="width: 28px; height: 28px;">
            <span class="absolute -inset-1 rounded-full bg-emerald-500/30 animate-pulse"></span>
            <div class="w-7 h-7 rounded-full bg-emerald-600 border-2 border-white text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              </svg>
            </div>
            <span class="absolute -bottom-5 px-1.5 py-0.2 rounded bg-slate-900/90 text-white text-[9px] font-bold whitespace-nowrap shadow-xs pointer-events-none">
              INICIO
            </span>
          </div>
        `,
        className: "routrack-shift-origin-marker",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const [lat, lng] = point;
      const marker = L.marker([lat, lng], {
        icon: originIcon,
        zIndexOffset: 300,
        title: `${label} — ${sellerName}`,
      }).addTo(map);

      // Tooltip y Popup informativo
      const popupContent = `
        <div class="p-2 text-slate-800 text-xs font-sans min-w-[180px]">
          <div class="flex items-center gap-1.5 text-emerald-700 font-bold mb-1">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>
            </svg>
            <span>${label}</span>
          </div>
          <div class="text-[11px] text-slate-600">
            <div>Asesor: <strong>${sellerName}</strong></div>
            ${startTime ? `<div>Hora: <strong>${startTime}</strong></div>` : ""}
            <div class="text-[10px] text-slate-400 mt-1 font-mono">[${lat.toFixed(4)}, ${lng.toFixed(4)}]</div>
          </div>
        </div>
      `;
      marker.bindPopup(popupContent);

      markerRef.current = marker;
    });

    return () => {
      isMounted = false;
      if (markerRef.current) {
        try {
          if (map && map.hasLayer(markerRef.current)) {
            map.removeLayer(markerRef.current);
          }
        } catch {
          // Desmontaje
        }
        markerRef.current = null;
      }
    };
  }, [map, point, sellerName, label, startTime]);

  return null;
}
