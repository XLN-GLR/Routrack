-- ==============================================================================
-- ROUTRACK — Migración: Control de Idempotencia y Trazabilidad de Lotes
-- Archivo: 20260101000003_idempotency_indexes.sql
-- Motor: PostgreSQL 15+ / PostGIS 3.3+ (Supabase)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLA DE REGISTRO DE LOTES DE SINCRONIZACIÓN (sync_batches)
-- Permite garantizar la idempotencia estricta en la ingesta serverless.
-- Si un lote ya fue procesado, el backend responde de inmediato sin reprocesar.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_batches (
    id UUID PRIMARY KEY, -- sync_batch_id generado por el cliente móvil (UUID v4)
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    vendedor_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
    jornada_id UUID NOT NULL REFERENCES public.jornadas_laborales(id) ON DELETE CASCADE,
    total_puntos INTEGER NOT NULL DEFAULT 0 CHECK (total_puntos >= 0),
    total_visitas INTEGER NOT NULL DEFAULT 0 CHECK (total_visitas >= 0),
    total_eventos INTEGER NOT NULL DEFAULT 0 CHECK (total_eventos >= 0),
    ultimo_hash_verificado TEXT,
    procesado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de búsqueda para trazabilidad y auditoría de retransmisión
CREATE INDEX IF NOT EXISTS idx_sync_batches_org_vendedor ON public.sync_batches (organizacion_id, vendedor_id, procesado_en DESC);
CREATE INDEX IF NOT EXISTS idx_sync_batches_jornada ON public.sync_batches (jornada_id);

-- ------------------------------------------------------------------------------
-- 2. AMPLIACIÓN DE BITÁCORA DE AUDITORÍA PARA INGESTA IDEMPOTENTE
-- Se añade identificador generado por cliente móvil (UUID) e índice único sobre hash
-- ------------------------------------------------------------------------------
ALTER TABLE public.bitacora_auditoria 
ADD COLUMN IF NOT EXISTS client_id UUID;

-- Índice único para prevenir inserción duplicada de eventos con el mismo hash en la organización
CREATE UNIQUE INDEX IF NOT EXISTS idx_bitacora_org_hmac_hash 
ON public.bitacora_auditoria (organizacion_id, hmac_hash);

-- Índice único opcional para client_id cuando no es nulo
CREATE UNIQUE INDEX IF NOT EXISTS idx_bitacora_client_id 
ON public.bitacora_auditoria (client_id) 
WHERE client_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 3. ÍNDICES ÚNICOS DE IDEMPOTENCIA EN TELEMETRÍA Y VISITAS
-- ------------------------------------------------------------------------------
-- Previene duplicar puntos de telemetría GPS ante retransmisiones de paquetes
CREATE UNIQUE INDEX IF NOT EXISTS idx_ubicaciones_jornada_hmac 
ON public.ubicaciones_gps (jornada_id, hmac_hash);

-- Previene duplicar registros de visitas comerciales ante reintentos
CREATE UNIQUE INDEX IF NOT EXISTS idx_actividades_jornada_hmac 
ON public.actividades_comerciales (jornada_id, hmac_hash);

-- ------------------------------------------------------------------------------
-- 4. VISTA DE COMPATIBILIDAD (sync_batches)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.sync_batches_view AS 
SELECT * FROM public.sync_batches;

-- ------------------------------------------------------------------------------
-- 5. ACTIVACIÓN ESTRICTA DE ROW LEVEL SECURITY (RLS) EN sync_batches
-- ------------------------------------------------------------------------------
ALTER TABLE public.sync_batches ENABLE ROW LEVEL SECURITY;

-- 5.1. Administradores y Supervisores: Lectura de todos los lotes de su organización
CREATE POLICY "Admins y Supervisores pueden consultar sync_batches de su org"
ON public.sync_batches
FOR SELECT
USING (
  organizacion_id = auth.jwt_organizacion_id()
  AND auth.jwt_rol() IN ('ADMIN', 'SUPERVISOR')
);

-- 5.2. Vendedores: Inserción y consulta de sus propios lotes de sincronización
CREATE POLICY "Vendedores pueden insertar sus sync_batches"
ON public.sync_batches
FOR INSERT
WITH CHECK (
  organizacion_id = auth.jwt_organizacion_id()
  AND vendedor_id = auth.uid()
);

CREATE POLICY "Vendedores pueden consultar sus propios sync_batches"
ON public.sync_batches
FOR SELECT
USING (
  organizacion_id = auth.jwt_organizacion_id()
  AND vendedor_id = auth.uid()
);

-- ------------------------------------------------------------------------------
-- 6. FUNCIÓN RPC DE IDEMPOTENCIA PARA EDGE FUNCTION (sync-jornada)
-- Permite verificar de forma atómica si un lote ya fue persistido previamente
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verificar_lote_sincronizado(
    p_batch_id UUID,
    p_org_id UUID
)
RETURNS TABLE (
    ya_procesado BOOLEAN,
    procesado_en TIMESTAMPTZ,
    total_puntos INTEGER,
    total_visitas INTEGER,
    total_eventos INTEGER,
    ultimo_hash TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        TRUE AS ya_procesado,
        sb.procesado_en,
        sb.total_puntos,
        sb.total_visitas,
        sb.total_eventos,
        sb.ultimo_hash_verificado AS ultimo_hash
    FROM public.sync_batches sb
    WHERE sb.id = p_batch_id
      AND sb.organizacion_id = p_org_id;

    -- Si no existe fila, se retorna vacío (lo cual equivale a no procesado)
END;
$$;
