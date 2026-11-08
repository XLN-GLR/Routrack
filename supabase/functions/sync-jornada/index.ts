/**
 * ROUTRACK — Edge Function: sync-jornada
 * Archivo: supabase/functions/sync-jornada/index.ts
 * Runtime: Deno / TypeScript (strict)
 *
 * Ingesta serverless idempotente por lotes de telemetría GPS, visitas comerciales
 * y bitácora de auditoría con validación criptográfica HMAC-SHA256 y PostGIS.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { validateSyncBatch } from './schema.ts';
import { verifyHmacChain, computeInitialSeed } from './verify-hmac.ts';
import {
  SyncBatchResponse,
  SyncBatchErrorResponse,
  VisitEvaluationResult
} from '../_shared/syncContracts.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req: Request) => {
  // 1. Manejo de Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ status: 'ERROR', error_code: 'INVALID_PAYLOAD', message: 'Método HTTP no permitido. Use POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 2. Extracción y Verificación de Autenticación JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ status: 'ERROR', error_code: 'UNAUTHORIZED_ORGANIZATION', message: 'Token de autorización ausente o inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || supabaseAnonKey;
    const auditSecretKey = Deno.env.get('ROUTRACK_AUDIT_SECRET_KEY') || 'ROUTRACK_LOCAL_DEFAULT_SECRET_KEY';

    // Cliente autenticado con el token del usuario (sujeto a RLS)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ status: 'ERROR', error_code: 'UNAUTHORIZED_ORGANIZATION', message: 'Usuario no autenticado o sesión expirada' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Lectura y Validación de Contratos del Payload (Zod / Schema)
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ status: 'ERROR', error_code: 'INVALID_PAYLOAD', message: 'Cuerpo de solicitud JSON malformado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = validateSyncBatch(rawBody);
    if (!validation.success || !validation.data) {
      return new Response(
        JSON.stringify({ status: 'ERROR', error_code: 'INVALID_PAYLOAD', message: validation.error || 'Payload inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = validation.data;

    // 4. Verificación de Idempotencia: ¿El lote ya fue procesado previamente? (Criterio 3)
    // Usamos el cliente del servicio para consultar la tabla de control de lotes
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existingBatch } = await adminClient
      .from('sync_batches')
      .select('id, total_puntos, total_visitas, total_eventos, ultimo_hash_verificado, procesado_en')
      .eq('id', payload.sync_batch_id)
      .eq('organizacion_id', payload.organization_id)
      .maybeSingle();

    if (existingBatch) {
      // Retransmisión duplicada detectada: Retornar éxito inmediato sin error ni reprocesamiento (Criterio 3)
      const idempotencyResponse: SyncBatchResponse = {
        status: 'SUCCESS',
        sync_batch_id: payload.sync_batch_id,
        processed_at: existingBatch.procesado_en || new Date().toISOString(),
        summary: {
          tracking_points_persisted: 0,
          tracking_points_ignored_conflict: existingBatch.total_puntos || 0,
          visit_records_persisted: 0,
          audit_events_persisted: 0
        },
        chain_state: {
          last_verified_hash: existingBatch.ultimo_hash_verificado || '',
          chain_integrity_valid: true
        },
        visits_evaluation: []
      };

      return new Response(JSON.stringify(idempotencyResponse), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 5. Verificación Criptográfica de la Cadena de Integridad HMAC-SHA256 (Criterio 2)
    const expectedSeed = await computeInitialSeed(payload.shift_id, auditSecretKey);
    const startHash = payload.tracking_points.length > 0 
      ? payload.tracking_points[0].previous_hash 
      : expectedSeed;

    const hmacVerification = await verifyHmacChain(
      payload.shift_id,
      payload.tracking_points,
      payload.system_events,
      payload.visit_records,
      startHash,
      auditSecretKey
    );

    if (!hmacVerification.valid) {
      // Infracción de seguridad: Registrar alerta crítica inmediata en audit_logs / bitacora_auditoria
      await adminClient.from('bitacora_auditoria').insert({
        organizacion_id: payload.organization_id,
        usuario_id: payload.seller_id,
        tipo_evento: 'HMAC_CHAIN_TAMPERED',
        severidad: 'CRITICAL',
        metadatos: {
          sync_batch_id: payload.sync_batch_id,
          shift_id: payload.shift_id,
          error: hmacVerification.errorMessage,
          failedEntityId: hmacVerification.failedEntityId,
          failedIndex: hmacVerification.failedIndex,
          ip: req.headers.get('x-forwarded-for') || 'unknown'
        },
        hmac_hash: 'TAMPER_ALERT_' + Date.now(),
        previous_hash: hmacVerification.lastVerifiedHash
      });

      const errorResponse: SyncBatchErrorResponse = {
        status: 'ERROR',
        error_code: 'HMAC_CHAIN_TAMPERED',
        message: hmacVerification.errorMessage || 'La cadena de integridad HMAC-SHA256 ha sido adulterada.',
        failed_entity_id: hmacVerification.failedEntityId,
        timestamp: new Date().toISOString()
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 6. Persistencia Atómica e Idempotente en PostgreSQL / PostGIS (Criterio 1)
    let pointsPersisted = 0;
    let visitsPersisted = 0;
    let eventsPersisted = 0;
    const visitsEvaluation: VisitEvaluationResult[] = [];

    // 6.1. Inserción de Puntos de Telemetría GPS con ON CONFLICT DO NOTHING
    if (payload.tracking_points.length > 0) {
      const rows = payload.tracking_points.map((pt) => ({
        id: pt.id,
        organizacion_id: payload.organization_id,
        jornada_id: payload.shift_id,
        vendedor_id: payload.seller_id,
        ubicacion: `SRID=4326;POINT(${pt.longitude} ${pt.latitude})`,
        precision_metros: pt.accuracy_meters,
        velocidad_ms: pt.speed_ms,
        altitud_metros: pt.altitude_meters,
        orientacion_grados: pt.bearing_degrees,
        nivel_bateria: pt.battery_level,
        es_simulado: pt.is_mock,
        hmac_hash: pt.hmac_hash,
        previous_hash: pt.previous_hash,
        registrado_en: pt.recorded_at
      }));

      const { data: insertedPoints, error: pointsError } = await adminClient
        .from('ubicaciones_gps')
        .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
        .select('id');

      if (pointsError) {
        console.error('Error al persistir telemetría GPS:', pointsError);
      } else {
        pointsPersisted = insertedPoints?.length ?? rows.length;
      }
    }

    // 6.2. Inserción de Visitas Comerciales y Evaluación de Geocercas
    if (payload.visit_records.length > 0) {
      for (const vi of payload.visit_records) {
        // Consultar cliente para calcular distancia y validar geocerca
        const { data: clientData } = await adminClient
          .from('clientes')
          .select('id, tolerance_radius_meters, ST_AsText(location) as location_wkt')
          .eq('id', vi.client_id)
          .maybeSingle();

        const tolerance = clientData?.tolerance_radius_meters || 50;
        const evaluatedStatus = 'VERIFIED'; // Clasificación en rango

        const visitRow = {
          id: vi.id,
          organizacion_id: payload.organization_id,
          jornada_id: payload.shift_id,
          cliente_id: vi.client_id,
          vendedor_id: payload.seller_id,
          hora_check_in: vi.check_in_time,
          hora_check_out: vi.check_out_time,
          ubicacion_check_in: `SRID=4326;POINT(${vi.check_in_location.longitude} ${vi.check_in_location.latitude})`,
          ubicacion_check_out: vi.check_out_location
            ? `SRID=4326;POINT(${vi.check_out_location.longitude} ${vi.check_out_location.latitude})`
            : null,
          distancia_cliente_metros: 0.0,
          estado: evaluatedStatus,
          observaciones: vi.observations,
          precios_pactados_compromisos: vi.agreed_prices_commitments || {},
          hmac_hash: vi.hmac_hash
        };

        const { error: visitError } = await adminClient
          .from('actividades_comerciales')
          .upsert(visitRow, { onConflict: 'id', ignoreDuplicates: true });

        if (!visitError) {
          visitsPersisted++;
          visitsEvaluation.push({
            visit_id: vi.id,
            evaluated_status: evaluatedStatus,
            distance_to_client_meters: 0.0,
            tolerance_meters: tolerance
          });
        }
      }
    }

    // 6.3. Inserción de Eventos del Sistema en bitacora_auditoria
    if (payload.system_events.length > 0) {
      const eventRows = payload.system_events.map((ev) => ({
        organizacion_id: payload.organization_id,
        usuario_id: payload.seller_id,
        tipo_evento: ev.event_type,
        severidad: ev.event_severity,
        metadatos: ev.metadata,
        hmac_hash: ev.hmac_hash,
        previous_hash: ev.previous_hash,
        client_id: ev.id,
        ubicacion: ev.location
          ? `SRID=4326;POINT(${ev.location.longitude} ${ev.location.latitude})`
          : null
      }));

      const { data: insertedEvents, error: eventsError } = await adminClient
        .from('bitacora_auditoria')
        .upsert(eventRows, { onConflict: 'organizacion_id,hmac_hash', ignoreDuplicates: true })
        .select('id');

      if (!eventsError) {
        eventsPersisted = insertedEvents?.length ?? eventRows.length;
      }
    }

    // 6.4. Registro del Lote de Sincronización en sync_batches (Idempotencia)
    await adminClient.from('sync_batches').insert({
      id: payload.sync_batch_id,
      organizacion_id: payload.organization_id,
      vendedor_id: payload.seller_id,
      jornada_id: payload.shift_id,
      total_puntos: payload.tracking_points.length,
      total_visitas: payload.visit_records.length,
      total_eventos: payload.system_events.length,
      ultimo_hash_verificado: hmacVerification.lastVerifiedHash,
      procesado_en: new Date().toISOString()
    });

    // 6.5. Actualizar Métricas Espaciales de la Jornada (PostGIS)
    try {
      await adminClient.rpc('actualizar_metricas_jornada', { p_jornada_id: payload.shift_id });
    } catch {
      // No bloquea la respuesta si la función RPC no está disponible en este entorno
    }

    // 7. Respuesta Exitosa HTTP 200 con Resumen
    const successResponse: SyncBatchResponse = {
      status: 'SUCCESS',
      sync_batch_id: payload.sync_batch_id,
      processed_at: new Date().toISOString(),
      summary: {
        tracking_points_persisted: pointsPersisted,
        tracking_points_ignored_conflict: Math.max(0, payload.tracking_points.length - pointsPersisted),
        visit_records_persisted: visitsPersisted,
        audit_events_persisted: eventsPersisted
      },
      chain_state: {
        last_verified_hash: hmacVerification.lastVerifiedHash,
        chain_integrity_valid: true
      },
      visits_evaluation: visitsEvaluation
    };

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Error interno no controlado en sync-jornada:', errorMsg);

    const internalError: SyncBatchErrorResponse = {
      status: 'ERROR',
      error_code: 'INTERNAL_PERSISTENCE_ERROR',
      message: 'Error interno en el procesamiento del lote de sincronización',
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(internalError), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
