"use client";

import { useEffect, useRef } from "react";
import type L from "leaflet";
import {
  RoutePoint,
  RouteStop,
  DeviationSegment,
  sortPointsChronologically,
  detectDeviatedPoints,
  groupIntoDeviationSegments,
  DEFAULT_DEVIATION_THRESHOLD_METERS,
} from "@/lib/geo/deviations";
import { useMapInstance } from "./MapView";

export interface RoutePolylineProps {
  points: RoutePoint[];
  referenceStops?: RouteStop[];
  deviationThresholdMeters?: number;
  showStops?: boolean;
  showDeviations?: boolean;
  fitBoundsOnMount?: boolean;
  onSelectDeviation?: (deviation: DeviationSegment) => void;
}

/**
 * Componente modular para el trazado de trayectorias históricas de ruta con Leaflet.
 *
 * Cumple rigurosamente con:
 * - Criterio 1: Dibuja cronológicamente el recorrido sin deformaciones espaciales (#2563EB, 4px).
 * - Criterio 2: Destaca trazos desviados (> 300m) en color rojo semitransparente (#DC2626, 6px, opacidad 0.7).
 */
export default function RoutePolyline({
  points,
  referenceStops = [],
  deviationThresholdMeters = DEFAULT_DEVIATION_THRESHOLD_METERS,
  showStops = true,
  showDeviations = true,
  fitBoundsOnMount = true,
  onSelectDeviation,
}: RoutePolylineProps) {
  const map = useMapInstance();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map || points.length === 0) return;

    let isMounted = true;

    import("leaflet").then((LModule) => {
      if (!isMounted || !map) return;
      const L = LModule.default || LModule;

      // Limpiar capas previas si existen
      if (layerGroupRef.current) {
        layerGroupRef.current.clearLayers();
        map.removeLayer(layerGroupRef.current);
      }

      const layerGroup = L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;

      // 1. Criterio 1: Ordenar cronológicamente los puntos de telemetría para evitar deformaciones
      const sortedPoints = sortPointsChronologically(points);
      const latLngs: [number, number][] = sortedPoints.map((p) => [p.latitude, p.longitude]);

      if (latLngs.length < 2) return;

      // 2. Trazo de la Polilínea Principal en Azul Tránsito (#2563EB)
      const mainPolyline = L.polyline(latLngs, {
        color: "#2563EB",
        weight: 4,
        opacity: 0.85,
        lineJoin: "round",
        lineCap: "round",
      }).addTo(layerGroup);

      // 3. Criterio 2: Detección y Trazado de Desvíos en Rojo Semitransparente (#DC2626)
      if (showDeviations && referenceStops.length > 0) {
        const deviatedPoints = detectDeviatedPoints(
          sortedPoints,
          referenceStops,
          deviationThresholdMeters
        );
        const deviationSegments = groupIntoDeviationSegments(deviatedPoints, sortedPoints);

        deviationSegments.forEach((segment) => {
          const segmentLatLngs: [number, number][] = segment.points.map((p) => [
            p.latitude,
            p.longitude,
          ]);

          if (segmentLatLngs.length < 2) return;

          // Polilínea de desvío con resalte semitransparente y línea punteada
          const devPolyline = L.polyline(segmentLatLngs, {
            color: "#DC2626",
            weight: 6,
            opacity: 0.7,
            dashArray: "8, 8",
            lineJoin: "round",
          }).addTo(layerGroup);

          // Popup detallado del desvío
          const popupHtml = `
            <div class="p-2.5 max-w-[240px] text-slate-800 font-sans text-xs">
              <div class="flex items-center gap-1.5 font-bold text-red-600 mb-1">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span>Desviación de Ruta</span>
              </div>
              <p class="text-slate-600 text-[11px] mb-2 leading-tight">
                El vehículo superó el umbral de tolerancia de <strong>${deviationThresholdMeters}m</strong> respecto a los puntos autorizados.
              </p>
              <div class="bg-red-50 p-2 rounded border border-red-200 space-y-1 font-mono text-[11px]">
                <div class="flex justify-between">
                  <span>Desvío Máx:</span>
                  <span class="font-bold text-red-700">${Math.round(segment.maxDeviationMeters)} m</span>
                </div>
                <div class="flex justify-between">
                  <span>Duración:</span>
                  <span>${segment.durationMinutes} min</span>
                </div>
              </div>
            </div>
          `;
          devPolyline.bindPopup(popupHtml);

          devPolyline.on("click", () => {
            if (onSelectDeviation) {
              onSelectDeviation(segment);
            }
          });
        });
      }

      // 4. Marcadores de Inicio y Fin de Ruta
      const startPoint = sortedPoints[0];
      const endPoint = sortedPoints[sortedPoints.length - 1];

      // Marcador de Inicio
      const startIcon = L.divIcon({
        html: `
          <div class="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white font-bold shadow-md border-2 border-white text-xs">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
        `,
        className: "routrack-start-marker",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker([startPoint.latitude, startPoint.longitude], { icon: startIcon, title: "Inicio de Jornada" })
        .bindPopup(`<div class="text-xs font-semibold p-1">Inicio de Jornada: ${new Date(startPoint.recordedAt).toLocaleTimeString("es-EC")}</div>`)
        .addTo(layerGroup);

      // Marcador de Fin
      const endIcon = L.divIcon({
        html: `
          <div class="flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-white font-bold shadow-md border-2 border-white text-xs">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12"/>
            </svg>
          </div>
        `,
        className: "routrack-end-marker",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker([endPoint.latitude, endPoint.longitude], { icon: endIcon, title: "Fin de Jornada" })
        .bindPopup(`<div class="text-xs font-semibold p-1">Fin de Jornada: ${new Date(endPoint.recordedAt).toLocaleTimeString("es-EC")}</div>`)
        .addTo(layerGroup);

      // 5. Marcadores y Círculos de Geocerca de Paradas de Clientes
      if (showStops && referenceStops.length > 0) {
        referenceStops.forEach((stop, index) => {
          // Geocerca circular (tolerancia en metros)
          L.circle([stop.latitude, stop.longitude], {
            radius: stop.toleranceRadiusMeters,
            color: stop.isVerified ? "#059669" : "#64748B",
            fillColor: stop.isVerified ? "#059669" : "#94A3B8",
            fillOpacity: 0.15,
            weight: 1.5,
            dashArray: stop.isVerified ? undefined : "4, 4",
          }).addTo(layerGroup);

          // Marcador de Parada con número de orden
          const stopIcon = L.divIcon({
            html: `
              <div class="flex items-center justify-center w-6 h-6 rounded-full ${
                stop.isVerified ? "bg-emerald-600" : "bg-slate-600"
              } text-white font-bold shadow-sm border border-white text-[10px]">
                ${stop.plannedOrder || index + 1}
              </div>
            `,
            className: "routrack-stop-marker",
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });

          const stopPopupHtml = `
            <div class="p-2 text-xs font-sans">
              <div class="font-bold text-slate-900">${stop.name}</div>
              <div class="text-[11px] text-slate-500">${stop.address || "Sin dirección"}</div>
              <div class="mt-1 text-[10px] font-medium text-emerald-600">
                ${stop.isVerified ? "Visita Verificada (Check-in exitoso)" : "Parada Programada"}
              </div>
              <div class="text-[10px] text-slate-400">Radio: ${stop.toleranceRadiusMeters} m</div>
            </div>
          `;
          L.marker([stop.latitude, stop.longitude], { icon: stopIcon })
            .bindPopup(stopPopupHtml)
            .addTo(layerGroup);
        });
      }

      // 6. Encuadre Automático de la Ruta
      if (fitBoundsOnMount && latLngs.length > 0) {
        map.fitBounds(mainPolyline.getBounds(), {
          padding: [40, 40],
          maxZoom: 16,
        });
      }
    });

    return () => {
      isMounted = false;
      if (layerGroupRef.current && map) {
        layerGroupRef.current.clearLayers();
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current = null;
      }
    };
  }, [
    map,
    points,
    referenceStops,
    deviationThresholdMeters,
    showStops,
    showDeviations,
    fitBoundsOnMount,
    onSelectDeviation,
  ]);

  return null;
}

