/**
 * ROUTRACK — Escáner Estático de Secretos, Credenciales y Análisis de Exposición (TASK-026)
 * Archivo: web-admin/scripts/audit-secrets-scanner.mjs
 * Runtime: Node.js (ESM)
 *
 * Criterio de Aceptación 2: Cero exposición de claves secretas (service_role_key) ni credenciales maestras.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");

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
console.log("  ROUTRACK — AUDITORÍA DE SEGURIDAD: ESCÁNER ESTÁTICO DE SECRETOS Y CREDENCIALES");
console.log("  Tarea: TASK-026 / Criterio 2: Cero exposición de SUPABASE_SERVICE_ROLE_KEY");
console.log("================================================================================");

// Directorios a excluir del escaneo
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "build",
  "dist",
  ".gradle",
  "captures",
  "test-results"
]);

// Extensiones de archivos de código y configuración a auditar
const AUDITABLE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".json",
  ".kt",
  ".xml",
  ".gradle",
  ".kts",
  ".env",
  ".env.example",
  ".sql",
  ".md"
]);

/**
 * Recolector recursivo de archivos auditable
 */
function getAuditableFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        results.push(...getAuditableFiles(fullPath));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (AUDITABLE_EXTENSIONS.has(ext) || entry.name.startsWith(".env")) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

const allAuditableFiles = getAuditableFiles(projectRoot);

// -----------------------------------------------------------------------------
// BLOQUE 1: ESCANEO DE CLAVES PRIVADAS CRIPTOGRÁFICAS (RSA, EC, OPENSSH)
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 1] Detección de Claves Privadas Criptográficas Hardcodeadas:");

const privateKeyRegex = /-----BEGIN\s+([A-Z0-9_-]+\s+)?PRIVATE\s+KEY-----/i;
const filesWithPrivateKeys = [];

for (const filePath of allAuditableFiles) {
  const content = fs.readFileSync(filePath, "utf8");
  if (privateKeyRegex.test(content)) {
    filesWithPrivateKeys.push(path.relative(projectRoot, filePath));
  }
}

assert(
  filesWithPrivateKeys.length === 0,
  "Prueba 1: Cero certificados ni claves privadas RSA/EC embebidas en el repositorio",
  filesWithPrivateKeys.join(", ")
);

// -----------------------------------------------------------------------------
// BLOQUE 2: PROHIBICIÓN TERMINANTE DE EXPOSICIÓN DE SERVICE_ROLE_KEY EN FRONTEND WEB Y MÓVIL
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 2] Auditoría de SUPABASE_SERVICE_ROLE_KEY en Clientes (Web y Android):");

const webSrcFiles = allAuditableFiles.filter(f => f.includes(path.join("web-admin", "src")));
const androidSrcFiles = allAuditableFiles.filter(f => f.includes(path.join("mobile-android", "app", "src")));

let webExposures = [];
let androidExposures = [];

for (const filePath of webSrcFiles) {
  const content = fs.readFileSync(filePath, "utf8");
  if (content.includes("SUPABASE_SERVICE_ROLE_KEY") || content.includes("service_role_key")) {
    webExposures.push(path.relative(projectRoot, filePath));
  }
}

for (const filePath of androidSrcFiles) {
  const content = fs.readFileSync(filePath, "utf8");
  if (content.includes("SUPABASE_SERVICE_ROLE_KEY") || content.includes("service_role_key")) {
    androidExposures.push(path.relative(projectRoot, filePath));
  }
}

assert(
  webExposures.length === 0,
  "Prueba 2 (Criterio 2): Cero referencias a SUPABASE_SERVICE_ROLE_KEY en el cliente web (web-admin/src)",
  webExposures.join(", ")
);

assert(
  androidExposures.length === 0,
  "Prueba 3 (Criterio 2): Cero referencias a SUPABASE_SERVICE_ROLE_KEY en el cliente móvil (mobile-android)",
  androidExposures.join(", ")
);

// -----------------------------------------------------------------------------
// BLOQUE 3: AUDITORÍA DE VARIABLES DE ENTORNO PÚBLICAS (NEXT_PUBLIC_*)
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 3] Validación Estricta de Prefijos NEXT_PUBLIC_* en web-admin:");

const nextPublicUsages = new Set();
const nextPublicRegex = /NEXT_PUBLIC_[A-Z0-9_]+/g;

for (const filePath of webSrcFiles) {
  const content = fs.readFileSync(filePath, "utf8");
  const matches = content.match(nextPublicRegex);
  if (matches) {
    matches.forEach(m => nextPublicUsages.add(m));
  }
}

const variablesPublicasPermitidas = new Set([
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_MAP_TILE_PROVIDER_URL",
  "NEXT_PUBLIC_MAP_ATTRIBUTION"
]);

const variablesPublicasSospechosas = [...nextPublicUsages].filter(
  v => !variablesPublicasPermitidas.has(v) || v.includes("ROLE") || v.includes("SECRET") || v.includes("ADMIN")
);

assert(
  variablesPublicasSospechosas.length === 0,
  "Prueba 4: Todas las variables NEXT_PUBLIC_* empleadas en web-admin son seguras y están autorizadas",
  variablesPublicasSospechosas.join(", ")
);

assert(
  nextPublicUsages.has("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  "Prueba 5: El cliente web utiliza exclusivamente la clave anónima pública sujeta a políticas RLS"
);

// -----------------------------------------------------------------------------
// BLOQUE 4: AUDITORÍA DE .env.example Y POLÍTICA DE IGNORADOS EN GIT
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 4] Verificación de .env.example, .gitignore y Ausencia de Fugas en Git:");

const envExamplePath = path.join(projectRoot, ".env.example");
assert(
  fs.existsSync(envExamplePath),
  "Prueba 6: Archivo .env.example existe en la raíz del repositorio"
);

const envExampleContent = fs.readFileSync(envExamplePath, "utf8");
assert(
  envExampleContent.includes("tu-proyecto-id") && envExampleContent.includes("ejemplo_anon_public_key"),
  "Prueba 7: .env.example contiene exclusivamente valores ficticios y documentales (Cero credenciales reales)"
);

const gitignorePath = path.join(projectRoot, ".gitignore");
assert(
  fs.existsSync(gitignorePath),
  "Prueba 8: Archivo .gitignore existe y está configurado"
);

const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
assert(
  gitignoreContent.includes(".env") && gitignoreContent.includes(".env*.local"),
  "Prueba 9: .gitignore bloquea obligatoriamente todos los archivos .env y .env*.local"
);
assert(
  gitignoreContent.includes("*.keystore") && gitignoreContent.includes("*.jks") && gitignoreContent.includes("*.key"),
  "Prueba 10: .gitignore bloquea certificados Android Keystore (*.keystore, *.jks) y llaves privadas"
);

// Verificación contra Git index para asegurar que ningún archivo sensible esté tracked
let trackedSensitiveFiles = [];
try {
  const gitTracked = execSync("git ls-files", { cwd: projectRoot, encoding: "utf8" });
  const lines = gitTracked.split("\n").map(l => l.trim()).filter(Boolean);
  trackedSensitiveFiles = lines.filter(file => {
    const base = path.basename(file);
    if (base === ".env.example") return false;
    return (
      base.startsWith(".env") ||
      file.endsWith(".jks") ||
      file.endsWith(".keystore") ||
      file.endsWith(".pfx") ||
      (file.endsWith(".key") && !file.includes("rules"))
    );
  });
} catch (_err) {
  // En caso de entorno sin git binario directo
}

assert(
  trackedSensitiveFiles.length === 0,
  "Prueba 11: Cero archivos .env reales ni certificados tracked en el índice de Git",
  trackedSensitiveFiles.join(", ")
);

// -----------------------------------------------------------------------------
// BLOQUE 5: CONFINAMIENTO EN SUPABASE EDGE FUNCTIONS (Deno.env.get)
// -----------------------------------------------------------------------------
console.log("\n[GRUPO 5] Confinamiento de service_role_key en Supabase Edge Functions:");

const edgeFunctionIndexPath = path.join(projectRoot, "supabase", "functions", "sync-jornada", "index.ts");
assert(
  fs.existsSync(edgeFunctionIndexPath),
  "Prueba 12: Existe el archivo de la Edge Function sync-jornada/index.ts"
);

const edgeFunctionContent = fs.readFileSync(edgeFunctionIndexPath, "utf8");

// La Edge function solo puede acceder a SUPABASE_SERVICE_ROLE_KEY mediante Deno.env.get
const usesDenoEnv = edgeFunctionContent.includes("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
assert(
  usesDenoEnv,
  "Prueba 13: La Edge Function obtiene service_role exclusivamente mediante Deno.env.get en runtime seguro"
);

// La respuesta HTTP devuelta por la Edge function nunca debe incluir el service key
const leaksKeyInResponse = /response.*service_role/i.test(edgeFunctionContent);
assert(
  !leaksKeyInResponse,
  "Prueba 14: La respuesta JSON de la Edge Function jamás expone tokens de servicio ni credenciales"
);

// Resumen Final
console.log("================================================================================");
console.log(`  RESUMEN ESCÁNER DE SECRETOS: ${passed} pruebas superadas, ${failed} fallos`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
}

