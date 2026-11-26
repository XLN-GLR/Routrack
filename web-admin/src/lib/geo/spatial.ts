/**
 * ROUTRACK — Utilidades Geoespaciales y Decodificador PostGIS (WKB / EWKB / WKT / GeoJSON)
 * Archivo: web-admin/src/lib/geo/spatial.ts
 */

export type LatLngPair = [number, number];

/**
 * Decodifica una cadena hexadecimal WKB o EWKB de PostGIS (SRID 4326 Point) a [latitud, longitud].
 * PostgREST devuelve por defecto columnas GEOMETRY(Point, 4326) en formato hexadecimal EWKB,
 * p. ej.: "0101000020E6100000..." (little-endian con SRID embebido).
 */
export function decodePostgisEwkbHexPoint(hex: string): LatLngPair | null {
  const clean = hex.trim();
  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length < 42 || clean.length % 2 !== 0) {
    return null;
  }

  const byteLen = clean.length / 2;
  const bytes = new Uint8Array(byteLen);
  for (let i = 0; i < byteLen; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }

  const view = new DataView(bytes.buffer);
  const byteOrder = view.getUint8(0);
  const littleEndian = byteOrder === 1;
  if (byteOrder !== 0 && byteOrder !== 1) {
    return null;
  }

  const rawType = view.getUint32(1, littleEndian);
  const hasSrid = (rawType & 0x20000000) !== 0;
  const geometryType = rawType & 0x0fffffff;
  // WKB tipo 1 = Point (puede traer bits Z/M adicionales en 2D/3D)
  if ((geometryType & 0xff) !== 1) {
    return null;
  }

  const coordOffset = hasSrid ? 9 : 5;
  if (byteLen < coordOffset + 16) {
    return null;
  }

  const lng = view.getFloat64(coordOffset, littleEndian);
  const lat = view.getFloat64(coordOffset + 8, littleEndian);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return [lat, lng];
}

/**
 * Parsea cualquier representación de punto geográfico emitida por Supabase/PostGIS:
 * - Hexadecimal binario WKB/EWKB ("0101000020E6100000...")
 * - Texto WKT / EWKT ("POINT(lng lat)" o "SRID=4326;POINT(lng lat)")
 * - Objeto GeoJSON ({ type: "Point", coordinates: [lng, lat] })
 */
export function parsePostgisPoint(point: unknown): LatLngPair | null {
  if (!point) return null;

  if (typeof point === "string") {
    const trimmed = point.trim();
    const wktMatch = trimmed.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (wktMatch) {
      const lng = Number.parseFloat(wktMatch[1]);
      const lat = Number.parseFloat(wktMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return [lat, lng];
      }
    }

    return decodePostgisEwkbHexPoint(trimmed);
  }

  if (typeof point === "object" && point !== null && "coordinates" in point) {
    const coords = (point as { coordinates: unknown }).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return [lat, lng];
      }
    }
  }

  return null;
}

/**
 * Calcula la distancia en metros entre dos coordenadas WGS84 mediante la fórmula de Haversine.
 */
export function haversineDistance(p1: LatLngPair, p2: LatLngPair): number {
  const [lat1, lng1] = p1;
  const [lat2, lng2] = p2;
  const r = 6371000; // Radio medio de la Tierra en metros
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return r * c;
}

/**
 * Suaviza y perfecciona estéticamente la trayectoria de una polilínea GPS eliminando zigzags bruscos.
 * Aplica:
 *  1. Filtro de reducción de ruido lateral y rebotes mínimos (< 3 metros).
 *  2. Algoritmo de corte de esquinas de Chaikin para transformar aristas en curvas fluidas y continuas.
 */
export function smoothRoutePolyline(points: LatLngPair[], iterations: number = 2): LatLngPair[] {
  if (points.length <= 2) {
    return points;
  }

  // 1. Filtrar puntos adyacentes excesivamente próximos (ruido de jitter < 3m)
  const deduped: LatLngPair[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = deduped[deduped.length - 1];
    const curr = points[i];
    const dist = haversineDistance(prev, curr);
    // Conservar siempre el último punto o puntos con desplazamiento real >= 3m
    if (dist >= 3.0 || i === points.length - 1) {
      deduped.push(curr);
    }
  }

  if (deduped.length <= 2) {
    return deduped;
  }

  // 2. Aplicar algoritmo de Chaikin para suavizado estético de curvas
  let currentPoints = deduped;
  for (let iter = 0; iter < iterations; iter++) {
    if (currentPoints.length < 3) break;
    const refined: LatLngPair[] = [currentPoints[0]];

    for (let i = 0; i < currentPoints.length - 1; i++) {
      const p0 = currentPoints[i];
      const p1 = currentPoints[i + 1];

      // Q = 0.75 * p0 + 0.25 * p1
      const qLat = 0.75 * p0[0] + 0.25 * p1[0];
      const qLng = 0.75 * p0[1] + 0.25 * p1[1];

      // R = 0.25 * p0 + 0.75 * p1
      const rLat = 0.25 * p0[0] + 0.75 * p1[0];
      const rLng = 0.25 * p0[1] + 0.75 * p1[1];

      refined.push([qLat, qLng]);
      refined.push([rLat, rLng]);
    }

    refined.push(currentPoints[currentPoints.length - 1]);
    currentPoints = refined;
  }

  return currentPoints;
}
