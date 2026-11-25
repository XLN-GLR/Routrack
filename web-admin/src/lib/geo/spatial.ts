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
