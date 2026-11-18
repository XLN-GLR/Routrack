/**
 * ROUTRACK — Motor de Map-Matching y Snap-to-Roads (TASK-032)
 * Archivo: web-admin/src/lib/map/roadMatching.ts
 *
 * Transforma secuencias de coordenadas GPS crudas con imprecisión satelital
 * en polilíneas viales continuas ajustadas a las calles y avenidas reales de OpenStreetMap ($0 USD).
 *
 * Incorpora:
 * 1. Particionado inteligente en lotes (Chunking) para recorridos extensos (> 70 puntos).
 * 2. Conversión determinista de geometrías GeoJSON [lng, lat] a formato Leaflet [lat, lng].
 * 3. Fallback Geodésico Resiliente: Si OSRM no responde o no hay red, recurre de inmediato
 *    a interpolación geodésica mediante Haversine sin bloquear la interfaz de usuario.
 * 4. Caché en memoria para evitar peticiones redundantes.
 */

import type {
  LatLngTuple,
  RoadMatchedRoute,
  RoadSnappedPoint,
  MapMatchingOptions,
} from "@/types/map";
import {
  matchWithOsrm,
  MAX_OSRM_COORDINATES_PER_CHUNK,
} from "./osrmClient";
import { haversineDistanceMeters } from "../geo/deviations";

// Caché en memoria para optimizar re-renderizados frecuentes en la interfaz
const routeCache = new Map<string, RoadMatchedRoute>();
const MAX_CACHE_SIZE = 100;

/**
 * Genera una clave determinista para la caché en memoria basada en los primeros y últimos puntos.
 */
function generateCacheKey(points: LatLngTuple[], profile: string): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  const mid = points[Math.floor(points.length / 2)];
  return `${profile}_${points.length}_${first[0].toFixed(5)},${first[1].toFixed(5)}_${mid[0].toFixed(5)},${mid[1].toFixed(5)}_${last[0].toFixed(5)},${last[1].toFixed(5)}`;
}

/**
 * Genera una ruta de respaldo puramente geodésica utilizando las coordenadas crudas.
 * Se activa cuando el servicio de mapas en red no está disponible o falla el ruteo.
 */
export function createGeodesicFallbackRoute(points: LatLngTuple[]): RoadMatchedRoute {
  if (!points || points.length === 0) {
    return {
      polyline: [],
      distanceMeters: 0,
      durationSeconds: 0,
      confidence: 0,
      isFallback: true,
      snappedPoints: [],
    };
  }

  let totalDistanceMeters = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalDistanceMeters += haversineDistanceMeters(
      { latitude: points[i][0], longitude: points[i][1] },
      { latitude: points[i + 1][0], longitude: points[i + 1][1] }
    );
  }

  const snappedPoints: RoadSnappedPoint[] = points.map(([lat, lng]) => ({
    latitude: lat,
    longitude: lng,
    originalLatitude: lat,
    originalLongitude: lng,
    confidence: 0.5,
    distanceFromOriginalMeters: 0,
  }));

  // Estimación a velocidad urbana promedio de 25 km/h (~6.94 m/s)
  const durationSeconds = Math.round(totalDistanceMeters / 6.94);

  return {
    polyline: [...points],
    distanceMeters: Math.round(totalDistanceMeters),
    durationSeconds,
    confidence: 0.5,
    isFallback: true,
    snappedPoints,
  };
}

/**
 * Procesa un único lote de coordenadas mediante OSRM Map-Matching.
 */
async function matchSingleChunk(
  chunk: LatLngTuple[],
  options: MapMatchingOptions
): Promise<RoadMatchedRoute | null> {
  const osrmResponse = await matchWithOsrm(chunk, options);
  if (!osrmResponse || !osrmResponse.matchings || osrmResponse.matchings.length === 0) {
    return null;
  }

  const combinedPolyline: LatLngTuple[] = [];
  let totalDistance = 0;
  let totalDuration = 0;
  let avgConfidence = 0;

  for (const match of osrmResponse.matchings) {
    totalDistance += match.distance;
    totalDuration += match.duration;
    avgConfidence += match.confidence;

    if (typeof match.geometry === "object" && Array.isArray(match.geometry.coordinates)) {
      // OSRM GeoJSON retorna [longitude, latitude], convertimos a Leaflet [latitude, longitude]
      for (const [lng, lat] of match.geometry.coordinates) {
        combinedPolyline.push([lat, lng]);
      }
    }
  }

  avgConfidence = avgConfidence / osrmResponse.matchings.length;

  // Extraer puntos ajustados desde tracepoints
  const snappedPoints: RoadSnappedPoint[] = [];
  if (osrmResponse.tracepoints) {
    for (let i = 0; i < osrmResponse.tracepoints.length; i++) {
      const tp = osrmResponse.tracepoints[i];
      const orig = chunk[i];
      if (tp && orig) {
        snappedPoints.push({
          latitude: tp.location[1],
          longitude: tp.location[0],
          originalLatitude: orig[0],
          originalLongitude: orig[1],
          streetName: tp.name || undefined,
          confidence: avgConfidence,
          distanceFromOriginalMeters: tp.distance,
        });
      } else if (orig) {
        snappedPoints.push({
          latitude: orig[0],
          longitude: orig[1],
          originalLatitude: orig[0],
          originalLongitude: orig[1],
          confidence: 0.3,
          distanceFromOriginalMeters: 0,
        });
      }
    }
  }

  return {
    polyline: combinedPolyline.length > 0 ? combinedPolyline : [...chunk],
    distanceMeters: Math.round(totalDistance),
    durationSeconds: Math.round(totalDuration),
    confidence: Math.round(avgConfidence * 100) / 100,
    isFallback: false,
    snappedPoints,
  };
}

/**
 * Ajusta una lista arbitraria de coordenadas GPS a la red vial física de OpenStreetMap.
 * Maneja particionado automático si la lista excede el límite por solicitud y activa
 * fallback geodésico si el servicio en línea no responde.
 *
 * @param coordinates Lista de puntos en formato [lat, lng]
 * @param options Opciones de configuración
 * @returns RoadMatchedRoute consolidada
 */
export async function snapCoordinatesToRoads(
  coordinates: LatLngTuple[],
  options: MapMatchingOptions = {}
): Promise<RoadMatchedRoute> {
  // Validación de entrada
  if (!coordinates || coordinates.length < 2) {
    return createGeodesicFallbackRoute(coordinates || []);
  }

  const profile = options.profile || "driving";
  const cacheKey = generateCacheKey(coordinates, profile);

  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey)!;
  }

  // Si la cantidad de puntos cabe en un único bloque, procesar directamente
  if (coordinates.length <= MAX_OSRM_COORDINATES_PER_CHUNK) {
    const singleResult = await matchSingleChunk(coordinates, options);
    const result = singleResult || createGeodesicFallbackRoute(coordinates);

    // Guardar en caché
    if (routeCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = routeCache.keys().next().value;
      if (oldestKey) routeCache.delete(oldestKey);
    }
    routeCache.set(cacheKey, result);

    return result;
  }

  // Particionado en lotes con solapamiento de 1 punto para garantizar continuidad vial
  const chunkSize = MAX_OSRM_COORDINATES_PER_CHUNK - 2;
  const chunkPromises: Promise<RoadMatchedRoute | null>[] = [];

  for (let i = 0; i < coordinates.length; i += chunkSize) {
    const end = Math.min(i + chunkSize + 1, coordinates.length);
    const chunk = coordinates.slice(i, end);
    if (chunk.length >= 2) {
      chunkPromises.push(matchSingleChunk(chunk, options));
    }
  }

  try {
    const chunkResults = await Promise.all(chunkPromises);

    // Si algún bloque crítico falla, evaluar si combinamos o usamos fallback global
    const successfulChunks = chunkResults.filter(
      (r): r is RoadMatchedRoute => r !== null
    );

    if (successfulChunks.length === 0) {
      return createGeodesicFallbackRoute(coordinates);
    }

    // Combinar polilíneas y métricas de todos los bloques
    const combinedPolyline: LatLngTuple[] = [];
    const combinedSnapped: RoadSnappedPoint[] = [];
    let totalDist = 0;
    let totalDur = 0;
    let totalConf = 0;

    for (let c = 0; c < chunkResults.length; c++) {
      const res = chunkResults[c];
      if (res) {
        combinedPolyline.push(...res.polyline);
        combinedSnapped.push(...res.snappedPoints);
        totalDist += res.distanceMeters;
        totalDur += res.durationSeconds;
        totalConf += res.confidence;
      } else {
        // Si este bloque particular falló, usar su segmento geodésico
        const startIdx = c * chunkSize;
        const endIdx = Math.min(startIdx + chunkSize + 1, coordinates.length);
        const fallbackChunk = createGeodesicFallbackRoute(
          coordinates.slice(startIdx, endIdx)
        );
        combinedPolyline.push(...fallbackChunk.polyline);
        combinedSnapped.push(...fallbackChunk.snappedPoints);
        totalDist += fallbackChunk.distanceMeters;
        totalDur += fallbackChunk.durationSeconds;
      }
    }

    const finalResult: RoadMatchedRoute = {
      polyline: combinedPolyline,
      distanceMeters: totalDist,
      durationSeconds: totalDur,
      confidence:
        Math.round((totalConf / Math.max(1, successfulChunks.length)) * 100) / 100,
      isFallback: successfulChunks.length < chunkResults.length,
      snappedPoints: combinedSnapped,
    };

    routeCache.set(cacheKey, finalResult);
    return finalResult;
  } catch {
    return createGeodesicFallbackRoute(coordinates);
  }
}

/**
 * Limpia la caché en memoria de rutas ajustadas (útil para pruebas unitarias).
 */
export function clearRoadMatchingCache(): void {
  routeCache.clear();
}
