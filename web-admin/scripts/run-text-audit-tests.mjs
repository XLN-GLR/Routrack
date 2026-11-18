/**
 * ROUTRACK — Suite de Pruebas Automatizadas para Auditoría de Textos (TASK-031)
 * Archivo: web-admin/scripts/run-text-audit-tests.mjs
 */

import assert from 'node:assert';
import {
  filterTextInteractions,
  calculateTextInteractionSummary,
  DEMO_TEXT_INTERACTIONS,
} from '../src/types/text-interactions.ts';

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
  }
}

console.log('\n[ROUTRACK] Ejecutando suite de pruebas: Auditoría de Textos Corporativos (TASK-031)...\n');

// 1. Pruebas de Dataset Demostrativo Base
test('1. Dataset demostrativo contiene al menos 5 registros con firmas HMAC y hashes previos', () => {
  assert.ok(DEMO_TEXT_INTERACTIONS.length >= 5, 'Debe contener al menos 5 registros');
  for (const item of DEMO_TEXT_INTERACTIONS) {
    assert.ok(item.id, 'Debe tener id UUID');
    assert.ok(item.jornada_id, 'Debe tener jornada_id');
    assert.ok(item.paquete_aplicacion, 'Debe tener paquete_aplicacion');
    assert.ok(item.texto_capturado, 'Debe tener texto_capturado');
    assert.ok(item.registrado_en, 'Debe tener registrado_en ISO 8601');
    assert.strictEqual(item.hmac_hash.length, 64, 'La firma HMAC debe tener 64 hex');
    assert.ok(item.previous_hash.length > 0, 'Debe tener previous_hash');
  }
});

// 2. Pruebas de Resumen Agregado (Summary Calculation)
test('2. calculateTextInteractionSummary calcula métricas por aplicación correctamente', () => {
  const summary = calculateTextInteractionSummary(DEMO_TEXT_INTERACTIONS);
  assert.strictEqual(summary.totalInteractions, DEMO_TEXT_INTERACTIONS.length);
  assert.strictEqual(summary.totalWhatsApp, 4, 'Debe contabilizar 4 interacciones de WhatsApp');
  assert.strictEqual(summary.totalMessaging, 1, 'Debe contabilizar 1 interacción de Mensajería SMS');
  assert.strictEqual(summary.totalOther, 0);
  assert.strictEqual(summary.uniqueSellersCount, 3, 'Debe identificar 3 asesores únicos');
});

// 3. Pruebas de Filtrado por Aplicación
test('3. filterTextInteractions filtra por paquete de aplicación específico', () => {
  const whatsappOnly = filterTextInteractions(DEMO_TEXT_INTERACTIONS, {
    searchQuery: '',
    selectedPackage: 'com.whatsapp',
    startDate: '',
    endDate: '',
    selectedSellerId: 'ALL',
  });
  assert.strictEqual(whatsappOnly.length, 4);
  assert.ok(whatsappOnly.every((i) => i.paquete_aplicacion === 'com.whatsapp'));

  const messagingOnly = filterTextInteractions(DEMO_TEXT_INTERACTIONS, {
    searchQuery: '',
    selectedPackage: 'com.google.android.apps.messaging',
    startDate: '',
    endDate: '',
    selectedSellerId: 'ALL',
  });
  assert.strictEqual(messagingOnly.length, 1);
  assert.strictEqual(messagingOnly[0].id, 'ti-003');
});

// 4. Pruebas de Búsqueda Predictiva por Palabras Clave Comerciales
test('4. filterTextInteractions busca palabras clave de negociación comercial (descuento, precio, entrega)', () => {
  const descuentoMatches = filterTextInteractions(DEMO_TEXT_INTERACTIONS, {
    searchQuery: 'descuento',
    selectedPackage: 'ALL',
    startDate: '',
    endDate: '',
    selectedSellerId: 'ALL',
  });
  assert.strictEqual(descuentoMatches.length, 1);
  assert.strictEqual(descuentoMatches[0].id, 'ti-001');

  const precioMatches = filterTextInteractions(DEMO_TEXT_INTERACTIONS, {
    searchQuery: 'precio',
    selectedPackage: 'ALL',
    startDate: '',
    endDate: '',
    selectedSellerId: 'ALL',
  });
  assert.strictEqual(precioMatches.length, 1);
  assert.strictEqual(precioMatches[0].id, 'ti-003');

  const entregaMatches = filterTextInteractions(DEMO_TEXT_INTERACTIONS, {
    searchQuery: 'entrega',
    selectedPackage: 'ALL',
    startDate: '',
    endDate: '',
    selectedSellerId: 'ALL',
  });
  assert.strictEqual(entregaMatches.length, 1);
  assert.strictEqual(entregaMatches[0].id, 'ti-002');
});

// 5. Pruebas de Búsqueda por Nombre de Asesor
test('5. filterTextInteractions busca por nombre de asesor comercial', () => {
  const carlosMatches = filterTextInteractions(DEMO_TEXT_INTERACTIONS, {
    searchQuery: 'Mendoza',
    selectedPackage: 'ALL',
    startDate: '',
    endDate: '',
    selectedSellerId: 'ALL',
  });
  assert.strictEqual(carlosMatches.length, 2);
  assert.ok(carlosMatches.every((i) => i.vendedor_id === 'vendedor-001'));
});

// 6. Pruebas de Filtrado por Asesor Específico
test('6. filterTextInteractions filtra por ID de asesor seleccionado', () => {
  const dianaMatches = filterTextInteractions(DEMO_TEXT_INTERACTIONS, {
    searchQuery: '',
    selectedPackage: 'ALL',
    startDate: '',
    endDate: '',
    selectedSellerId: 'vendedor-002',
  });
  assert.strictEqual(dianaMatches.length, 2);
  assert.ok(dianaMatches.every((i) => i.vendedor_id === 'vendedor-002'));
});

// 7. Pruebas de Filtrado por Rango de Fecha
test('7. filterTextInteractions filtra por fecha de registro', () => {
  const dateMatches = filterTextInteractions(DEMO_TEXT_INTERACTIONS, {
    searchQuery: '',
    selectedPackage: 'ALL',
    startDate: '2026-11-10',
    endDate: '2026-11-10',
    selectedSellerId: 'ALL',
  });
  assert.strictEqual(dateMatches.length, 5);

  const futureMatches = filterTextInteractions(DEMO_TEXT_INTERACTIONS, {
    searchQuery: '',
    selectedPackage: 'ALL',
    startDate: '2026-11-11',
    endDate: '',
    selectedSellerId: 'ALL',
  });
  assert.strictEqual(futureMatches.length, 0);
});

// 8. Pruebas de Filtros Combinados (App + Término + Asesor)
test('8. filterTextInteractions aplica filtros combinados simultáneamente', () => {
  const combined = filterTextInteractions(DEMO_TEXT_INTERACTIONS, {
    searchQuery: 'crédito',
    selectedPackage: 'com.whatsapp',
    startDate: '2026-11-10',
    endDate: '2026-11-10',
    selectedSellerId: 'vendedor-002',
  });
  assert.strictEqual(combined.length, 1);
  assert.strictEqual(combined[0].id, 'ti-004');
});

// 9. Pruebas de Búsqueda sin Coincidencias
test('9. filterTextInteractions retorna lista vacía ante búsqueda inexistente', () => {
  const noMatches = filterTextInteractions(DEMO_TEXT_INTERACTIONS, {
    searchQuery: 'termino_inexistente_xyz',
    selectedPackage: 'ALL',
    startDate: '',
    endDate: '',
    selectedSellerId: 'ALL',
  });
  assert.strictEqual(noMatches.length, 0);
});

// 10. Pruebas de Integridad de la Cadena Demostrativa
test('10. Cadena de custodia secuencial: Hash previo del registro 2 coincide con hash actual del registro 1', () => {
  const shift9801 = DEMO_TEXT_INTERACTIONS.filter((i) => i.jornada_id === 'sh-9801');
  assert.strictEqual(shift9801.length, 2);
  assert.strictEqual(shift9801[0].previous_hash, 'ROUTRACK-SHIFT-INIT|sh-9801');
  assert.strictEqual(shift9801[1].previous_hash, shift9801[0].hmac_hash);
});

console.log(`\n========================================`);
console.log(`RESULTADO FINAL: ${passed}/${total} pruebas aprobadas.`);
console.log(`========================================\n`);

if (passed !== total) {
  process.exit(1);
}
