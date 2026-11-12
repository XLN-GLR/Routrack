-- ==============================================================================
-- ROUTRACK — Migración Inicial: Extensiones, Esquema Espacial PostGIS y RLS
-- Archivo: 20260101000000_initial_schema.sql
-- Motor: PostgreSQL 15+ / PostGIS 3.3+ (Supabase)
-- ==============================================================================

-- 1. HABILITACIÓN DE EXTENSIONES CRÍTICAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ------------------------------------------------------------------------------
-- 2. FUNCIONES DE CONTEXTO DE SEGURIDAD (JWT CLAIMS)
-- ------------------------------------------------------------------------------
-- Extrae el ID de organización desde los metadatos del token JWT
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

-- Extrae el rol operativo desde los metadatos del token JWT
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
    identificacion_fiscal TEXT NOT NULL UNIQUE, -- RUC / NIF empresarial
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

-- 3.3. Tabla: clientes (Puntos de Venta y Geocercas)
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

-- 3.6. Tabla: actividades_comerciales (Visitas, Observaciones y Precios)
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

-- 3.7. Tabla: bitacora_auditoria (Auditoría Forense e Inmutable)
CREATE TABLE IF NOT EXISTS public.bitacora_auditoria (
    id BIGSERIAL PRIMARY KEY,
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
    tipo_evento TEXT NOT NULL, -- GPS_DISABLED, SIGNAL_LOST, MOCK_LOCATION_DETECTED, SHIFT_OPENED, SHIFT_CLOSED
    severidad TEXT NOT NULL CHECK (severidad IN ('INFO', 'WARNING', 'CRITICAL')),
    metadatos JSONB NOT NULL DEFAULT '{}'::JSONB,
    ubicacion GEOMETRY(Point, 4326),
    hmac_hash TEXT NOT NULL,
    previous_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. ÍNDICES ESPACIALES GIST Y DE RENDIMIENTO B-TREE
-- ------------------------------------------------------------------------------

-- Índices Espaciales GiST en tipos GEOMETRY(Point, 4326)
CREATE INDEX IF NOT EXISTS idx_clientes_ubicacion ON public.clientes USING GIST (ubicacion);
CREATE INDEX IF NOT EXISTS idx_jornadas_ubicacion_inicio ON public.jornadas_laborales USING GIST (ubicacion_inicio);
CREATE INDEX IF NOT EXISTS idx_jornadas_ubicacion_fin ON public.jornadas_laborales USING GIST (ubicacion_fin) WHERE ubicacion_fin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ubicaciones_gps_ubicacion ON public.ubicaciones_gps USING GIST (ubicacion);
CREATE INDEX IF NOT EXISTS idx_actividades_checkin_ubicacion ON public.actividades_comerciales USING GIST (ubicacion_check_in);
CREATE INDEX IF NOT EXISTS idx_actividades_checkout_ubicacion ON public.actividades_comerciales USING GIST (ubicacion_check_out) WHERE ubicacion_check_out IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bitacora_ubicacion ON public.bitacora_auditoria USING GIST (ubicacion) WHERE ubicacion IS NOT NULL;

-- Índices B-Tree de Aislamiento Organizacional y Consultas
CREATE INDEX IF NOT EXISTS idx_perfiles_org ON public.perfiles (organizacion_id, rol);
CREATE INDEX IF NOT EXISTS idx_clientes_org ON public.clientes (organizacion_id, activo);
CREATE INDEX IF NOT EXISTS idx_jornadas_org_vendedor ON public.jornadas_laborales (organizacion_id, vendedor_id, fecha_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_jornada_tiempo ON public.ubicaciones_gps (jornada_id, registrado_en ASC);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_org ON public.ubicaciones_gps (organizacion_id);
CREATE INDEX IF NOT EXISTS idx_actividades_cliente ON public.actividades_comerciales (cliente_id);
CREATE INDEX IF NOT EXISTS idx_actividades_jornada ON public.actividades_comerciales (jornada_id);
CREATE INDEX IF NOT EXISTS idx_actividades_org ON public.actividades_comerciales (organizacion_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_org_tiempo ON public.bitacora_auditoria (organizacion_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 5. VISTAS DE COMPATIBILIDAD (Para consultas internacionales o bilingües)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.organizations AS SELECT * FROM public.organizaciones;
CREATE OR REPLACE VIEW public.profiles AS SELECT * FROM public.perfiles;
CREATE OR REPLACE VIEW public.clients AS SELECT * FROM public.clientes;
CREATE OR REPLACE VIEW public.work_shifts AS SELECT * FROM public.jornadas_laborales;
CREATE OR REPLACE VIEW public.tracking_points AS SELECT * FROM public.ubicaciones_gps;
CREATE OR REPLACE VIEW public.visit_records AS SELECT * FROM public.actividades_comerciales;
CREATE OR REPLACE VIEW public.audit_logs AS SELECT * FROM public.bitacora_auditoria;

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

-- ------------------------------------------------------------------------------
-- 7. POLÍTICAS RLS (AISLAMIENTO MULTI-TENANT Y ROLES)
-- ------------------------------------------------------------------------------

-- 7.1. Políticas para organizaciones
CREATE POLICY "RLS_organizaciones_select" ON public.organizaciones
FOR SELECT USING (id = public.jwt_organizacion_id());

CREATE POLICY "RLS_organizaciones_admin_update" ON public.organizaciones
FOR UPDATE USING (
  id = public.jwt_organizacion_id() AND
  public.jwt_rol() = 'ADMIN'
);

-- 7.2. Políticas para perfiles
CREATE POLICY "RLS_perfiles_select" ON public.perfiles
FOR SELECT USING (id = auth.uid() OR organizacion_id = public.jwt_organizacion_id());

CREATE POLICY "RLS_perfiles_admin_mutate" ON public.perfiles
FOR ALL USING (
  organizacion_id = public.jwt_organizacion_id() AND
  public.jwt_rol() = 'ADMIN'
);

CREATE POLICY "RLS_perfiles_self_update" ON public.perfiles
FOR UPDATE USING (
  id = auth.uid() AND
  organizacion_id = public.jwt_organizacion_id()
);

-- 7.3. Políticas para clientes
CREATE POLICY "RLS_clientes_select" ON public.clientes
FOR SELECT USING (organizacion_id = public.jwt_organizacion_id());

CREATE POLICY "RLS_clientes_admin_mutate" ON public.clientes
FOR ALL USING (
  organizacion_id = public.jwt_organizacion_id() AND
  public.jwt_rol() = 'ADMIN'
);

-- 7.4. Políticas para jornadas_laborales
CREATE POLICY "RLS_jornadas_vendedor_all" ON public.jornadas_laborales
FOR ALL USING (
  organizacion_id = public.jwt_organizacion_id() AND
  vendedor_id = auth.uid()
)
WITH CHECK (
  organizacion_id = public.jwt_organizacion_id() AND
  vendedor_id = auth.uid()
);

CREATE POLICY "RLS_jornadas_supervision_select" ON public.jornadas_laborales
FOR SELECT USING (
  organizacion_id = public.jwt_organizacion_id() AND
  public.jwt_rol() IN ('SUPERVISOR', 'ADMIN')
);

-- 7.5. Políticas para ubicaciones_gps
CREATE POLICY "RLS_ubicaciones_vendedor_insert" ON public.ubicaciones_gps
FOR INSERT WITH CHECK (
  organizacion_id = public.jwt_organizacion_id() AND
  vendedor_id = auth.uid()
);

CREATE POLICY "RLS_ubicaciones_vendedor_select" ON public.ubicaciones_gps
FOR SELECT USING (
  organizacion_id = public.jwt_organizacion_id() AND
  vendedor_id = auth.uid()
);

CREATE POLICY "RLS_ubicaciones_supervision_select" ON public.ubicaciones_gps
FOR SELECT USING (
  organizacion_id = public.jwt_organizacion_id() AND
  public.jwt_rol() IN ('SUPERVISOR', 'ADMIN')
);

-- 7.6. Políticas para actividades_comerciales
CREATE POLICY "RLS_actividades_vendedor_all" ON public.actividades_comerciales
FOR ALL USING (
  organizacion_id = public.jwt_organizacion_id() AND
  vendedor_id = auth.uid()
)
WITH CHECK (
  organizacion_id = public.jwt_organizacion_id() AND
  vendedor_id = auth.uid()
);

CREATE POLICY "RLS_actividades_supervision_select" ON public.actividades_comerciales
FOR SELECT USING (
  organizacion_id = public.jwt_organizacion_id() AND
  public.jwt_rol() IN ('SUPERVISOR', 'ADMIN')
);

-- 7.7. Políticas para bitacora_auditoria (SOLO INSERCIÓN / LECTURA RESTRINGIDA)
CREATE POLICY "RLS_bitacora_insert_all" ON public.bitacora_auditoria
FOR INSERT WITH CHECK (
  organizacion_id = public.jwt_organizacion_id()
);

CREATE POLICY "RLS_bitacora_admin_select" ON public.bitacora_auditoria
FOR SELECT USING (
  organizacion_id = public.jwt_organizacion_id() AND
  public.jwt_rol() IN ('SUPERVISOR', 'ADMIN')
);

-- Bloqueo explícito de UPDATE y DELETE en bitácora (Inmutabilidad garantizada)
-- (Al no haber políticas para UPDATE ni DELETE, PostgreSQL RLS las deniega universalmente)
