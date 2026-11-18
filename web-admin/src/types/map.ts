/**
 * ROUTRACK — Definiciones de Tipos Geoespaciales y Map-Matching (TASK-032)
 * Archivo: web-admin/src/types/map.ts
 *
 * Especifica los contratos de datos para la ingesta de coordenadas GPS crudas,
 * el procesamiento de ajuste a calles (Snap-to-Roads), las respuestas del motor OSRM
 * y la representación de polilíneas viales continuas para mapas Leaflet.
 */

export interface LatLngPair {
  lat: number;
  lng: number;
}

/** Tupla estándar [lat, lng] utilizada por Leaflet */
export type LatLngTuple = [number, number];

/** Punto geográfico individual ajustado al eje vial físico */
export interface RoadSnappedPoint {
  latitude: number;
  longitude: number;
  originalLatitude?: number;
  originalLongitude?: number;
  streetName?: string;
  confidence?: number;
  distanceFromOriginalMeters?: number;
}

/** Resultado consolidado del ajuste vial sobre una trayectoria completa */
export interface RoadMatchedRoute {
  /** Secuencia de puntos [lat, lng] que forman el trazado vial continuo */
  polyline: LatLngTuple[];
  /** Distancia total del trazado en metros */
  distanceMeters: number;
  /** Duración estimada del trayecto en segundos */
  durationSeconds: number;
  /** Nivel de confianza del ajuste vial (0.0 a 1.0) */
  confidence: number;
  /** Indica si se utilizó el algoritmo geodésico de respaldo por indisponibilidad de OSRM */
  isFallback: boolean;
  /** Vértices o puntos de control ajustados a la calzada */
  snappedPoints: RoadSnappedPoint[];
}

/** Parámetros de configuración para el procesamiento de Map-Matching */
export interface MapMatchingOptions {
  /** Perfil de movilidad (por defecto 'driving') */
  profile?: "driving" | "bike" | "walking";
  /** Nivel de detalle de la geometría ('full', 'simplified', 'false') */
  overview?: "full" | "simplified" | "false";
  /** Formato de geometría retornado por el motor ('geojson' o 'polyline') */
  geometries?: "geojson" | "polyline";
  /** Si se solicitan instrucciones giro a giro */
  steps?: boolean;
  /** Marcas de tiempo UNIX en segundos para ayudar al algoritmo de HMM */
  timestamps?: number[];
  /** Radio de búsqueda en metros por punto (por defecto 25-50m) */
  radiuses?: number[];
  /** Tiempo límite de espera en milisegundos antes de activar fallback */
  timeoutMs?: number;
}

/** Punto de traza retornado por la API REST de OSRM */
export interface OsrmTracepoint {
  location: [number, number]; // [lng, lat]
  name: string;
  matchings_index?: number;
  waypoint_index?: number;
  distance?: number;
  alternatives_count?: number;
}

/** Segmento de coincidencia vial retornado por OSRM */
export interface OsrmMatching {
  confidence: number;
  geometry:
    | {
        coordinates: [number, number][]; // GeoJSON [lng, lat]
        type: string;
      }
    | string;
  distance: number;
  duration: number;
  weight_name?: string;
  weight?: number;
}

/** Respuesta estándar del endpoint /match/v1/ de OSRM */
export interface OsrmMatchResponse {
  code: string; // 'Ok', 'NoMatch', 'InvalidUrl', 'TooBig', etc.
  matchings?: OsrmMatching[];
  tracepoints?: (OsrmTracepoint | null)[];
  message?: string;
}
