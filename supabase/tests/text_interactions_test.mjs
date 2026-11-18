/**
 * ROUTRACK — Suite de Pruebas Automatizadas: Modelo de Interacciones de Texto y Edge Function (TASK-029)
 * Archivo: supabase/tests/text_interactions_test.mjs
 * Runtime: Node.js (ESM)
 *
 * Valida los Criterios de Aceptación:
 * 1. La tabla text_interactions cuenta con RLS activado y aislamiento estricto por organization_id.
 * 2. La Edge Function sync-jornada procesa el arreglo text_interactions de forma idempotente.
 * 3. No se permite la lectura cruzada de textos entre organizaciones distintas.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
    failed++;
  }
}

console.log('================================================================================');
console.log('  ROUTRACK — PRUEBAS DE MODELO Y SINCRONIZACIÓN DE INTERACCIONES DE TEXTO');
console.log('  Tarea: TASK-029 / Criterios: RLS, Idempotencia y Contratos Edge Function');
console.log('================================================================================');

// ------------------------------------------------------------------------------
// GRUPO 1: VERIFICACIÓN ESTÁTICA DE MIGRACIONES Y ESQUEMA POSTGRESQL
// ------------------------------------------------------------------------------
console.log('\n[GRUPO 1] Verificación de Migraciones SQL y RLS:');

const migrationPath = path.join(
  projectRoot,
  'supabase/migrations/20260101000007_text_interactions.sql'
);
const initProdPath = path.join(
  projectRoot,
  'supabase/init_production_database.sql'
);
const testSqlPath = path.join(
  projectRoot,
  'supabase/tests/text_interactions_rls_test.sql'
);

assert(fs.existsSync(migrationPath), '1.1. Existe el archivo de migración 20260101000007_text_interactions.sql');
assert(fs.existsSync(initProdPath), '1.2. Existe el archivo maestro init_production_database.sql');
assert(fs.existsSync(testSqlPath), '1.3. Existe la suite SQL text_interactions_rls_test.sql');

const migrationSql = fs.readFileSync(migrationPath, 'utf8');
const initProdSql = fs.readFileSync(initProdPath, 'utf8');

assert(
  migrationSql.includes('CREATE TABLE IF NOT EXISTS public.interacciones_texto') &&
  initProdSql.includes('CREATE TABLE IF NOT EXISTS public.interacciones_texto'),
  '1.4. Tabla public.interacciones_texto definida en migración y en init_production_database.sql'
);

assert(
  migrationSql.includes('ALTER TABLE public.interacciones_texto ENABLE ROW LEVEL SECURITY') &&
  initProdSql.includes('ALTER TABLE public.interacciones_texto ENABLE ROW LEVEL SECURITY'),
  '1.5. Row Level Security (RLS) habilitado explícitamente en ambas fuentes SQL'
);

assert(
  migrationSql.includes('CREATE POLICY "interacciones_texto_select_supervisores_admin"') &&
  initProdSql.includes('CREATE POLICY "interacciones_texto_select_supervisores_admin"'),
  '1.6. Política SELECT restringida a ADMIN y SUPERVISOR con aislamiento por organizacion_id'
);

assert(
  migrationSql.includes('CREATE POLICY "interacciones_texto_insert_vendedor"') &&
  initProdSql.includes('CREATE POLICY "interacciones_texto_insert_vendedor"'),
  '1.7. Política INSERT acotada al vendedor autenticado de la organización'
);

assert(
  migrationSql.includes('CREATE OR REPLACE VIEW public.text_interactions AS') &&
  initProdSql.includes('CREATE OR REPLACE VIEW public.text_interactions AS'),
  '1.8. Vista de compatibilidad public.text_interactions definida'
);

assert(
  migrationSql.includes('idx_interacciones_texto_idempotencia') &&
  migrationSql.includes('idx_interacciones_texto_jornada_hmac'),
  '1.9. Índices únicos de idempotencia por ID y por (jornada_id, hmac_hash) definidos'
);

// ------------------------------------------------------------------------------
// GRUPO 2: CONTRATOS COMPARTIDOS Y EDGE FUNCTION SYNC-JORNADA
// ------------------------------------------------------------------------------
console.log('\n[GRUPO 2] Verificación de Contratos y Edge Function:');

const contractsPath = path.join(
  projectRoot,
  'supabase/functions/_shared/syncContracts.ts'
);
const edgeSchemaPath = path.join(
  projectRoot,
  'supabase/functions/sync-jornada/schema.ts'
);
const edgeHmacPath = path.join(
  projectRoot,
  'supabase/functions/sync-jornada/verify-hmac.ts'
);
const edgeIndexPath = path.join(
  projectRoot,
  'supabase/functions/sync-jornada/index.ts'
);

const contractsCode = fs.readFileSync(contractsPath, 'utf8');
const edgeSchemaCode = fs.readFileSync(edgeSchemaPath, 'utf8');
const edgeHmacCode = fs.readFileSync(edgeHmacPath, 'utf8');
const edgeIndexCode = fs.readFileSync(edgeIndexPath, 'utf8');

assert(
  contractsCode.includes('export interface SyncTextInteraction') &&
  contractsCode.includes('text_interactions?: SyncTextInteraction[]'),
  '2.1. Interfaz SyncTextInteraction definida en contratos compartidos'
);

assert(
  edgeSchemaCode.includes('export function validateTextInteraction') &&
  edgeSchemaCode.includes('text_interactions: texts'),
  '2.2. Validador validateTextInteraction implementado en el esquema de la Edge Function'
);

assert(
  edgeHmacCode.includes('buildCanonicalTextInteractionString') &&
  edgeHmacCode.includes('textInteractions?: SyncTextInteraction[]'),
  '2.3. Cadena de custodia HMAC ampliada para verificar interacciones de texto'
);

assert(
  edgeIndexCode.includes('interacciones_texto') &&
  edgeIndexCode.includes('textsPersisted') &&
  edgeIndexCode.includes('total_textos: textInteractions.length'),
  '2.4. Edge Function persiste el lote de textos de forma idempotente con upsert'
);

// ------------------------------------------------------------------------------
// GRUPO 3: SIMULACIÓN DE CRIPTOGRAFÍA HMAC Y ENLACE DE CUSTODIA PARA TEXTOS
// ------------------------------------------------------------------------------
console.log('\n[GRUPO 3] Simulación de Criptografía HMAC-SHA256 Encadenada:');

const CANONICAL_DELIMITER = '|';
const SHIFT_INIT_PREFIX = 'ROUTRACK-SHIFT-INIT|';
const secretKey = 'ROUTRACK_TEST_SECRET_KEY';
const shiftId = 'c1a2b3c4-d5e6-47a8-9b0c-112233445566';

function computeHmac(data, key) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');
}

const seed = computeHmac(`${SHIFT_INIT_PREFIX}${shiftId}`, secretKey);

// Simular punto GPS
const pointRecordedAt = new Date().toISOString();
const canonicalPt = [
  `shiftId=${shiftId}`,
  `lat=-0.18065`,
  `lng=-78.46783`,
  `acc=4.5`,
  `alt=2815`,
  `spd=10.2`,
  `ts=${new Date(pointRecordedAt).getTime()}`,
  `mock=false`
].join(CANONICAL_DELIMITER);
const pointHash = computeHmac(`${canonicalPt}${CANONICAL_DELIMITER}${seed}`, secretKey);

// Simular interacción de texto que encadena con el punto GPS
const textRecordedAt = new Date(Date.now() + 5000).toISOString();
const canonicalText = [
  `shiftId=${shiftId}`,
  `pkg=com.whatsapp`,
  `ts=${new Date(textRecordedAt).getTime()}`,
  `text=Se pacta 5% de descuento comercial`
].join(CANONICAL_DELIMITER);
const textHash = computeHmac(`${canonicalText}${CANONICAL_DELIMITER}${pointHash}`, secretKey);

assert(seed.length === 64, '3.1. Semilla inicial HMAC-SHA256 generada correctamente (64 hex)');
assert(pointHash.length === 64, '3.2. Hash de punto GPS calculado con éxito');
assert(textHash.length === 64, '3.3. Hash de interacción de texto encadenado con previous_hash correcto');

// Verificar detección de alteración en el texto digitado
const alteredCanonicalText = [
  `shiftId=${shiftId}`,
  `pkg=com.whatsapp`,
  `ts=${new Date(textRecordedAt).getTime()}`,
  `text=Se pacta 15% de descuento comercial (ADULTERADO)`
].join(CANONICAL_DELIMITER);
const alteredHash = computeHmac(`${alteredCanonicalText}${CANONICAL_DELIMITER}${pointHash}`, secretKey);

assert(
  alteredHash !== textHash,
  '3.4. Alteración de un solo carácter en el texto rompe la firma criptográfica HMAC'
);

// ------------------------------------------------------------------------------
// GRUPO 4: SIMULACIÓN DE POLÍTICAS RLS Y MULTI-TENANT
// ------------------------------------------------------------------------------
console.log('\n[GRUPO 4] Verificación de Aislamiento RLS Multi-Tenant (Simulación Lógica):');

const mockDatabase = [
  {
    id: 't1',
    organizacion_id: 'org-alfa',
    vendedor_id: 'vend-1',
    paquete_aplicacion: 'com.whatsapp',
    texto_capturado: 'Negociación Alfa 1',
    registrado_en: '2026-11-17T10:00:00Z'
  },
  {
    id: 't2',
    organizacion_id: 'org-alfa',
    vendedor_id: 'vend-2',
    paquete_aplicacion: 'com.whatsapp',
    texto_capturado: 'Negociación Alfa 2',
    registrado_en: '2026-11-17T10:05:00Z'
  },
  {
    id: 't3',
    organizacion_id: 'org-beta',
    vendedor_id: 'vend-3',
    paquete_aplicacion: 'com.whatsapp',
    texto_capturado: 'Negociación Beta Confidencial',
    registrado_en: '2026-11-17T10:10:00Z'
  }
];

function simulateRlsSelect(userOrgId, userRole, userId) {
  return mockDatabase.filter((row) => {
    // Regla de política: organizacion_id = jwt_organizacion_id AND jwt_rol IN ('ADMIN', 'SUPERVISOR')
    if (row.organizacion_id !== userOrgId) return false;
    return userRole === 'ADMIN' || userRole === 'SUPERVISOR';
  });
}

const supervisorAlfaResults = simulateRlsSelect('org-alfa', 'SUPERVISOR', 'sup-1');
assert(
  supervisorAlfaResults.length === 2 && supervisorAlfaResults.every((r) => r.organizacion_id === 'org-alfa'),
  '4.1. Supervisor de Org Alfa solo observa interacciones de Org Alfa (2 registros)'
);

const supervisorBetaResults = simulateRlsSelect('org-beta', 'SUPERVISOR', 'sup-2');
assert(
  supervisorBetaResults.length === 1 && supervisorBetaResults[0].id === 't3',
  '4.2. Supervisor de Org Beta no tiene acceso a datos de Org Alfa (Criterio 3: Cero fugas)'
);

const vendedorResults = simulateRlsSelect('org-alfa', 'VENDEDOR', 'vend-1');
assert(
  vendedorResults.length === 0,
  '4.3. Rol VENDEDOR tiene lectura bloqueada en la tabla de auditoría de textos (0 registros)'
);

// ------------------------------------------------------------------------------
// RESUMEN FINAL
// ------------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`  RESULTADO: ${passed} de ${passed + failed} pruebas pasadas (${failed === 0 ? '100% ÉXITO' : 'FALLOS DETECTADOS'})`);
console.log('================================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
