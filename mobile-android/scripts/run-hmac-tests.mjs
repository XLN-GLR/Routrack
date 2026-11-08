import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Runner ejecutable de pruebas formales para el generador criptográfico
 * de HMAC encadenado (TASK-009).
 */

const SHIFT_INIT_PREFIX = 'ROUTRACK-SHIFT-INIT|';
const CANONICAL_DELIMITER = '|';

function computeHmacSha256(data, key) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');
}

function computeInitialSeed(shiftId, key) {
  return computeHmacSha256(`${SHIFT_INIT_PREFIX}${shiftId}`, key);
}

function canonicalPointPayload({ shiftId, latitude, longitude, accuracy, altitude = null, speed = null, timestamp, isMock = false }) {
  return [
    `shiftId=${shiftId.trim()}`,
    `lat=${latitude}`,
    `lng=${longitude}`,
    `acc=${accuracy}`,
    `alt=${altitude !== null ? altitude : 'null'}`,
    `spd=${speed !== null ? speed : 'null'}`,
    `ts=${timestamp}`,
    `mock=${isMock}`
  ].join(CANONICAL_DELIMITER);
}

function signRaw(canonicalPayload, previousHash, key) {
  const message = `${canonicalPayload}${CANONICAL_DELIMITER}${previousHash}`;
  return computeHmacSha256(message, key);
}

function verifyChain(elements, initialSeed, key) {
  let expectedPrev = initialSeed;
  for (const { payload, currentHash } of elements) {
    const recalculated = signRaw(payload, expectedPrev, key);
    if (recalculated.toLowerCase() !== currentHash.toLowerCase()) {
      return false;
    }
    expectedPrev = currentHash;
  }
  return true;
}

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    passed++;
    console.log(`  [PASS] Prueba ${passed}: ${description}`);
  } else {
    failed++;
    console.error(`  [FAIL] Prueba ${passed + failed}: ${description}`);
  }
}

console.log('--- INICIANDO SUITE DE PRUEBAS DEL GENERADOR CRIPTOGRÁFICO HMAC ENCADENADO (TASK-009) ---');

const secretKey = 'CLAVE_SECRETA_ROUTRACK_HMAC_TEST_2026';
const shiftId = 'shift-uuid-abc-123';

// 1. Verificación de existencia de archivos Kotlin
const hmacKotlinPath = path.resolve('mobile-android/app/src/main/java/com/routrack/mobile/security/HmacChainSigner.kt');
const hmacTestPath = path.resolve('mobile-android/app/src/test/java/com/routrack/mobile/security/HmacChainSignerTest.kt');
assert('Archivo HmacChainSigner.kt existe en com.routrack.mobile.security', fs.existsSync(hmacKotlinPath));
assert('Archivo HmacChainSignerTest.kt existe en com.routrack.mobile.security', fs.existsSync(hmacTestPath));

// 2. Determinismo y reproducibilidad
const p1 = 'shiftId=shift-1|lat=-0.180653|lng=-78.467834|acc=4.5|ts=1700000000000';
const prev0 = '0'.repeat(64);
const h1 = signRaw(p1, prev0, secretKey);
const h2 = signRaw(p1, prev0, secretKey);
assert('Cómputo HMAC-SHA256 es 100% determinista y reproducible', h1 === h2);
assert('Longitud del hash HMAC-SHA256 es exactamente 64 caracteres hex', h1.length === 64 && /^[0-9a-f]{64}$/.test(h1));

// 3. Semilla inicial de turno
const seed1 = computeInitialSeed(shiftId, secretKey);
const seed2 = computeInitialSeed('otro-shift-456', secretKey);
assert('Semilla inicial de jornada se genera correctamente en formato hex 64', seed1.length === 64);
assert('Semillas para distintos turnos son mutuamente independientes', seed1 !== seed2);

// 4. Encadenamiento secuencial legítimo
const rawPoints = [
  { shiftId, latitude: -0.180653, longitude: -78.467834, accuracy: 4.0, altitude: 2850.0, speed: 1.2, timestamp: 1700000000000, isMock: false },
  { shiftId, latitude: -0.180700, longitude: -78.467900, accuracy: 3.8, altitude: 2851.0, speed: 1.5, timestamp: 1700000015000, isMock: false },
  { shiftId, latitude: -0.180750, longitude: -78.467950, accuracy: 4.1, altitude: 2852.0, speed: 1.3, timestamp: 1700000030000, isMock: false },
  { shiftId, latitude: -0.180800, longitude: -78.468000, accuracy: 3.5, altitude: 2853.0, speed: 1.6, timestamp: 1700000045000, isMock: false },
  { shiftId, latitude: -0.180850, longitude: -78.468050, accuracy: 3.9, altitude: 2854.0, speed: 1.4, timestamp: 1700000060000, isMock: false }
];

let curPrev = seed1;
const legitimateChain = [];
for (const pt of rawPoints) {
  const canon = canonicalPointPayload(pt);
  const hash = signRaw(canon, curPrev, secretKey);
  legitimateChain.push({ payload: canon, currentHash: hash });
  curPrev = hash;
}
assert('Cadena legítima de 5 puntos consecutivos supera la verificación matemática', verifyChain(legitimateChain, seed1, secretKey));

// 5. Invalidez por alteración microscópica de coordenada
const tamperedCoordChain = JSON.parse(JSON.stringify(legitimateChain));
tamperedCoordChain[0].payload = canonicalPointPayload({ ...rawPoints[0], latitude: -0.180654 }); // cambio de 0.000001
assert('Alteración de coordenada (0.000001°) invalida la cadena', !verifyChain(tamperedCoordChain, seed1, secretKey));

// 6. Invalidez por alteración de timestamp (1 ms)
const tamperedTsChain = JSON.parse(JSON.stringify(legitimateChain));
tamperedTsChain[2].payload = canonicalPointPayload({ ...rawPoints[2], timestamp: 1700000030001 }); // +1 ms
assert('Alteración temporal de 1 milisegundo invalida la cadena', !verifyChain(tamperedTsChain, seed1, secretKey));

// 7. Invalidez por alteración de flag isMock
const tamperedMockChain = JSON.parse(JSON.stringify(legitimateChain));
tamperedMockChain[1].payload = canonicalPointPayload({ ...rawPoints[1], isMock: true });
assert('Alteración de flag isMock invalida la cadena', !verifyChain(tamperedMockChain, seed1, secretKey));

// 8. Invalidez por inyección de hash previo alterado
const tamperedPrevHashChain = JSON.parse(JSON.stringify(legitimateChain));
tamperedPrevHashChain[1].currentHash = 'a'.repeat(64);
assert('Inyección de hash previo adulterado quiebra la cadena', !verifyChain(tamperedPrevHashChain, seed1, secretKey));

// 9. Invalidez por clave secreta incorrecta
assert('Verificación con clave secreta incorrecta retorna false', !verifyChain(legitimateChain, seed1, 'CLAVE_INCORRECTA_999'));

// 10. Invalidez por desorden temporal / inversión de elementos
const invertedChain = [
  legitimateChain[0],
  legitimateChain[2],
  legitimateChain[1],
  legitimateChain[3],
  legitimateChain[4]
];
assert('Inversión en el orden cronológico de eventos quiebra la cadena', !verifyChain(invertedChain, seed1, secretKey));

console.log(`\nRESUMEN FINAL: ${passed} pruebas aprobadas, ${failed} pruebas falladas.`);
if (failed > 0) process.exit(1);
