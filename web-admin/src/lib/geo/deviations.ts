/**
 * ROUTRACK — Módulo de Procesamiento Geoespacial, Detección de Desvíos y Métricas de Ruta
 * Archivo: web-admin/src/lib/geo/deviations.ts
 *
 * Implementa las fórmulas geodésicas Haversine, cálculo de distancias acumuladas,
 * detección de desvíos (> 300m) respecto al corredor de clientes y métricas operativas de jornada.
 */

export const EARTH_RADIUS_METERS = 6371000;
export const DEFAULT_DEVIATION_THRESHOLD_METERS = 300;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface RoutePoint extends GeoPoint {
  id: string;
  shiftId: string;
  accuracyMeters: number;
  speedKmh?: number;
  altitudeMeters?: number;
  bearingDegrees?: number;
  batteryLevel?: number;
  isMock: boolean;
  recordedAt: string; // ISO 8601
}

export interface RouteStop extends GeoPoint {
  id: string;
  name: string;
  address?: string;
  toleranceRadiusMeters: number;
  plannedOrder?: number;
  visitedAt?: string;
  isVerified?: boolean;
}

export interface DeviationPoint {
  pointIndex: number;
  point: RoutePoint;
  nearestStopId?: string;
  nearestStopName?: string;
  deviationMeters: number;
  thresholdMeters: number;
}

export interface DeviationSegment {
  id: string;
  startIndex: number;
  endIndex: number;
  points: RoutePoint[];
  maxDeviationMeters: number;
  averageDeviationMeters: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export interface RouteMetrics {
  totalDistanceKm: number;
  durationFormatted: string;
  durationMinutes: number;
  startTimeFormatted: string;
  endTimeFormatted: string;
  pointCount: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
  deviationCount: number;
  totalDeviatedKm: number;
}

/**
 * Convierte grados sexagesimales a radianes.
 */
export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calcula la distancia geodésica exacta entre dos puntos mediante la fórmula de Haversine.
 */
export function haversineDistanceMeters(pointA: GeoPoint, pointB: GeoPoint): number {
  const phi1 = degreesToRadians(pointA.latitude);
  const phi2 = degreesToRadians(pointB.latitude);
  const deltaPhi = degreesToRadians(pointB.latitude - pointA.latitude);
  const deltaLambda = degreesToRadians(pointB.longitude - pointA.longitude);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Ordena cronológicamente un conjunto de puntos de telemetría GPS según recordedAt.
 * Cumple con el Criterio 1: Cero deformaciones espaciales por reordenamiento temporal.
 */
export function sortPointsChronologically(points: RoutePoint[]): RoutePoint[] {
  return [...points].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );
}

/**
 * Calcula la distancia total acumulada de una secuencia de puntos de ruta en kilómetros.
 */
export function calculateTotalDistanceKm(points: GeoPoint[]): number {
  if (points.length < 2) return 0.0;
  let totalMeters = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalMeters += haversineDistanceMeters(points[i], points[i + 1]);
  }
  return Math.round((totalMeters / 1000) * 100) / 100;
}

/**
 * Detecta todos los puntos individuales que exceden el umbral de desvío respecto a las paradas autorizadas.
 */
export function detectDeviatedPoints(
  routePoints: RoutePoint[],
  referenceStops: RouteStop[],
  thresholdMeters: number = DEFAULT_DEVIATION_THRESHOLD_METERS
): DeviationPoint[] {
  if (referenceStops.length === 0 || routePoints.length === 0) {
    return [];
  }

  const deviations: DeviationPoint[] = [];

  routePoints.forEach((point, index) => {
    let minDistance = Number.POSITIVE_INFINITY;
    let nearestStop: RouteStop | null = null;

    for (const stop of referenceStops) {
      const distance = haversineDistanceMeters(point, stop);
      if (distance < minDistance) {
        minDistance = distance;
        nearestStop = stop;
      }
    }

    if (minDistance > thresholdMeters) {
      deviations.push({
        pointIndex: index,
        point,
        nearestStopId: nearestStop?.id,
        nearestStopName: nearestStop?.name,
        deviationMeters: Math.round(minDistance * 100) / 100,
        thresholdMeters,
      });
    }
  });

  return deviations;
}

/**
 * Agrupa puntos desviados contiguos en segmentos continuos para trazado visual resaltado en el mapa.
 */
export function groupIntoDeviationSegments(
  deviatedPoints: DeviationPoint[],
  allPoints: RoutePoint[]
): DeviationSegment[] {
  if (deviatedPoints.length === 0) return [];

  const segments: DeviationSegment[] = [];
  let currentGroup: DeviationPoint[] = [deviatedPoints[0]];

  for (let i = 1; i < deviatedPoints.length; i++) {
    const prev = deviatedPoints[i - 1];
    const curr = deviatedPoints[i];

    // Si los índices son consecutivos o tienen a lo más un punto intermedio de diferencia
    if (curr.pointIndex - prev.pointIndex <= 2) {
      currentGroup.push(curr);
    } else {
      segments.push(createSegmentFromGroup(currentGroup, allPoints, segments.length + 1));
      currentGroup = [curr];
    }
  }

  if (currentGroup.length > 0) {
    segments.push(createSegmentFromGroup(currentGroup, allPoints, segments.length + 1));
  }

  return segments;
}

function createSegmentFromGroup(
  group: DeviationPoint[],
  allPoints: RoutePoint[],
  idNum: number
): DeviationSegment {
  const startIndex = Math.max(0, group[0].pointIndex - 1);
  const endIndex = Math.min(allPoints.length - 1, group[group.length - 1].pointIndex + 1);
  const points = allPoints.slice(startIndex, endIndex + 1);

  const deviations = group.map((g) => g.deviationMeters);
  const maxDev = Math.max(...deviations);
  const avgDev = Math.round((deviations.reduce((a, b) => a + b, 0) / deviations.length) * 100) / 100;

  const startTime = points[0].recordedAt;
  const endTime = points[points.length - 1].recordedAt;
  const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
  const durationMinutes = Math.max(1, Math.round(durationMs / 60000));

  return {
    id: `dev-segment-${idNum}`,
    startIndex,
    endIndex,
    points,
    maxDeviationMeters: maxDev,
    averageDeviationMeters: avgDev,
    startTime,
    endTime,
    durationMinutes,
  };
}

/**
 * Calcula las métricas consolidadas de la jornada: distancia total, duración, velocidades y desvíos.
 * Cumple con el Criterio 3 de TASK-016.
 */
export function calculateRouteMetrics(
  routePoints: RoutePoint[],
  referenceStops: RouteStop[] = [],
  thresholdMeters: number = DEFAULT_DEVIATION_THRESHOLD_METERS
): RouteMetrics {
  if (routePoints.length === 0) {
    return {
      totalDistanceKm: 0.0,
      durationFormatted: "0h 00m",
      durationMinutes: 0,
      startTimeFormatted: "--:--",
      endTimeFormatted: "--:--",
      pointCount: 0,
      averageSpeedKmh: 0.0,
      maxSpeedKmh: 0.0,
      deviationCount: 0,
      totalDeviatedKm: 0.0,
    };
  }

  const sorted = sortPointsChronologically(routePoints);
  const totalDistanceKm = calculateTotalDistanceKm(sorted);

  const startMs = new Date(sorted[0].recordedAt).getTime();
  const endMs = new Date(sorted[sorted.length - 1].recordedAt).getTime();
  const totalMinutes = Math.max(0, Math.floor((endMs - startMs) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const durationFormatted = `${hours}h ${minutes.toString().padStart(2, "0")}m`;

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("es-EC", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return "--:--";
    }
  };

  const startTimeFormatted = formatTime(sorted[0].recordedAt);
  const endTimeFormatted = formatTime(sorted[sorted.length - 1].recordedAt);

  const speeds = sorted
    .map((p) => p.speedKmh)
    .filter((s): s is number => typeof s === "number" && !isNaN(s) && s > 0);
  const maxSpeedKmh = speeds.length > 0 ? Math.max(...speeds) : 0.0;
  const averageSpeedKmh =
    speeds.length > 0
      ? Math.round((speeds.reduce((a, b) => a + b, 0) / speeds.length) * 10) / 10
      : 0.0;

  const deviatedPoints = detectDeviatedPoints(sorted, referenceStops, thresholdMeters);
  const deviationSegments = groupIntoDeviationSegments(deviatedPoints, sorted);

  let totalDeviatedKm = 0;
  deviationSegments.forEach((seg) => {
    totalDeviatedKm += calculateTotalDistanceKm(seg.points);
  });

  return {
    totalDistanceKm,
    durationFormatted,
    durationMinutes: totalMinutes,
    startTimeFormatted,
    endTimeFormatted,
    pointCount: sorted.length,
    averageSpeedKmh,
    maxSpeedKmh,
    deviationCount: deviationSegments.length,
    totalDeviatedKm: Math.round(totalDeviatedKm * 100) / 100,
  };
}

/**
 * Calcula el Bounding Box (límites geográficos) para encuadrar la polilínea en Leaflet.
 */
export function calculateRouteBoundingBox(points: GeoPoint[]): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} | null {
  if (points.length === 0) return null;

  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLng = points[0].longitude;
  let maxLng = points[0].longitude;

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLng) minLng = p.longitude;
    if (p.longitude > maxLng) maxLng = p.longitude;
  }

  return { minLat, maxLat, minLng, maxLng };
}

