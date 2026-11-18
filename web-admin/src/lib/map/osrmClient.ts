/**
 * ROUTRACK — Cliente HTTP para el Motor de Ruteo y Map-Matching OSRM (TASK-032)
 * Archivo: web-admin/src/lib/map/osrmClient.ts
 *
 * Cliente sin dependencias externas ni costos de infraestructura ($0 USD)
 * que consume la API libre de OSRM (Open Source Routing Machine) sobre cartografía OpenStreetMap.
 */

import type {
  MapMatchingOptions,
  OsrmMatchResponse,
  LatLngTuple,
} from "@/types/map";

export const DEFAULT_OSRM_BASE_URL =
  process.env.NEXT_PUBLIC_OSRM_URL || "https://router.project-osrm.org";

export const MAX_OSRM_COORDINATES_PER_CHUNK = 80;
export const DEFAULT_OSRM_TIMEOUT_MS = 6000;

/**
 * Consulta el servicio de Map-Matching de OSRM para ajustar una secuencia de coordenadas GPS
 * al eje vial físico de OpenStreetMap.
 *
 * @param coordinates Lista de coordenadas en formato Leaflet [latitude, longitude]
 * @param options Opciones de búsqueda y perfil de movilidad
 * @returns OsrmMatchResponse estructurada o null si el servicio no está disponible
 */
export async function matchWithOsrm(
  coordinates: LatLngTuple[],
  options: MapMatchingOptions = {}
): Promise<OsrmMatchResponse | null> {
  if (!coordinates || coordinates.length < 2) {
    return null;
  }

  const profile = options.profile || "driving";
  const overview = options.overview || "full";
  const geometries = options.geometries || "geojson";
  const timeoutMs = options.timeoutMs || DEFAULT_OSRM_TIMEOUT_MS;

  // 1. OSRM exige formato {longitude},{latitude} separado por punto y coma (;)
  const coordsFormatted = coordinates
    .map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`)
    .join(";");

  // 2. Construir URL de la solicitud REST
  const url = new URL(
    `/match/v1/${encodeURIComponent(profile)}/${coordsFormatted}`,
    DEFAULT_OSRM_BASE_URL
  );

  url.searchParams.set("overview", overview);
  url.searchParams.set("geometries", geometries);
  url.searchParams.set("steps", options.steps ? "true" : "false");

  // Radio de tolerancia en metros por punto (35m por defecto para mitigar ruido satelital urbano)
  if (options.radiuses && options.radiuses.length === coordinates.length) {
    url.searchParams.set("radiuses", options.radiuses.join(";"));
  } else {
    // Aplicar radio estándar de 35 metros para cada coordenada
    url.searchParams.set(
      "radiuses",
      new Array(coordinates.length).fill(35).join(";")
    );
  }

  if (options.timestamps && options.timestamps.length === coordinates.length) {
    url.searchParams.set("timestamps", options.timestamps.join(";"));
  }

  // 3. Ejecución protegida con AbortController para respetar el timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as OsrmMatchResponse;
    if (data.code !== "Ok" || !data.matchings || data.matchings.length === 0) {
      return null;
    }

    return data;
  } catch {
    // Si ocurre timeout de red, fallo de DNS o error de servidor, retornar null para activar fallback
    clearTimeout(timeoutId);
    return null;
  }
}
