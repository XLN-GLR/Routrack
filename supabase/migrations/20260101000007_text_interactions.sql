-- ==============================================================================
-- ROUTRACK — Migración: Interacciones de Texto Corporativo y Auditoría Forense
-- Archivo: 20260101000007_text_interactions.sql
-- Motor: PostgreSQL 15+ / PostGIS 3.3+ (Supabase)
-- Tarea: TASK-029
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLA: interacciones_texto (Auditoría de Textos en Dispositivos Corporativos)
-- Almacena las interacciones de texto digitadas por el personal de ventas en ruta
-- en dispositivos corporativos asignados (WhatsApp, SMS, etc.) para auditoría
-- de acuerdos de precios, compromisos comerciales y prevención de disputas.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.interacciones_texto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    jornada_id UUID NOT NULL REFERENCES public.jornadas_laborales(id) ON DELETE CASCADE,
    vendedor_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
    paquete_aplicacion TEXT NOT NULL,       -- ej. 'com.whatsapp', 'org.telegram.messenger'
    nombre_aplicacion TEXT,                 -- ej. 'WhatsApp', 'Mensajería'
    texto_capturado TEXT NOT NULL,          -- Texto digitado por el vendedor
    registrado_en TIMESTAMPTZ NOT NULL,     -- Marca de tiempo UTC de captura en el móvil
    previous_hash TEXT NOT NULL,            -- Hash previo en la cadena HMAC-SHA256
    hmac_hash TEXT NOT NULL,                -- Hash encadenado de este registro
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comentarios explicativos de auditoría
COMMENT ON TABLE public.interacciones_texto IS 'Registro inmutable de interacciones de texto corporativas para auditoría de acuerdos comerciales y trazabilidad operativa.';
COMMENT ON COLUMN public.interacciones_texto.paquete_aplicacion IS 'Identificador del paquete Android de la aplicación activa al momento de la captura.';
COMMENT ON COLUMN public.interacciones_texto.texto_capturado IS 'Contenido textual digitado por el asesor (campos de contraseña estrictamente omitidos).';
COMMENT ON COLUMN public.interacciones_texto.hmac_hash IS 'Firma criptográfica HMAC-SHA256 encadenada para garantizar no repudio e inmutabilidad.';

-- ------------------------------------------------------------------------------
-- 2. ÍNDICES DE RENDIMIENTO E IDEMPOTENCIA
-- ------------------------------------------------------------------------------
-- Índice para filtrado temporal y de organización en reportes y vistas de auditoría
CREATE INDEX IF NOT EXISTS idx_interacciones_texto_org_time 
ON public.interacciones_texto (organizacion_id, registrado_en DESC);

-- Índice para consultar textos por jornada laboral ordenada cronológicamente
CREATE INDEX IF NOT EXISTS idx_interacciones_texto_jornada 
ON public.interacciones_texto (jornada_id, registrado_en ASC);

-- Índice para auditoría por vendedor
CREATE INDEX IF NOT EXISTS idx_interacciones_texto_vendedor 
ON public.interacciones_texto (vendedor_id);

-- Índice único de idempotencia sobre la clave primaria (ID asignado por el cliente)
CREATE UNIQUE INDEX IF NOT EXISTS idx_interacciones_texto_idempotencia 
ON public.interacciones_texto (id);

-- Índice único de idempotencia para evitar retransmisiones duplicadas del mismo hash en la jornada
CREATE UNIQUE INDEX IF NOT EXISTS idx_interacciones_texto_jornada_hmac 
ON public.interacciones_texto (jornada_id, hmac_hash);

-- ------------------------------------------------------------------------------
-- 3. VISTA DE COMPATIBILIDAD INTERNACIONAL (text_interactions)
-- Permite interoperabilidad transparente con contratos en inglés y frontend.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.text_interactions AS 
SELECT 
    id,
    organizacion_id AS organization_id,
    jornada_id AS shift_id,
    vendedor_id AS seller_id,
    paquete_aplicacion AS package_name,
    nombre_aplicacion AS app_label,
    texto_capturado AS captured_text,
    registrado_en AS recorded_at,
    previous_hash,
    hmac_hash,
    creado_en AS created_at
FROM public.interacciones_texto;

-- ------------------------------------------------------------------------------
-- 4. POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- Aislamiento estricto por organization_id y control de acceso basado en roles (RBAC):
-- - SELECT: Restringido a usuarios ADMIN y SUPERVISOR de la misma organización.
-- - INSERT: Permitido a VENDEDOR autenticado para su propio registro, o backend serverless.
-- - UPDATE / DELETE: Prohibidos categóricamente (Inmutabilidad / Append-Only).
-- ------------------------------------------------------------------------------
ALTER TABLE public.interacciones_texto ENABLE ROW LEVEL SECURITY;

-- Política SELECT: Supervisores y Administradores de la organización
CREATE POLICY "interacciones_texto_select_supervisores_admin"
ON public.interacciones_texto
FOR SELECT
USING (
    organizacion_id = public.jwt_organizacion_id()
    AND public.jwt_rol() IN ('ADMIN', 'SUPERVISOR')
);

-- Política INSERT: Vendedor autenticado registrando sus propias interacciones
CREATE POLICY "interacciones_texto_insert_vendedor"
ON public.interacciones_texto
FOR INSERT
WITH CHECK (
    organizacion_id = public.jwt_organizacion_id()
    AND vendedor_id = auth.uid()
);

-- ------------------------------------------------------------------------------
-- 5. ACTUALIZACIÓN DE CONTROL DE LOTES (sync_batches)
-- Añade columna para contabilizar textos persistidos por lote de sincronización.
-- ------------------------------------------------------------------------------
ALTER TABLE public.sync_batches 
ADD COLUMN IF NOT EXISTS total_textos INTEGER NOT NULL DEFAULT 0 CHECK (total_textos >= 0);
