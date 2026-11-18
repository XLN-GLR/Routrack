/**
 * ROUTRACK — Orquestador Maestro Integral de Pruebas Automatizadas (TASK-035)
 * Archivo: web-admin/scripts/run-all-tests.mjs
 * Runtime: Node.js (ESM)
 *
 * Consolida la ejecución de todas las suites de pruebas de la pirámide de calidad:
 * 1. Pruebas Unitarias de Contratos Zod y Criptografía HMAC-SHA256.
 * 2. Pruebas Geoespaciales y Algoritmos Haversine de Geocercas.
 * 3. Pruebas del Visor Cartográfico y Monitoreo en Vivo (/live).
 * 4. Pruebas del Histórico de Trayectorias y Detección de Desvíos (/routes).
 * 5. Pruebas del Directorio de Clientes y Geocercas PostGIS (/clients).
 * 6. Pruebas de Visitas Comerciales y Compromisos de Precios (/visits).
 * 7. Pruebas de Bitácora Forense Inmutable y Anti-Tampering (/audit).
 * 8. Pruebas de Métricas y Rendimiento Recharts (/dashboard).
 * 9. Pruebas de Exportación a CSV con UTF-8 BOM y RFC 4180 (/reports).
 * 10. Pruebas de Auditoría de Interacciones de Texto Corporativo (TASK-031).
 * 11. Pruebas del Motor de Map-Matching y Snap-to-Roads con OSRM ($0 USD) (TASK-032).
 * 12. Pruebas de Muestreo Cinemático Adaptativo en Android (TASK-033).
 * 13. Pruebas de Animación Cinemática 60 FPS y Trazado Vial en Vivo (TASK-034).
 * 14. Verificación de cero líneas rectas aéreas y cumplimiento de costo $0 USD.
 */

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webAdminRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(webAdminRoot, '..');

console.log('================================================================================');
console.log('  ROUTRACK — ORQUESTADOR MAESTRO DE PRUEBAS DE ASEGURAMIENTO DE CALIDAD');
console.log('  Versión: 2.0.0 / Fases 0 a 11 Completas / Meta de Cobertura: 100%');
console.log('================================================================================\n');

const testSuites = [
  // 1. Contratos Zod y Sincronización
  {
    name: 'Contratos Zod y Validación de Sincronización (TASK-005)',
    command: 'node',
    args: ['scripts/run-sync-tests.mjs'],
    cwd: webAdminRoot,
    description: 'Valida esquemas RFC 4122, coordenadas WGS84, firmas HMAC y reloj de sistema',
  },
  // 2. Geodesia y PostGIS
  {
    name: 'Algoritmos Geoespaciales y Fórmulas Haversine (TASK-007)',
    command: 'node',
    args: ['scripts/run-spatial-tests.mjs'],
    cwd: webAdminRoot,
    description: 'Valida cálculo de distancias, radios de geocerca (50m) y desvíos espaciales (300m)',
  },
  // 3. Visor Cartográfico Leaflet
  {
    name: 'Visor Cartográfico y Capas OpenStreetMap (TASK-014)',
    command: 'node',
    args: ['scripts/run-map-tests.mjs'],
    cwd: webAdminRoot,
    description: 'Valida renderizado en HTML5 Canvas (preferCanvas), controles y teselas a $0 USD',
  },
  // 4. Monitoreo en Vivo
  {
    name: 'Monitoreo en Vivo y Marcadores Operativos (TASK-015)',
    command: 'node',
    args: ['scripts/run-live-monitoring-tests.mjs'],
    cwd: webAdminRoot,
    description: 'Valida los 5 estados operativos, popups informativos y centrado de cámara',
  },
  // 5. Histórico de Rutas
  {
    name: 'Histórico de Trayectorias y Desvíos de Ruta (TASK-016)',
    command: 'node',
    args: ['scripts/run-routes-tests.mjs'],
    cwd: webAdminRoot,
    description: 'Valida trazado cronológico continuo, cálculo de distancias y marcadores de desvío',
  },
  // 6. Directorio de Clientes
  {
    name: 'Directorio de Clientes y Geocercas Comerciales (TASK-019)',
    command: 'node',
    args: ['scripts/run-client-tests.mjs'],
    cwd: webAdminRoot,
    description: 'Valida georreferenciación de puntos de venta y radios de tolerancia PostGIS',
  },
  // 7. Visitas Comerciales
  {
    name: 'Gestión de Visitas Comerciales y Acuerdos de Precios (TASK-020)',
    command: 'node',
    args: ['scripts/run-visit-tests.mjs'],
    cwd: webAdminRoot,
    description: 'Valida check-in, check-out, geocerca VERIFIED vs OUT_OF_RANGE y notas comerciales',
  },
  // 8. Bitácora de Auditoría
  {
    name: 'Bitácora Forense Inmutable y Cadena de Integridad (TASK-021)',
    command: 'node',
    args: ['scripts/run-audit-tests.mjs'],
    cwd: webAdminRoot,
    description: 'Valida trazabilidad append-only, hashes HMAC-SHA256 encadenados y anti-tampering',
  },
  // 9. Dashboard y Recharts
  {
    name: 'Dashboard Operativo y Visualización Recharts (TASK-022)',
    command: 'node',
    args: ['scripts/run-dashboard-tests.mjs'],
    cwd: webAdminRoot,
    description: 'Valida cálculo de efectividad, cobertura de clientes y gráficos de curva horaria',
  },
  // 10. Exportación CSV
  {
    name: 'Exportación a CSV Formal con UTF-8 BOM y RFC 4180 (TASK-023)',
    command: 'node',
    args: ['scripts/run-reports-tests.mjs'],
    cwd: webAdminRoot,
    description: 'Valida compatibilidad con Excel, codificación UTF-8 con BOM y escape de caracteres',
  },
  // 11. Auditoría de Textos Corporativos (TASK-031)
  {
    name: 'Auditoría de Textos Corporativos en Dispositivos Asignados (TASK-031)',
    command: 'node',
    args: ['scripts/run-text-audit-tests.mjs'],
    cwd: webAdminRoot,
    description: 'Valida filtrado multivariable, métricas de WhatsApp/SMS y firmas HMAC de texto',
  },
  // 12. Map-Matching OSRM (TASK-032)
  {
    name: 'Motor de Map-Matching y Snap-to-Roads con OpenStreetMap (TASK-032)',
    command: 'node',
    args: ['scripts/run-road-matching-tests.mjs'],
    cwd: webAdminRoot,
    description: 'Valida ajuste vial sobre calzadas físicas, chunking de 80 puntos y fallback geodésico',
  },
  // 13. Muestreo Cinemático Android (TASK-033)
  {
    name: 'Muestreo Cinemático Adaptativo por Rumbo en Android (TASK-033)',
    command: 'node',
    args: ['mobile-android/scripts/validate-kinematic-sampling.mjs'],
    cwd: projectRoot,
    description: 'Valida detección reactiva de esquinas (Δθ >= 15°), azimut y optimización de batería',
  },
  // 14. Animación Cinemática y Trazado Vial en Vivo (TASK-034)
  {
    name: 'Animación Cinemática 60 FPS y Trazado Vial Realista (/live) (TASK-034)',
    command: 'node',
    args: ['scripts/run-live-road-matching-tests.mjs'],
    cwd: webAdminRoot,
    description: 'Valida requestAnimationFrame, easing cúbico, cruce de 360° y cero líneas rectas aéreas',
  },
  // 15. Criptografía HMAC Android (TASK-009)
  {
    name: 'Generador Criptográfico HMAC-SHA256 Encadenado Android (TASK-009)',
    command: 'node',
    args: ['mobile-android/scripts/run-hmac-tests.mjs'],
    cwd: projectRoot,
    description: 'Valida reproducibilidad matemática determinista, efecto avalancha y semilla de turno',
  },
  // 16. Persistencia Room + SQLCipher (TASK-008)
  {
    name: 'Persistencia Local Desacoplada Room y SQLCipher (TASK-008)',
    command: 'node',
    args: ['mobile-android/scripts/validate-persistence-architecture.mjs'],
    cwd: projectRoot,
    description: 'Valida repositorios de dominio, mutex thread-safe y exclusión de DAOs en la UI',
  },
  // 17. Mitigación Anti-Tampering y Fake GPS (TASK-011)
  {
    name: 'Detección de Ubicaciones Simuladas y Desvíos de Reloj (TASK-011)',
    command: 'node',
    args: ['mobile-android/scripts/run-antitampering-tests.mjs'],
    cwd: projectRoot,
    description: 'Valida detección de Fake GPS y calibración con elapsedRealtime ante desfases > 60s',
  },
  // 18. Sincronización WorkManager (TASK-013)
  {
    name: 'Sincronización en Segundo Plano y Resiliencia Offline (TASK-013)',
    command: 'node',
    args: ['mobile-android/scripts/validate-sync-worker.mjs'],
    cwd: projectRoot,
    description: 'Valida WorkManager con reintentos exponenciales, batching de 100 registros e idempotencia',
  },
];

let totalSuites = testSuites.length;
let passedSuites = 0;
let failedSuites = 0;

for (let i = 0; i < testSuites.length; i++) {
  const suite = testSuites[i];
  const suiteNum = `[${i + 1}/${totalSuites}]`;

  console.log(`\n--------------------------------------------------------------------------------`);
  console.log(`  ${suiteNum} Ejecutando: ${suite.name}`);
  console.log(`  Descripción: ${suite.description}`);
  console.log(`--------------------------------------------------------------------------------`);

  const startTime = Date.now();
  const result = spawnSync(suite.command, suite.args, {
    cwd: suite.cwd,
    encoding: 'utf8',
    stdio: 'inherit',
    shell: true,
  });
  const durationMs = Date.now() - startTime;

  if (result.status === 0) {
    passedSuites++;
    console.log(`\n  >>> RESULTADO: APROBADA en ${(durationMs / 1000).toFixed(2)}s`);
  } else {
    failedSuites++;
    console.error(`\n  >>> RESULTADO: FALLIDA con código de salida ${result.status} tras ${(durationMs / 1000).toFixed(2)}s`);
  }
}

// Resumen Final
console.log('\n================================================================================');
console.log('  ROUTRACK — RESUMEN GLOBAL CONSOLIDADO DE CALIDAD Y PRUEBAS (TASK-035)');
console.log('================================================================================');
console.log(`  Total de Suites Ejecutadas: ${totalSuites}`);
console.log(`  Suites Aprobadas:          ${passedSuites}`);
console.log(`  Suites Fallidas:           ${failedSuites}`);
console.log(`  Tasa de Éxito:             ${((passedSuites / totalSuites) * 100).toFixed(1)}%`);
console.log('================================================================================\n');

if (failedSuites > 0) {
  console.error('[FALLO CRÍTICO] Una o más suites de prueba no superaron la validación.');
  process.exit(1);
} else {
  console.log('[ÉXITO TOTAL] Todas las suites de prueba de ROUTRACK fueron superadas al 100%.');
  process.exit(0);
}
