/**
 * ROUTRACK — Runner de Pruebas Geoespaciales y Geodésicas
 * Archivo: web-admin/scripts/run-spatial-tests.mjs
 */

const EARTH_RADIUS_METERS = 6371000;
const DEFAULT_DEVIATION_THRESHOLD_METERS = 300;

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversineDistanceMeters(pointA, pointB) {
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

function isWithinGeofence(point, clientLocation, toleranceMeters = 50) {
  const distance = haversineDistanceMeters(point, clientLocation);
  return distance <= toleranceMeters;
}

function calculateRouteTotalDistanceKm(points) {
  if (points.length < 2) return 0.0;
  let totalMeters = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalMeters += haversineDistanceMeters(points[i], points[i + 1]);
  }
  return Math.round((totalMeters / 1000) * 100) / 100;
}

function detectRouteDeviations(trackingPoints, referenceStops, thresholdMeters = DEFAULT_DEVIATION_THRESHOLD_METERS) {
  if (referenceStops.length === 0 || trackingPoints.length === 0) {
    return [];
  }
  const deviations = [];
  trackingPoints.forEach((point, index) => {
    let minDistance = Number.POSITIVE_INFINITY;
    for (const stop of referenceStops) {
      const distance = haversineDistanceMeters(point, stop);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }
    if (minDistance > thresholdMeters) {
      deviations.push({
        pointIndex: index,
        coordinate: point,
        deviationMeters: Math.round(minDistance * 100) / 100,
        thresholdMeters,
      });
    }
  });
  return deviations;
}

function calculateBoundingBox(points) {
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

// Ejecución de pruebas
console.log('--- INICIANDO SUITE DE PRUEBAS GEOESPACIALES Y GEODÉSICAS (TASK-007) ---');
let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    failed++;
  }
}

const plazaFoch = { latitude: -0.2028, longitude: -78.4908 };
const parqueElEjido = { latitude: -0.2135, longitude: -78.4980 };

// 1. Haversine distance
const distMetros = haversineDistanceMeters(plazaFoch, parqueElEjido);
assert(distMetros >= 1300 && distMetros <= 1550, `Prueba 1: Distancia geodésica coherente en Quito (~${Math.round(distMetros)} m)`);

// 2. Geocerca en rango (15m <= 50m)
const puntoCercano = { latitude: -0.2029, longitude: -78.4909 };
assert(isWithinGeofence(puntoCercano, plazaFoch, 50), 'Prueba 2: Punto dentro de radio de geocerca (50m)');

// 3. Geocerca fuera de rango (~230m > 50m)
const puntoLejano = { latitude: -0.2045, longitude: -78.4920 };
assert(!isWithinGeofence(puntoLejano, plazaFoch, 50), 'Prueba 3: Punto fuera de geocerca correctamente identificado');

// 4. Distancia acumulada de ruta
const ruta = [
  { latitude: -0.2028, longitude: -78.4908 },
  { latitude: -0.2050, longitude: -78.4920 },
  { latitude: -0.2100, longitude: -78.4950 },
  { latitude: -0.2135, longitude: -78.4980 },
];
const totalKm = calculateRouteTotalDistanceKm(ruta);
assert(totalKm >= 1.3 && totalKm <= 1.6, `Prueba 4: Distancia total de ruta calculada con precisión: ${totalKm} km`);

// 5. Detección de desvíos > 300m
const paradasAutorizadas = [plazaFoch, parqueElEjido];
const rutaConDesvio = [
  plazaFoch,
  { latitude: -0.2030, longitude: -78.4909 },
  { latitude: -0.1850, longitude: -78.4700 }, // Desvío a > 2.5 km en Monteserrín
  parqueElEjido,
];
const desvios = detectRouteDeviations(rutaConDesvio, paradasAutorizadas, 300);
assert(desvios.length === 1, `Prueba 5: Detección exacta de 1 punto desviado de la ruta (encontrados: ${desvios.length})`);
assert(desvios[0]?.pointIndex === 2, 'Prueba 6: Índice del punto desviado coincide con el punto anómalo');
assert(desvios[0]?.deviationMeters > 1000, `Prueba 7: Magnitud del desvío verificada (> 1000m: ${desvios[0]?.deviationMeters} m)`);

// 6. Bounding Box
const bbox = calculateBoundingBox(ruta);
assert(
  bbox !== null &&
    bbox.minLat === -0.2135 &&
    bbox.maxLat === -0.2028 &&
    bbox.minLng === -78.4980 &&
    bbox.maxLng === -78.4908,
  'Prueba 8: Bounding Box espacial calculado con precisión para encuadre en Leaflet'
);

console.log(`\nRESUMEN FINAL: ${passed} pruebas aprobadas, ${failed} pruebas falladas.`);
if (failed > 0) process.exit(1);

