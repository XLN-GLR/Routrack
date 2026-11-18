"use client";

import { useEffect, useRef, useState } from "react";
import type L from "leaflet";
import { snapCoordinatesToRoads } from "@/lib/map/roadMatching";
import type { LatLngTuple, RoadMatchedRoute } from "@/types/map";
import { useMapInstance } from "./MapView";

export interface RoadSnappedPolylineProps {
  coordinates: LatLngTuple[];
  color?: string;
  weight?: number;
  opacity?: number;
  dashArray?: string;
  map?: L.Map | null;
  onMatched?: (route: RoadMatchedRoute) => void;
  showSnappedVertices?: boolean;
}

let cachedLeaflet: typeof import("leaflet") | null = null;
async function getLeaflet() {
  if (cachedLeaflet) return cachedLeaflet;
  const LModule = await import("leaflet");
  cachedLeaflet = (LModule.default || LModule) as typeof import("leaflet");
  return cachedLeaflet;
}

/**
 * Componente que proyecta una secuencia de coordenadas GPS crudas sobre la red vial física
 * de OpenStreetMap utilizando el motor OSRM ($0 USD), dibujando una polilínea fluida
 * ajustada a calles y avenidas reales de la ciudad.
 */
export default function RoadSnappedPolyline({
  coordinates,
  color = "#2563EB",
  weight = 5,
  opacity = 0.85,
  dashArray,
  map: externalMap,
  onMatched,
  showSnappedVertices = false,
}: RoadSnappedPolylineProps) {
  const contextMap = useMapInstance();
  const map = externalMap || contextMap;

  const polylineRef = useRef<L.Polyline | null>(null);
  const circleMarkersRef = useRef<L.CircleMarker[]>([]);
  const [matchedRoute, setMatchedRoute] = useState<RoadMatchedRoute | null>(null);

  // 1. Ejecutar el Map-Matching sobre OSRM / Fallback geodésico
  useEffect(() => {
    let isMounted = true;

    if (!coordinates || coordinates.length < 2) {
      setMatchedRoute(null);
      return;
    }

    snapCoordinatesToRoads(coordinates, { overview: "full", timeoutMs: 6000 })
      .then((route) => {
        if (!isMounted) return;
        setMatchedRoute(route);
        if (onMatched) {
          onMatched(route);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        // En caso de excepción imprevista, conservar coordenadas crudas
        const fallback: RoadMatchedRoute = {
          polyline: [...coordinates],
          distanceMeters: 0,
          durationSeconds: 0,
          confidence: 0.3,
          isFallback: true,
          snappedPoints: [],
        };
        setMatchedRoute(fallback);
      });

    return () => {
      isMounted = false;
    };
  }, [coordinates, onMatched]);

  // 2. Renderizar o actualizar la polilínea en la capa Leaflet
  useEffect(() => {
    if (!map || !matchedRoute || matchedRoute.polyline.length < 2) return;

    let isMounted = true;

    getLeaflet().then((L) => {
      if (!isMounted || !map) return;

      const pathCoords: [number, number][] = matchedRoute.polyline.map(([lat, lng]) => [lat, lng]);

      // Estilo de la polilínea vial
      const polylineOptions: L.PolylineOptions = {
        color,
        weight,
        opacity,
        lineCap: "round",
        lineJoin: "round",
        dashArray: matchedRoute.isFallback ? dashArray || "6, 8" : undefined,
      };

      if (!polylineRef.current) {
        // Crear nueva polilínea vial ajustada
        const polyline = L.polyline(pathCoords, polylineOptions).addTo(map);
        polylineRef.current = polyline;
      } else {
        // Actualizar geometría existente sin destruir capa Leaflet
        polylineRef.current.setLatLngs(pathCoords);
        polylineRef.current.setStyle(polylineOptions);
      }

      // Limpiar vértices previos si los hubiera
      circleMarkersRef.current.forEach((marker) => marker.remove());
      circleMarkersRef.current = [];

      // Opcionalmente dibujar marcadores sutiles en los vértices ajustados
      if (showSnappedVertices && matchedRoute.snappedPoints.length > 0) {
        matchedRoute.snappedPoints.forEach((pt) => {
          const circle = L.circleMarker([pt.latitude, pt.longitude], {
            radius: 3,
            fillColor: color,
            fillOpacity: 0.9,
            color: "#ffffff",
            weight: 1.5,
          }).addTo(map);
          circleMarkersRef.current.push(circle);
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [map, matchedRoute, color, weight, opacity, dashArray, showSnappedVertices]);

  // 3. Limpieza al desmontar
  useEffect(() => {
    return () => {
      if (polylineRef.current && map) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
      circleMarkersRef.current.forEach((marker) => marker.remove());
      circleMarkersRef.current = [];
    };
  }, [map]);

  return null;
}
