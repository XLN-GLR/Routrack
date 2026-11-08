"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import type L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, ZoomIn, ZoomOut, Layers } from "lucide-react";

export interface MapViewProps {
  center?: [number, number];
  zoom?: number;
  tileUrl?: string;
  attribution?: string;
  minZoom?: number;
  maxZoom?: number;
  className?: string;
  showControls?: boolean;
  onMapReady?: (map: L.Map) => void;
  children?: React.ReactNode;
}

// Coordenadas geográficas por defecto: Quito, Pichincha, Ecuador (Capital Operativa)
export const DEFAULT_MAP_CENTER: [number, number] = [-0.180653, -78.467834];
export const DEFAULT_MAP_ZOOM = 13;
export const DEFAULT_TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_PROVIDER_URL ||
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const DEFAULT_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Componente modular de mapa interactivo con Leaflet y OpenStreetMap (Costo $0 USD).
 *
 * Diseñado para operar exclusivamente en el cliente evitando errores de hidratación SSR.
 * Configura las teselas de OpenStreetMap respetando variables de entorno y ofrece
 * controles de zoom, recentrado táctil y soporte para capas de telemetría en tiempo real.
 */
export default function MapView({
  center = DEFAULT_MAP_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
  tileUrl = DEFAULT_TILE_URL,
  attribution = DEFAULT_ATTRIBUTION,
  minZoom = 3,
  maxZoom = 19,
  className = "w-full h-full min-h-[450px]",
  showControls = true,
  onMapReady,
  children,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Inicializar Leaflet y el contenedor
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    let isMounted = true;

    import("leaflet").then((LModule) => {
      if (!isMounted || !mapContainerRef.current) return;

      const L = LModule.default || LModule;

      // Corregir rutas de iconos de marcadores por defecto en Webpack/Next.js
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Crear instancia de mapa deshabilitando controles por defecto para UI unificada
      const map = L.map(mapContainerRef.current, {
        center,
        zoom,
        minZoom,
        maxZoom,
        zoomControl: false, // Usamos controles personalizados de ROUTRACK
        attributionControl: false,
      });

      // Agregar capa de teselas (OpenStreetMap u otro proveedor configurado en .env)
      const tileLayer = L.tileLayer(tileUrl, {
        attribution,
        maxZoom,
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      // Agregar atribución discreta en esquina inferior derecha
      L.control
        .attribution({
          position: "bottomright",
          prefix: false,
        })
        .addAttribution(attribution)
        .addTo(map);

      mapInstanceRef.current = map;
      setIsReady(true);

      // Invalida tamaño para asegurar renderizado correcto en contenedores dinámicos
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 200);

      if (onMapReady) {
        onMapReady(map);
      }
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, [attribution, center, maxZoom, minZoom, onMapReady, tileUrl, zoom]);

  // Actualizar vista si cambia el centro programáticamente
  useEffect(() => {
    if (mapInstanceRef.current && isReady) {
      mapInstanceRef.current.setView(center, zoom, { animate: true });
    }
  }, [center, isReady, zoom]);

  // Controladores interactivos personalizados
  const handleZoomIn = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  }, []);

  const handleRecenter = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(center, zoom, {
        animate: true,
        duration: 1.2,
      });
    }
  }, [center, zoom]);

  return (
    <div className={`relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 ${className}`}>
      {/* Contenedor del Canvas Leaflet */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[inherit] z-0" />

      {/* Controles Flotantes Interactivos (Zoom y Recenter) */}
      {showControls && isReady && (
        <div className="absolute top-4 right-4 z-[400] flex flex-col gap-1.5 shadow-md">
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label="Acercar mapa"
            title="Acercar"
            className="flex h-9 w-9 items-center justify-center rounded-t-lg bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 border border-slate-200 transition-colors"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            aria-label="Alejar mapa"
            title="Alejar"
            className="flex h-9 w-9 items-center justify-center bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 border-x border-b border-slate-200 transition-colors"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleRecenter}
            aria-label="Centrar vista de mapa"
            title="Centrar en posición base"
            className="flex h-9 w-9 items-center justify-center rounded-b-lg bg-white text-blue-600 hover:bg-blue-50 active:bg-blue-100 border-x border-b border-slate-200 transition-colors"
          >
            <LocateFixed className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Capa de Información de Proveedor de Mapa */}
      <div className="absolute bottom-2 left-2 z-[400] pointer-events-none">
        <div className="flex items-center gap-1.5 rounded-md bg-white/90 backdrop-blur-xs px-2 py-1 text-[10px] font-medium text-slate-600 border border-slate-200 shadow-xs">
          <Layers className="h-3 w-3 text-blue-600" />
          <span>OpenStreetMap (WGS 84)</span>
        </div>
      </div>

      {/* Contenido / Marcadores inyectados como hijos */}
      {children}
    </div>
  );
}
