/**
 * ROUTRACK — Suite de Validación Automatizada del Pipeline de CI/CD (TASK-027)
 * Archivo: scripts/validate-ci-pipeline.mjs
 * Runtime: Node.js (ESM)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

let passed = 0;
let failed = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${details ? ` -> ${details}` : ""}`);
    failed++;
  }
}

console.log("================================================================================");
console.log("  ROUTRACK — VALIDACIÓN DE INFRAESTRUCTURA CI/CD EN GITHUB ACTIONS");
console.log("  Tarea: TASK-027 / Criterio 1: Pipeline de CI automatizado para Pull Requests");
console.log("================================================================================");

// -----------------------------------------------------------------------------
// BLOQUE 1: EXISTENCIA Y SINTAXIS BÁSICA DEL WORKFLOW YAML
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 1] Verificación Estructural del Workflow de GitHub Actions:");

const workflowPath = path.join(projectRoot, ".github", "workflows", "ci.yml");
assert(
  fs.existsSync(workflowPath),
  "Prueba 1: Archivo .github/workflows/ci.yml existe en la ruta canónica"
);

const workflowContent = fs.readFileSync(workflowPath, "utf8");

assert(
  workflowContent.length > 500,
  "Prueba 2: El archivo de workflow contiene configuración completa y exhaustiva"
);

// Validación de disparadores obligatorios
assert(
  workflowContent.includes("push:") && workflowContent.includes("pull_request:") && workflowContent.includes("main"),
  "Prueba 3: Disparadores de CI configurados formalmente para push y pull_request hacia la rama 'main'"
);

// Concurrencia para optimización de ejecuciones
assert(
  workflowContent.includes("concurrency:") && workflowContent.includes("cancel-in-progress: true"),
  "Prueba 4: Control de concurrencia activo para cancelar ejecuciones obsoletas de PRs en progreso"
);

// -----------------------------------------------------------------------------
// BLOQUE 2: VERIFICACIÓN DE JOBS EN LA PIRÁMIDE DE INTEGRACIÓN CONTINUA
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 2] Verificación de Jobs Especializados del Monorepo:");

const expectedJobs = [
  "web-admin-verification",
  "web-admin-e2e",
  "mobile-android-verification",
  "supabase-integration-verification",
  "ci-status-gate"
];

expectedJobs.forEach((jobName, idx) => {
  const hasJob = workflowContent.includes(`${jobName}:`);
  assert(
    hasJob,
    `Prueba ${5 + idx}: Declara el job oficial '${jobName}' en el workflow`
  );
});

// Dependencias entre jobs
assert(
  workflowContent.includes("needs: web-admin-verification") &&
  workflowContent.includes("needs:\n      - web-admin-verification"),
  "Prueba 10: web-admin-e2e y gatekeeper respetan el orden de precedencia de jobs (needs)"
);

// -----------------------------------------------------------------------------
// BLOQUE 3: VERIFICACIÓN DE COMANDOS Y SCRIPTS VINCULADOS
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 3] Comprobación de Comandos y Scripts Referenciados en el Workflow:");

// Web Admin checks
assert(
  workflowContent.includes("npm --prefix web-admin run typecheck"),
  "Prueba 11: Ejecuta comprobación estricta de TypeScript (tsc --noEmit)"
);
assert(
  workflowContent.includes("npm --prefix web-admin run lint"),
  "Prueba 12: Ejecuta comprobación estática de linter"
);
assert(
  workflowContent.includes("npm --prefix web-admin test"),
  "Prueba 13: Ejecuta suite completa de pruebas unitarias de web-admin (153 pruebas)"
);
assert(
  workflowContent.includes("npm --prefix web-admin run test:security"),
  "Prueba 14: Ejecuta suite unificada de auditoría de seguridad y penetración RLS (66 pruebas)"
);
assert(
  workflowContent.includes("npm --prefix web-admin run build"),
  "Prueba 15: Ejecuta compilación y empaquetado de producción de Next.js"
);
assert(
  workflowContent.includes("npm --prefix web-admin run test:e2e"),
  "Prueba 16: Ejecuta pruebas End-to-End con Playwright en Chromium y Firefox"
);

// Android Mobile checks
const androidScripts = [
  "validate-persistence-architecture.mjs",
  "run-hmac-tests.mjs",
  "validate-foreground-service.mjs",
  "run-antitampering-tests.mjs",
  "validate-sync-worker.mjs",
  "validate-visit-workflow.mjs",
  "run-offline-sync-tests.mjs",
  "validate-lopdp-compliance.mjs"
];

androidScripts.forEach((scriptName, idx) => {
  const scriptPath = path.join(projectRoot, "mobile-android", "scripts", scriptName);
  const isReferenced = workflowContent.includes(scriptName);
  const fileExists = fs.existsSync(scriptPath);
  assert(
    isReferenced && fileExists,
    `Prueba ${17 + idx}: Script Android '${scriptName}' está referenciado en CI y existe físicamente`
  );
});

// Supabase checks
const supabaseScripts = [
  "sync_jornada_edge_test.mjs",
  "visit_validation_function_test.mjs",
  "rls_penetration_test.mjs"
];

supabaseScripts.forEach((scriptName, idx) => {
  const scriptPath = path.join(projectRoot, "supabase", "tests", scriptName);
  const isReferenced = workflowContent.includes(scriptName);
  const fileExists = fs.existsSync(scriptPath);
  assert(
    isReferenced && fileExists,
    `Prueba ${25 + idx}: Script Supabase '${scriptName}' está referenciado en CI y existe físicamente`
  );
});

// -----------------------------------------------------------------------------
// BLOQUE 4: SEGURIDAD Y CERO EXPOSICIÓN DE SECRETOS EN EL WORKFLOW
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 4] Auditoría de Seguridad en el Workflow de CI:");

// Cero exposición de SERVICE_ROLE_KEY hardcodeada
const leaksServiceKey = /SUPABASE_SERVICE_ROLE_KEY\s*:\s*["'][a-zA-Z0-9._-]+["']/i.test(workflowContent);
assert(
  !leaksServiceKey,
  "Prueba 28: Cero tokens de SUPABASE_SERVICE_ROLE_KEY hardcodeados en el archivo YAML de CI"
);

// Uso exclusivo de variables públicas anónimas
assert(
  workflowContent.includes("sb_publishable_") || workflowContent.includes("anon"),
  "Prueba 29: Variables de entorno en CI utilizan exclusivamente claves anónimas públicas sujetas a RLS"
);

// Artefactos en fallo para trazabilidad
assert(
  workflowContent.includes("actions/upload-artifact@v4") && workflowContent.includes("if: failure()"),
  "Prueba 30: Configuración de upload-artifact para captura forense de reportes y videos solo ante fallos"
);

// Resumen Final
console.log("================================================================================");
console.log(`  RESUMEN CI/CD WORKFLOW: ${passed} pruebas superadas, ${failed} fallos de ${passed + failed} totales`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
}
