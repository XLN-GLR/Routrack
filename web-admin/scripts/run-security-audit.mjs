/**
 * ROUTRACK — Runner Unificado de Auditoría de Seguridad, RLS y Cumplimiento LOPDP (TASK-026)
 * Archivo: web-admin/scripts/run-security-audit.mjs
 * Runtime: Node.js (ESM)
 */

import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");

console.log("╔══════════════════════════════════════════════════════════════════════════════╗");
console.log("║           ROUTRACK — AUDITORÍA GENERAL DE SEGURIDAD ESTRICTA (TASK-026)      ║");
console.log("║           Fase 8: Aseguramiento de Calidad, Penetración RLS y LOPDP         ║");
console.log("╚══════════════════════════════════════════════════════════════════════════════╝\n");

const testSuites = [
  {
    name: "Auditoría de Penetración Lógica y Aislamiento RLS (Criterio 1)",
    file: path.join(projectRoot, "supabase", "tests", "rls_penetration_test.mjs")
  },
  {
    name: "Escáner Estático de Secretos y Prohibición service_role_key (Criterio 2)",
    file: path.join(projectRoot, "web-admin", "scripts", "audit-secrets-scanner.mjs")
  },
  {
    name: "Validación Empírica de Cumplimiento LOPDP y Cese de GPS (Criterio 3)",
    file: path.join(projectRoot, "mobile-android", "scripts", "validate-lopdp-compliance.mjs")
  }
];

let allPassed = true;
const summary = [];

for (const suite of testSuites) {
  console.log(`\n▶ Ejecutando: ${suite.name}...`);
  const result = spawnSync("node", [suite.file], {
    stdio: "inherit",
    cwd: projectRoot
  });

  if (result.status === 0) {
    summary.push({ name: suite.name, status: "PASS" });
  } else {
    summary.push({ name: suite.name, status: "FAIL" });
    allPassed = false;
  }
}

console.log("\n================================================================================");
console.log("                     RESUMEN CONSOLIDADO DE AUDITORÍA                           ");
console.log("================================================================================");
for (const item of summary) {
  const icon = item.status === "PASS" ? "✔ [APROBADO]" : "✖ [FALLÓ]";
  console.log(`  ${icon} ${item.name}`);
}
console.log("================================================================================");

if (allPassed) {
  console.log("\n★ CERTIFICACIÓN OFICIAL: El sistema cumple al 100% con los criterios de TASK-026:");
  console.log("  1. Cero fugas de información entre organizaciones (Aislamiento RLS multi-tenant verificado).");
  console.log("  2. Cero exposición de claves secretas (SUPABASE_SERVICE_ROLE_KEY blindada y fuera de clientes).");
  console.log("  3. Cese inmediato y total de telemetría fuera de turno laboral (Cumplimiento LOPDP Ecuador).");
  process.exit(0);
} else {
  console.error("\n✖ ERROR CRÍTICO: La auditoría detectó vulnerabilidades que deben subsanarse.");
  process.exit(1);
}

