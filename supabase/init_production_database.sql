-- ==============================================================================
-- ROUTRACK — SCRIPT MAESTRO DE INICIALIZACIÓN COMPLETA DE BASE DE DATOS (SUPABASE)
-- Motor: PostgreSQL 15+ / PostGIS 3.3+
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > RUN
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HABILITACIÓN DE EXTENSIONES CRÍTICAS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ------------------------------------------------------------------------------
-- 2. FUNCIONES DE CONTEXTO DE SEGURIDAD (JWT CLAIMS PARA RLS)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jwt_organizacion_id()
RETURNS UUID AS $$
  SELECT NULLIF(
    COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'organization_id'),
      (auth.jwt() -> 'app_metadata' ->> 'organizacion_id'),
      current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'organization_id',
      current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'organizacion_id'
    ),
    ''
  )::UUID;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION public.jwt_rol()
RETURNS TEXT AS $$
  SELECT NULLIF(
    COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'role'),
      (auth.jwt() -> 'app_metadata' ->> 'rol'),
      current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role',
      current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'rol'
    ),
    ''
  );
$$ LANGUAGE SQL STABLE;

-- ------------------------------------------------------------------------------
-- 3. ESQUEMA DE TABLAS
-- ------------------------------------------------------------------------------

-- 3.1. Tabla: organizaciones (Multi-Tenant Core)
CREATE TABLE IF NOT EXISTS public.organizaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    identificacion_fiscal TEXT NOT NULL UNIQUE, -- RUC empresarial
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2. Tabla: perfiles (Vinculada a auth.users con roles RBAC)
CREATE TABLE IF NOT EXISTS public.perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    rol TEXT NOT NULL CHECK (rol IN ('ADMIN', 'SUPERVISOR', 'VENDEDOR')),
    nombre_completo TEXT NOT NULL,
    email TEXT NOT NULL,
    telefono TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.3. Tabla: clientes (Puntos de Venta y Geocercas PostGIS)
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    nombre_comercial TEXT,
    identificacion_fiscal TEXT,
    direccion TEXT NOT NULL,
    telefono TEXT,
    ubicacion GEOMETRY(Point, 4326) NOT NULL,
    radio_tolerancia_metros INTEGER NOT NULL DEFAULT 50 CHECK (radio_tolerancia_metros > 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.4. Tabla: jornadas_laborales (Turnos de Trabajo del Vendedor)
CREATE TABLE IF NOT EXISTS public.jornadas_laborales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    vendedor_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
    fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_fin TIMESTAMPTZ,
    estado TEXT NOT NULL DEFAULT 'OPEN' CHECK (estado IN ('OPEN', 'CLOSED', 'ABORTED')),
    ubicacion_inicio GEOMETRY(Point, 4326) NOT NULL,
    ubicacion_fin GEOMETRY(Point, 4326),
    distancia_total_km NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    bateria_inicio INTEGER CHECK (bateria_inicio BETWEEN 0 AND 100),
    bateria_fin INTEGER CHECK (bateria_fin BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.5. Tabla: ubicaciones_gps (Telemetría de Ruta Histórica)
CREATE TABLE IF NOT EXISTS public.ubicaciones_gps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    jornada_id UUID NOT NULL REFERENCES public.jornadas_laborales(id) ON DELETE CASCADE,
    vendedor_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
    ubicacion GEOMETRY(Point, 4326) NOT NULL,
    precision_metros REAL NOT NULL,
    velocidad_ms REAL,
    altitud_metros REAL,
    orientacion_grados REAL,
    nivel_bateria INTEGER CHECK (nivel_bateria BETWEEN 0 AND 100),
    es_simulado BOOLEAN NOT NULL DEFAULT FALSE,
    hmac_hash TEXT NOT NULL,
    previous_hash TEXT NOT NULL,
    registrado_en TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.6. Tabla: actividades_comerciales (Visitas Comerciales)
CREATE TABLE IF NOT EXISTS public.actividades_comerciales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    jornada_id UUID NOT NULL REFERENCES public.jornadas_laborales(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    vendedor_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
    hora_check_in TIMESTAMPTZ NOT NULL,
    hora_check_out TIMESTAMPTZ,
    ubicacion_check_in GEOMETRY(Point, 4326) NOT NULL,
    ubicacion_check_out GEOMETRY(Point, 4326),
    distancia_cliente_metros REAL NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('VERIFIED', 'OUT_OF_RANGE', 'CANCELLED')),
    observaciones TEXT,
    precios_pactados_compromisos JSONB DEFAULT '{}'::JSONB,
    hmac_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.7. Tabla: bitacora_auditoria (Bitácora Forense e Inmutable)
CREATE TABLE IF NOT EXISTS public.bitacora_auditoria (
    id BIGSERIAL PRIMARY KEY,
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
    client_id UUID,
    tipo_evento TEXT NOT NULL,
    severidad TEXT NOT NULL CHECK (severidad IN ('INFO', 'WARNING', 'CRITICAL')),
    metadatos JSONB NOT NULL DEFAULT '{}'::JSONB,
    ubicacion GEOMETRY(Point, 4326),
    hmac_hash TEXT NOT NULL,
    previous_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.8. Tabla: sync_batches (Control de Idempotencia en Lotes)
CREATE TABLE IF NOT EXISTS public.sync_batches (
    id UUID PRIMARY KEY,
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

-- ------------------------------------------------------------------------------
-- 4. ÍNDICES ESPACIALES GIST Y B-TREE DE IDEMPOTENCIA
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_clientes_ubicacion ON public.clientes USING GIST (ubicacion);
CREATE INDEX IF NOT EXISTS idx_jornadas_ubicacion_inicio ON public.jornadas_laborales USING GIST (ubicacion_inicio);
CREATE INDEX IF NOT EXISTS idx_jornadas_ubicacion_fin ON public.jornadas_laborales USING GIST (ubicacion_fin) WHERE ubicacion_fin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ubicaciones_gps_ubicacion ON public.ubicaciones_gps USING GIST (ubicacion);
CREATE INDEX IF NOT EXISTS idx_actividades_checkin_ubicacion ON public.actividades_comerciales USING GIST (ubicacion_check_in);
CREATE INDEX IF NOT EXISTS idx_actividades_checkout_ubicacion ON public.actividades_comerciales USING GIST (ubicacion_check_out) WHERE ubicacion_check_out IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bitacora_ubicacion ON public.bitacora_auditoria USING GIST (ubicacion) WHERE ubicacion IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_perfiles_org ON public.perfiles (organizacion_id, rol);
CREATE INDEX IF NOT EXISTS idx_clientes_org ON public.clientes (organizacion_id, activo);
CREATE INDEX IF NOT EXISTS idx_jornadas_org_vendedor ON public.jornadas_laborales (organizacion_id, vendedor_id, fecha_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_jornada_tiempo ON public.ubicaciones_gps (jornada_id, registrado_en ASC);
CREATE INDEX IF NOT EXISTS idx_actividades_cliente ON public.actividades_comerciales (cliente_id);
CREATE INDEX IF NOT EXISTS idx_sync_batches_org_vendedor ON public.sync_batches (organizacion_id, vendedor_id, procesado_en DESC);

-- Índices Únicos de Idempotencia
CREATE UNIQUE INDEX IF NOT EXISTS idx_bitacora_org_hmac_hash ON public.bitacora_auditoria (organizacion_id, hmac_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ubicaciones_jornada_hmac ON public.ubicaciones_gps (jornada_id, hmac_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_actividades_jornada_hmac ON public.actividades_comerciales (jornada_id, hmac_hash);

-- ------------------------------------------------------------------------------
-- 5. VISTAS DE COMPATIBILIDAD
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.organizations AS SELECT * FROM public.organizaciones;
CREATE OR REPLACE VIEW public.profiles AS SELECT * FROM public.perfiles;
CREATE OR REPLACE VIEW public.clients AS SELECT * FROM public.clientes;
CREATE OR REPLACE VIEW public.work_shifts AS SELECT * FROM public.jornadas_laborales;
CREATE OR REPLACE VIEW public.tracking_points AS SELECT * FROM public.ubicaciones_gps;
CREATE OR REPLACE VIEW public.visit_records AS SELECT * FROM public.actividades_comerciales;
CREATE OR REPLACE VIEW public.audit_logs AS SELECT * FROM public.bitacora_auditoria;
CREATE OR REPLACE VIEW public.sync_batches_view AS SELECT * FROM public.sync_batches;

-- ------------------------------------------------------------------------------
-- 6. ACTIVACIÓN ESTRICTA DE ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.organizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jornadas_laborales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ubicaciones_gps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actividades_comerciales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bitacora_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_batches ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 7. POLÍTICAS RLS (AISLAMIENTO MULTI-TENANT Y ROLES)
-- ------------------------------------------------------------------------------

-- Organizaciones
DROP POLICY IF EXISTS "RLS_organizaciones_select" ON public.organizaciones;
CREATE POLICY "RLS_organizaciones_select" ON public.organizaciones
FOR SELECT USING (id = public.jwt_organizacion_id());

DROP POLICY IF EXISTS "RLS_organizaciones_admin_update" ON public.organizaciones;
CREATE POLICY "RLS_organizaciones_admin_update" ON public.organizaciones
FOR UPDATE USING (id = public.jwt_organizacion_id() AND public.jwt_rol() = 'ADMIN');

-- Perfiles
DROP POLICY IF EXISTS "RLS_perfiles_select" ON public.perfiles;
CREATE POLICY "RLS_perfiles_select" ON public.perfiles
FOR SELECT USING (id = auth.uid() OR organizacion_id = public.jwt_organizacion_id());

DROP POLICY IF EXISTS "RLS_perfiles_admin_mutate" ON public.perfiles;
CREATE POLICY "RLS_perfiles_admin_mutate" ON public.perfiles
FOR ALL USING (organizacion_id = public.jwt_organizacion_id() AND public.jwt_rol() = 'ADMIN');

DROP POLICY IF EXISTS "RLS_perfiles_self_update" ON public.perfiles;
CREATE POLICY "RLS_perfiles_self_update" ON public.perfiles
FOR UPDATE USING (id = auth.uid() AND organizacion_id = public.jwt_organizacion_id());

-- Clientes
DROP POLICY IF EXISTS "RLS_clientes_select" ON public.clientes;
CREATE POLICY "RLS_clientes_select" ON public.clientes
FOR SELECT USING (organizacion_id = public.jwt_organizacion_id());

DROP POLICY IF EXISTS "RLS_clientes_admin_mutate" ON public.clientes;
CREATE POLICY "RLS_clientes_admin_mutate" ON public.clientes
FOR ALL USING (organizacion_id = public.jwt_organizacion_id() AND public.jwt_rol() = 'ADMIN');

-- Jornadas Laborales
DROP POLICY IF EXISTS "RLS_jornadas_vendedor_all" ON public.jornadas_laborales;
CREATE POLICY "RLS_jornadas_vendedor_all" ON public.jornadas_laborales
FOR ALL USING (organizacion_id = public.jwt_organizacion_id() AND vendedor_id = auth.uid())
WITH CHECK (organizacion_id = public.jwt_organizacion_id() AND vendedor_id = auth.uid());

DROP POLICY IF EXISTS "RLS_jornadas_supervision_select" ON public.jornadas_laborales;
CREATE POLICY "RLS_jornadas_supervision_select" ON public.jornadas_laborales
FOR SELECT USING (organizacion_id = public.jwt_organizacion_id() AND public.jwt_rol() IN ('SUPERVISOR', 'ADMIN'));

-- Ubicaciones GPS
DROP POLICY IF EXISTS "RLS_ubicaciones_vendedor_insert" ON public.ubicaciones_gps;
CREATE POLICY "RLS_ubicaciones_vendedor_insert" ON public.ubicaciones_gps
FOR INSERT WITH CHECK (organizacion_id = public.jwt_organizacion_id() AND vendedor_id = auth.uid());

DROP POLICY IF EXISTS "RLS_ubicaciones_vendedor_select" ON public.ubicaciones_gps;
CREATE POLICY "RLS_ubicaciones_vendedor_select" ON public.ubicaciones_gps
FOR SELECT USING (organizacion_id = public.jwt_organizacion_id() AND vendedor_id = auth.uid());

DROP POLICY IF EXISTS "RLS_ubicaciones_supervision_select" ON public.ubicaciones_gps;
CREATE POLICY "RLS_ubicaciones_supervision_select" ON public.ubicaciones_gps
FOR SELECT USING (organizacion_id = public.jwt_organizacion_id() AND public.jwt_rol() IN ('SUPERVISOR', 'ADMIN'));

-- Actividades Comerciales (Visitas)
DROP POLICY IF EXISTS "RLS_actividades_vendedor_all" ON public.actividades_comerciales;
CREATE POLICY "RLS_actividades_vendedor_all" ON public.actividades_comerciales
FOR ALL USING (organizacion_id = public.jwt_organizacion_id() AND vendedor_id = auth.uid())
WITH CHECK (organizacion_id = public.jwt_organizacion_id() AND vendedor_id = auth.uid());

DROP POLICY IF EXISTS "RLS_actividades_supervision_select" ON public.actividades_comerciales;
CREATE POLICY "RLS_actividades_supervision_select" ON public.actividades_comerciales
FOR SELECT USING (organizacion_id = public.jwt_organizacion_id() AND public.jwt_rol() IN ('SUPERVISOR', 'ADMIN'));

-- Bitácora de Auditoría (Insert para todos en la org; Select para Admin/Supervisor; UPDATE/DELETE denegados)
DROP POLICY IF EXISTS "RLS_bitacora_insert_all" ON public.bitacora_auditoria;
CREATE POLICY "RLS_bitacora_insert_all" ON public.bitacora_auditoria
FOR INSERT WITH CHECK (organizacion_id = public.jwt_organizacion_id());

DROP POLICY IF EXISTS "RLS_bitacora_admin_select" ON public.bitacora_auditoria;
CREATE POLICY "RLS_bitacora_admin_select" ON public.bitacora_auditoria
FOR SELECT USING (organizacion_id = public.jwt_organizacion_id() AND public.jwt_rol() IN ('SUPERVISOR', 'ADMIN'));

-- Sync Batches
DROP POLICY IF EXISTS "Admins y Supervisores pueden consultar sync_batches de su org" ON public.sync_batches;
CREATE POLICY "Admins y Supervisores pueden consultar sync_batches de su org" ON public.sync_batches
FOR SELECT USING (organizacion_id = public.jwt_organizacion_id() AND public.jwt_rol() IN ('ADMIN', 'SUPERVISOR'));

DROP POLICY IF EXISTS "Vendedores pueden insertar sus sync_batches" ON public.sync_batches;
CREATE POLICY "Vendedores pueden insertar sus sync_batches" ON public.sync_batches
FOR INSERT WITH CHECK (organizacion_id = public.jwt_organizacion_id() AND vendedor_id = auth.uid());

DROP POLICY IF EXISTS "Vendedores pueden consultar sus propios sync_batches" ON public.sync_batches;
CREATE POLICY "Vendedores pueden consultar sus propios sync_batches" ON public.sync_batches
FOR SELECT USING (organizacion_id = public.jwt_organizacion_id() AND vendedor_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 8. FUNCIONES ESPACIALES POSTGIS (TASK-019 Y TASK-007)
-- ------------------------------------------------------------------------------

-- 8.1. Función de Distancia y Geocerca
CREATE OR REPLACE FUNCTION public.calcular_distancia_geocerca_cliente(
    p_cliente_id UUID,
    p_ubicacion_check_in GEOMETRY(Point, 4326)
)
RETURNS TABLE (
    distancia_metros REAL,
    radio_tolerancia_metros INTEGER,
    dentro_de_geocerca BOOLEAN,
    estado_evaluado TEXT
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_cliente_ubicacion GEOMETRY(Point, 4326);
    v_tolerancia INTEGER;
    v_distancia_calculada REAL;
    v_dentro BOOLEAN;
    v_estado TEXT;
BEGIN
    SELECT c.ubicacion, c.radio_tolerancia_metros
    INTO v_cliente_ubicacion, v_tolerancia
    FROM public.clientes c
    WHERE c.id = p_cliente_id;

    IF NOT FOUND OR v_cliente_ubicacion IS NULL THEN
        RETURN QUERY SELECT 0.0::REAL, 50::INTEGER, FALSE, 'OUT_OF_RANGE'::TEXT;
        RETURN;
    END IF;

    v_tolerancia := COALESCE(v_tolerancia, 50);

    v_distancia_calculada := ROUND(
        ST_Distance(v_cliente_ubicacion::geography, p_ubicacion_check_in::geography)::numeric, 
        2
    )::REAL;

    v_dentro := ST_DWithin(v_cliente_ubicacion::geography, p_ubicacion_check_in::geography, v_tolerancia);

    IF v_dentro THEN
        v_estado := 'VERIFIED';
    ELSE
        v_estado := 'OUT_OF_RANGE';
    END IF;

    RETURN QUERY SELECT v_distancia_calculada, v_tolerancia, v_dentro, v_estado;
END;
$$;

-- 8.2. RPC para Edge Functions
CREATE OR REPLACE FUNCTION public.evaluar_geocerca_visita(
    p_cliente_id UUID,
    p_latitud DOUBLE PRECISION,
    p_longitud DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_punto GEOMETRY(Point, 4326);
    v_resultado RECORD;
    v_nombre_cliente TEXT;
BEGIN
    IF p_latitud < -90.0 OR p_latitud > 90.0 OR p_longitud < -180.0 OR p_longitud > 180.0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Coordenadas geográficas fuera de rango WGS84');
    END IF;

    v_punto := ST_SetSRID(ST_MakePoint(p_longitud, p_latitud), 4326);

    SELECT c.nombre INTO v_nombre_cliente
    FROM public.clientes c
    WHERE c.id = p_cliente_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cliente especificado no existe');
    END IF;

    SELECT * INTO v_resultado
    FROM public.calcular_distancia_geocerca_cliente(p_cliente_id, v_punto);

    RETURN jsonb_build_object(
        'success', true,
        'client_id', p_cliente_id,
        'client_name', v_nombre_cliente,
        'distance_meters', v_resultado.distancia_metros,
        'tolerance_meters', v_resultado.radio_tolerancia_metros,
        'is_within_geofence', v_resultado.dentro_de_geocerca,
        'status', v_resultado.estado_evaluado
    );
END;
$$;

-- 8.3. Trigger Anti-Adulteración de Visitas
CREATE OR REPLACE FUNCTION public.validar_geocerca_actividad_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_evaluacion RECORD;
BEGIN
    IF NEW.ubicacion_check_in IS NOT NULL AND NEW.cliente_id IS NOT NULL THEN
        SELECT * INTO v_evaluacion
        FROM public.calcular_distancia_geocerca_cliente(NEW.cliente_id, NEW.ubicacion_check_in);

        NEW.distancia_cliente_metros := v_evaluacion.distancia_metros;
        NEW.estado := v_evaluacion.estado_evaluado;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_geocerca_visita ON public.actividades_comerciales;
CREATE TRIGGER trg_validar_geocerca_visita
BEFORE INSERT OR UPDATE OF ubicacion_check_in, cliente_id
ON public.actividades_comerciales
FOR EACH ROW
EXECUTE FUNCTION public.validar_geocerca_actividad_trigger();

-- 8.4. Función RPC de Idempotencia
CREATE OR REPLACE FUNCTION public.verificar_lote_sincronizado(
    p_batch_id UUID,
    p_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_lote RECORD;
BEGIN
    SELECT id, procesado_en, total_puntos, total_visitas, ultimo_hash_verificado
    INTO v_lote
    FROM public.sync_batches
    WHERE id = p_batch_id AND organizacion_id = p_org_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'procesado', true,
            'sync_batch_id', v_lote.id,
            'procesado_en', v_lote.procesado_en,
            'ultimo_hash', v_lote.ultimo_hash_verificado
        );
    ELSE
        RETURN jsonb_build_object('procesado', false);
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. INICIALIZACIÓN DE DATOS (ORGANIZACIÓN Y USUARIO ADMINISTRADOR)
-- ------------------------------------------------------------------------------

-- 9.1. Organización Matriz de ROUTRACK
INSERT INTO public.organizaciones (id, nombre, identificacion_fiscal, activo)
VALUES ('11111111-1111-4111-8111-111111111111', 'Corporación Principal', '1790011223001', TRUE)
ON CONFLICT (identificacion_fiscal) DO NOTHING;

-- 9.2. Clientes Semilla en Quito con Geocercas PostGIS para Pruebas Operativas
INSERT INTO public.clientes (id, organizacion_id, nombre, nombre_comercial, identificacion_fiscal, direccion, ubicacion, radio_tolerancia_metros, activo)
VALUES 
(
    'c1111111-0001-0000-0000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'Farmacia Central Mariscal',
    'Farmacias Económicas',
    '1791234567001',
    'Av. Amazonas y Colón, Quito',
    ST_SetSRID(ST_MakePoint(-78.4890, -0.1985), 4326),
    50,
    TRUE
),
(
    'c1111111-0002-0000-0000-000000000002',
    '11111111-1111-4111-8111-111111111111',
    'Supermercado La Carolina',
    'Supermaxi Carolina',
    '1792345678001',
    'Av. de los Shyris y Naciones Unidas, Quito',
    ST_SetSRID(ST_MakePoint(-78.4812, -0.1805), 4326),
    75,
    TRUE
),
(
    'c1111111-0003-0000-0000-000000000003',
    '11111111-1111-4111-8111-111111111111',
    'Distribuidora Villaflora',
    'Distribuidora del Sur',
    '1793456789001',
    'Av. Rodrigo de Chávez y Maldonado, Quito',
    ST_SetSRID(ST_MakePoint(-78.5180, -0.2390), 4326),
    60,
    TRUE
)
ON CONFLICT (id) DO NOTHING;

-- 9.3. Vincular Usuario Administrador (bjacnier28giler@gmail.com)
-- Si el usuario ya fue creado en Authentication > Users, se vincula automáticamente como ADMIN.
-- Si aún no ha sido creado, esta consulta no arroja error y se ejecutará limpiamente.
INSERT INTO public.perfiles (id, organizacion_id, rol, nombre_completo, email, activo)
SELECT 
    id, 
    '11111111-1111-4111-8111-111111111111', 
    'ADMIN', 
    'Bryan Jacnier Giler', 
    email, 
    TRUE
FROM auth.users 
WHERE email = 'bjacnier28giler@gmail.com'
ON CONFLICT (id) DO UPDATE 
SET rol = 'ADMIN', activo = TRUE, organizacion_id = '11111111-1111-4111-8111-111111111111';

-- Sincronizar metadatos JWT en auth.users si ya existe
DO $$
BEGIN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
        '{"role": "ADMIN", "organization_id": "11111111-1111-4111-8111-111111111111"}'::jsonb
    WHERE email = 'bjacnier28giler@gmail.com';
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

