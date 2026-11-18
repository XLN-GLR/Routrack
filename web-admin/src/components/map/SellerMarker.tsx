"use client";

import { useEffect, useRef } from "react";
import type L from "leaflet";
import { SellerLiveState, OPERATIONAL_STATUS_CONFIGS } from "@/types/seller";
import { renderSellerPopupHtml } from "./SellerPopup";
import { useMapInstance } from "./MapView";

export interface SellerMarkerProps {
  seller: SellerLiveState;
  map?: L.Map | null;
  onClick?: (seller: SellerLiveState) => void;
  isSelected?: boolean;
  enableKinematicAnimation?: boolean;
  animationDurationMs?: number;
}

/**
 * Genera el SVG del marcador vectorial adaptativo según el estado operativo y rumbo del vendedor.
 *
 * Cumple con el Criterio 1 de TASK-015 y la animación cinemática de TASK-034:
 * - Marcador azul en movimiento con flecha de orientación/rumbo (bearing).
 * - Ámbar detenido.
 * - Verde en visita validada.
 * - Rojo en anomalía / desviación / Mock Location.
 * - Gris sin conexión.
 */
export function buildSellerMarkerSvg(
  seller: SellerLiveState,
  isSelected: boolean = false,
  overrideBearing?: number
): string {
  const config = OPERATIONAL_STATUS_CONFIGS[seller.status];
  const bearingDegrees = overrideBearing !== undefined ? overrideBearing : seller.bearingDegrees;
  const { status } = seller;
  const color = config.colorHex;

  // Anillos de selección o pulsación
  const pulseRing =
    status === "EN_RUTA"
      ? `<span class="absolute -inset-1.5 rounded-full animate-ping opacity-30" style="background-color: ${color}"></span>`
      : status === "DESVIACION"
      ? `<span class="absolute -inset-2 rounded-full animate-ping opacity-60 bg-red-500"></span>`
      : "";

  const selectedBorder = isSelected
    ? `ring-3 ring-offset-2 ring-blue-600 scale-110 shadow-xl`
    : `shadow-md hover:scale-105`;

  // Contenido interior según estado operativo
  let innerIcon = "";
  if (status === "EN_RUTA") {
    // Flecha direccional orientada según el ángulo de rumbo (bearing)
    innerIcon = `
      <div class="w-full h-full flex items-center justify-center transition-transform duration-300" style="transform: rotate(${Math.round(bearingDegrees)}deg);">
        <svg class="w-4 h-4 text-white drop-shadow-xs" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
        </svg>
      </div>
    `;
  } else if (status === "DETENIDO") {
    // Icono estático de parada/pausa
    innerIcon = `
      <div class="w-full h-full flex items-center justify-center">
        <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="5" width="4" height="14" rx="1"/>
          <rect x="14" y="5" width="4" height="14" rx="1"/>
        </svg>
      </div>
    `;
  } else if (status === "VISITA_VALIDADA") {
    // Check de geocerca verificada
    innerIcon = `
      <div class="w-full h-full flex items-center justify-center">
        <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
    `;
  } else if (status === "DESVIACION") {
    // Signo de exclamación / anomalía
    innerIcon = `
      <div class="w-full h-full flex items-center justify-center">
        <svg class="w-4 h-4 text-white animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
    `;
  } else {
    // Sin conexión / antena inactiva
    innerIcon = `
      <div class="w-full h-full flex items-center justify-center">
        <svg class="w-3.5 h-3.5 text-white opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="1" y1="1" x2="23" y2="23"/>
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
          <line x1="12" y1="20" x2="12.01" y2="20"/>
        </svg>
      </div>
    `;
  }

  return `
    <div class="relative flex items-center justify-center w-9 h-9">
      ${pulseRing}
      <div 
        class="relative w-8 h-8 rounded-full flex items-center justify-center border-2 border-white transition-all duration-300 ${selectedBorder}"
        style="background-color: ${color};"
        title="${seller.sellerName} (${config.label})"
      >
        ${innerIcon}
      </div>
    </div>
  `;
}

let cachedL: typeof import("leaflet") | null = null;
async function getLeaflet() {
  if (cachedL) return cachedL;
  const LModule = await import("leaflet");
  cachedL = (LModule.default || LModule) as typeof import("leaflet");
  return cachedL;
}

/**
 * Componente que enlaza un marcador de vendedor con la instancia activa de Leaflet.
 * Incorpora animación cinemática continua a 60 FPS con interpolación espacial y angular (TASK-034).
 */
export default function SellerMarker({
  seller,
  map: externalMap,
  onClick,
  isSelected = false,
  enableKinematicAnimation = true,
  animationDurationMs = 1200,
}: SellerMarkerProps) {
  const contextMap = useMapInstance();
  const map = externalMap || contextMap;
  const markerRef = useRef<L.Marker | null>(null);
  const onClickRef = useRef(onClick);
  const sellerRef = useRef(seller);

  // Referencias para interpolación cinemática fluida (60 FPS)
  const currentCoordsRef = useRef<[number, number]>([seller.latitude, seller.longitude]);
  const currentBearingRef = useRef<number>(seller.bearingDegrees);
  const animFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    onClickRef.current = onClick;
    sellerRef.current = seller;
  });

  useEffect(() => {
    if (!map) return;

    let isMounted = true;

    getLeaflet().then((L) => {
      if (!isMounted || !map) return;

      const html = buildSellerMarkerSvg(seller, isSelected, currentBearingRef.current);
      const customIcon = L.divIcon({
        html,
        className: "routrack-seller-marker-icon",
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18],
      });

      if (!markerRef.current) {
        // Inicializar nuevo marcador en la posición inicial
        const marker = L.marker([seller.latitude, seller.longitude], {
          icon: customIcon,
          title: seller.sellerName,
          riseOnHover: true,
        }).addTo(map);

        marker.bindPopup(renderSellerPopupHtml(seller), {
          maxWidth: 300,
          className: "routrack-custom-popup",
        });

        marker.on("click", () => {
          if (onClickRef.current) {
            onClickRef.current(sellerRef.current);
          }
        });

        markerRef.current = marker;
        currentCoordsRef.current = [seller.latitude, seller.longitude];
        currentBearingRef.current = seller.bearingDegrees;
      } else {
        const marker = markerRef.current;
        const targetLat = seller.latitude;
        const targetLng = seller.longitude;
        const targetBearing = seller.bearingDegrees;

        const startLat = currentCoordsRef.current[0];
        const startLng = currentCoordsRef.current[1];
        const startBearing = currentBearingRef.current;

        const deltaLat = targetLat - startLat;
        const deltaLng = targetLng - startLng;
        const approxDist = Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng);

        // Cancelar animación anterior si aún estaba corriendo
        if (animFrameIdRef.current !== null) {
          cancelAnimationFrame(animFrameIdRef.current);
          animFrameIdRef.current = null;
        }

        // Si el cambio es minúsculo o es un salto de teletransportación (> 5km), aplicar directamente
        if (!enableKinematicAnimation || approxDist < 0.000005 || approxDist > 0.05) {
          marker.setLatLng([targetLat, targetLng]);
          marker.setIcon(customIcon);
          marker.setPopupContent(renderSellerPopupHtml(seller));
          currentCoordsRef.current = [targetLat, targetLng];
          currentBearingRef.current = targetBearing;
        } else {
          // Animación cinemática fluida con interpolación cúbica (60 FPS)
          const startTime = performance.now();
          const duration = animationDurationMs;

          // Cálculo del camino más corto para la rotación angular (-180° a 180°)
          const bearingDiff = (((targetBearing - startBearing + 540) % 360) - 180);

          const animateStep = (now: number) => {
            if (!isMounted || !markerRef.current) return;

            const elapsed = now - startTime;
            const progress = Math.min(1.0, elapsed / duration);
            // Easing cúbico (easeOutCubic) para movimiento vehicular orgánico
            const ease = 1.0 - Math.pow(1.0 - progress, 3);

            const interpLat = startLat + deltaLat * ease;
            const interpLng = startLng + deltaLng * ease;
            const interpBearing = (startBearing + bearingDiff * ease + 360) % 360;

            marker.setLatLng([interpLat, interpLng]);
            currentCoordsRef.current = [interpLat, interpLng];
            currentBearingRef.current = interpBearing;

            if (progress < 1.0) {
              animFrameIdRef.current = requestAnimationFrame(animateStep);
            } else {
              // Posición final exacta
              marker.setLatLng([targetLat, targetLng]);
              marker.setIcon(customIcon);
              marker.setPopupContent(renderSellerPopupHtml(seller));
              currentCoordsRef.current = [targetLat, targetLng];
              currentBearingRef.current = targetBearing;
              animFrameIdRef.current = null;
            }
          };

          animFrameIdRef.current = requestAnimationFrame(animateStep);
        }
      }
    });

    return () => {
      isMounted = false;
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [
    map,
    seller.sellerId,
    seller.latitude,
    seller.longitude,
    seller.status,
    seller.bearingDegrees,
    isSelected,
    enableKinematicAnimation,
    animationDurationMs,
  ]);

  // Limpieza final al desmontar el marcador
  useEffect(() => {
    return () => {
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      if (markerRef.current && map) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, [map]);

  return null;
}
