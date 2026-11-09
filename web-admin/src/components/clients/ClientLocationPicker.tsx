"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import type L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation, Locate, AlertCircle } from "lucide-react";

interface ClientLocationPickerProps {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  onChange: (latitude: number, longitude: number) => void;
  onRadiusChange?: (radiusMeters: number) => void;
  readonly?: boolean;
  height?: string;
  zoom?: number;
}

// Centro por defecto: Quito, Pichincha, Ecuador (Capital Operativa)
const DEFAULT_CENTER: [number, number] = [-0.180653, -78.467834];

/**
 * Componente interactivo para georreferenciación de clientes en Leaflet.
 *
 * Permite seleccionar coordenadas mediante:
 * 1. Clic directo sobre el mapa cartográfico OpenStreetMap.
 * 2. Arrastre continuo del pin del cliente (draggable marker).
 * 3. Captura satelital instantánea vía geolocalización del navegador.
 * 4. Ajuste numérico manual de latitud y longitud.
 *
 * Dibuja en tiempo real la geocerca circular (`L.circle`) con el radio de tolerancia en metros.
 */
export default function ClientLocationPicker({
  latitude,
  longitude,
  radiusMeters,
  onChange,
  readonly = false,
  height = "320px",
  zoom = 16,
}: ClientLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Determinar posición inicial válida
  const initialLat = Number.isFinite(latitude) && latitude !== 0 ? latitude : DEFAULT_CENTER[0];
  const initialLng = Number.isFinite(longitude) && longitude !== 0 ? longitude : DEFAULT_CENTER[1];

  // Callback estable para propagar cambios de coordenadas
  const handlePositionChange = useCallback(
    (lat: number, lng: number) => {
      const roundedLat = Number(lat.toFixed(6));
      const roundedLng = Number(lng.toFixed(6));
      onChange(roundedLat, roundedLng);
    },
    [onChange]
  );

  // Inicializar mapa de Leaflet
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let isMounted = true;

    import("leaflet").then((LModule) => {
      if (!isMounted || !containerRef.current) return;
      const L = LModule.default || LModule;

      // Corregir icono por defecto de Leaflet
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Crear icono personalizado corporativo para el cliente
      const clientPinIcon = L.divIcon({
        className: "custom-client-picker-pin",
        html: `
          <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 36px; height: 36px; border-radius: 9999px; background-color: rgba(37, 99, 235, 0.25); animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
            <div style="width: 28px; height: 28px; border-radius: 9999px; background: linear-gradient(135deg, #2563EB, #1D4ED8); border: 2.5px solid #FFFFFF; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      // Instanciar mapa
      const map = L.map(containerRef.current, {
        center: [initialLat, initialLng],
        zoom,
        zoomControl: false,
        attributionControl: false,
      });

      // Capa de teselas OpenStreetMap
      const tileUrl =
        process.env.NEXT_PUBLIC_MAP_TILE_PROVIDER_URL ||
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

      L.tileLayer(tileUrl, {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      // Atribución discreta
      L.control
        .attribution({ position: "bottomright", prefix: false })
        .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>')
        .addTo(map);

      // Crear Geocerca circular de tolerancia
      const circle = L.circle([initialLat, initialLng], {
        radius: Math.max(10, radiusMeters || 50),
        color: "#2563EB",
        fillColor: "#3B82F6",
        fillOpacity: 0.18,
        weight: 2,
        dashArray: "4, 4",
      }).addTo(map);
      circleRef.current = circle;

      // Crear Marcador de cliente
      const marker = L.marker([initialLat, initialLng], {
        icon: clientPinIcon,
        draggable: !readonly,
        title: "Punto de Venta del Cliente",
      }).addTo(map);
      markerRef.current = marker;

      // Evento de arrastre del marcador
      if (!readonly) {
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          circle.setLatLng(pos);
          handlePositionChange(pos.lat, pos.lng);
        });

        // Evento de clic sobre el mapa para reposicionar
        map.on("click", (e: L.LeafletMouseEvent) => {
          const { lat, lng } = e.latlng;
          marker.setLatLng([lat, lng]);
          circle.setLatLng([lat, lng]);
          handlePositionChange(lat, lng);
        });
      }

      mapRef.current = map;

      // Invalida tamaño para asegurar renderizado correcto
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 150);
    });

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
    };
  }, [handlePositionChange, initialLat, initialLng, readonly, zoom, radiusMeters]);

  // Actualizar posición y radio si cambian desde las props externas
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !circleRef.current) return;

    if (Number.isFinite(latitude) && Number.isFinite(longitude) && (latitude !== 0 || longitude !== 0)) {
      const currentPos = markerRef.current.getLatLng();
      const distThreshold = 0.00001;

      if (
        Math.abs(currentPos.lat - latitude) > distThreshold ||
        Math.abs(currentPos.lng - longitude) > distThreshold
      ) {
        markerRef.current.setLatLng([latitude, longitude]);
        circleRef.current.setLatLng([latitude, longitude]);
        mapRef.current.panTo([latitude, longitude], { animate: true });
      }
    }

    if (Number.isFinite(radiusMeters) && radiusMeters > 0) {
      circleRef.current.setRadius(radiusMeters);
    }
  }, [latitude, longitude, radiusMeters]);

  // Botón: Recentrar mapa en el punto seleccionado
  const handleRecenter = () => {
    if (mapRef.current && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      mapRef.current.setView([latitude, longitude], zoom, { animate: true });
    }
  };

  // Botón: Capturar ubicación actual del dispositivo/navegador
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("La geolocalización no está soportada por su navegador.");
      return;
    }

    setIsLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude: userLat, longitude: userLng } = pos.coords;
        handlePositionChange(userLat, userLng);

        if (mapRef.current && markerRef.current && circleRef.current) {
          markerRef.current.setLatLng([userLat, userLng]);
          circleRef.current.setLatLng([userLat, userLng]);
          mapRef.current.setView([userLat, userLng], 17, { animate: true });
        }
      },
      (err) => {
        setIsLocating(false);
        setGeoError(`Error de geolocalización: ${err.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl border border-slate-200 overflow-hidden shadow-xs bg-slate-100">
        <div ref={containerRef} style={{ height, width: "100%" }} />

        {/* Barra superior de controles flotantes */}
        <div className="absolute top-2 right-2 z-[500] flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleRecenter}
            title="Recentrar en las coordenadas del cliente"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 text-slate-700 shadow-md backdrop-blur-xs transition hover:bg-white hover:text-blue-600 focus:outline-hidden"
          >
            <Locate className="h-4 w-4" />
          </button>

          {!readonly && (
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              title="Obtener coordenadas desde GPS del dispositivo"
              className="flex items-center gap-1.5 rounded-lg bg-blue-600/95 px-2.5 py-1.5 text-xs font-medium text-white shadow-md backdrop-blur-xs transition hover:bg-blue-600 focus:outline-hidden disabled:opacity-50"
            >
              <Navigation className={`h-3.5 w-3.5 ${isLocating ? "animate-spin" : ""}`} />
              <span>{isLocating ? "Obteniendo..." : "Mi Ubicación"}</span>
            </button>
          )}
        </div>

        {/* Indicador de ayuda al pie del mapa */}
        {!readonly && (
          <div className="absolute bottom-2 left-2 z-[500] rounded-md bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur-xs border border-slate-200/80">
            Haz clic o arrastra el marcador para fijar las coordenadas exactas
          </div>
        )}
      </div>

      {geoError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{geoError}</span>
        </div>
      )}

      {/* Inputs sincronizados de precisión decimal */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Latitud (WGS84)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.000001"
              value={Number.isFinite(latitude) ? latitude : ""}
              onChange={(e) => {
                const val = Number.parseFloat(e.target.value);
                if (!Number.isNaN(val)) {
                  handlePositionChange(val, longitude);
                }
              }}
              disabled={readonly}
              placeholder="-0.180653"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-800 shadow-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Longitud (WGS84)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.000001"
              value={Number.isFinite(longitude) ? longitude : ""}
              onChange={(e) => {
                const val = Number.parseFloat(e.target.value);
                if (!Number.isNaN(val)) {
                  handlePositionChange(latitude, val);
                }
              }}
              disabled={readonly}
              placeholder="-78.467834"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-800 shadow-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

