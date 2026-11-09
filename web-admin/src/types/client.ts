/**
 * ROUTRACK — Tipos y Modelos de Dominio para Gestión de Clientes
 * Archivo: web-admin/src/types/client.ts
 *
 * Cumple con el esquema de la tabla `clientes` de PostgreSQL / PostGIS:
 *  - Clave primaria UUID
 *  - Geometría Point WGS84 (SRID 4326)
 *  - Radio de tolerancia de geocerca en metros
 *  - Validaciones estrictas sin uso de `any`
 */

export interface Client {
  id: string;
  organizacion_id: string;
  nombre: string;
  nombre_comercial: string | null;
  identificacion_fiscal: string;
  direccion: string;
  telefono: string | null;
  latitud: number;
  longitud: number;
  radio_tolerancia_metros: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientFormData {
  nombre: string;
  nombre_comercial?: string | null;
  identificacion_fiscal: string;
  direccion: string;
  telefono?: string | null;
  latitud: number;
  longitud: number;
  radio_tolerancia_metros: number;
  activo: boolean;
}

/**
 * Representación cruda devuelta por PostgreSQL / PostGIS para la tabla `clientes`.
 * En PostGIS, la columna `ubicacion` es `GEOMETRY(Point, 4326)`.
 */
export interface ClientPostGISRow {
  id: string;
  organizacion_id: string;
  nombre: string;
  nombre_comercial: string | null;
  identificacion_fiscal: string | null;
  direccion: string;
  telefono: string | null;
  ubicacion: string | { type: string; coordinates: [number, number] };
  radio_tolerancia_metros: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Convierte coordenadas latitud / longitud al formato estándar WKT (Well-Known Text)
 * de PostGIS: `POINT(longitud latitud)`.
 * NOTA CRÍTICA: En WKT la coordenada X es Longitud y la Y es Latitud.
 */
export function formatToWKTPoint(latitud: number, longitud: number): string {
  return `POINT(${longitud.toFixed(6)} ${latitud.toFixed(6)})`;
}

/**
 * Parsea una cadena WKT tipo `POINT(lng lat)` o `SRID=4326;POINT(lng lat)`
 * y retorna `{ lat: number, lng: number }` con precisión numérica.
 */
export function parseWKTPoint(wkt: string): { lat: number; lng: number } | null {
  if (!wkt || typeof wkt !== "string") return null;

  // Soporta formatos: 'POINT(-78.4678 -0.1806)' o 'SRID=4326;POINT(-78.4678 -0.1806)'
  const pointMatch = wkt.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
  if (!pointMatch) return null;

  const lng = Number.parseFloat(pointMatch[1]);
  const lat = Number.parseFloat(pointMatch[2]);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
}

/**
 * Convierte un registro crudo de PostGIS a la interfaz de dominio `Client`.
 */
export function mapPostGISToClient(row: ClientPostGISRow): Client {
  let latitud = 0;
  let longitud = 0;

  if (typeof row.ubicacion === "string") {
    const parsed = parseWKTPoint(row.ubicacion);
    if (parsed) {
      latitud = parsed.lat;
      longitud = parsed.lng;
    }
  } else if (
    row.ubicacion &&
    typeof row.ubicacion === "object" &&
    Array.isArray(row.ubicacion.coordinates) &&
    row.ubicacion.coordinates.length >= 2
  ) {
    longitud = row.ubicacion.coordinates[0];
    latitud = row.ubicacion.coordinates[1];
  }

  return {
    id: row.id,
    organizacion_id: row.organizacion_id,
    nombre: row.nombre,
    nombre_comercial: row.nombre_comercial ?? null,
    identificacion_fiscal: row.identificacion_fiscal ?? "",
    direccion: row.direccion,
    telefono: row.telefono ?? null,
    latitud,
    longitud,
    radio_tolerancia_metros: row.radio_tolerancia_metros ?? 50,
    activo: row.activo ?? true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Formatea coordenadas para visualización en tablas o tarjetas (ej. "-0.180653°, -78.467834°").
 */
export function formatCoordinatesDisplay(lat: number, lng: number): string {
  const latSign = lat >= 0 ? "N" : "S";
  const lngSign = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(5)}° ${latSign}, ${Math.abs(lng).toFixed(5)}° ${lngSign}`;
}

