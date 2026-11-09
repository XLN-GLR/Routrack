-- ==============================================================================
-- ROUTRACK — Migración: Función Espacial de Validación de Geocercas PostGIS
-- Archivo: 20261106000005_visit_validation_function.sql
-- Tarea: TASK-019 (Fase 6 — Validación Espacial de Geocercas con PostGIS)
-- Motor: PostgreSQL 15+ / PostGIS 3.3+ (Supabase)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FUNCIÓN POSTGIS: calcular_distancia_geocerca_cliente
-- ------------------------------------------------------------------------------
-- Calcula geodésicamente sobre el elipsoide WGS84 la distancia exacta en metros
-- entre el punto de check-in del vendedor y las coordenadas del cliente, evaluando
-- mediante ST_DWithin si la visita se ejecutó dentro del radio de tolerancia.
-- ------------------------------------------------------------------------------
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
    -- 1. Consultar ubicación y radio de tolerancia del cliente
    SELECT c.ubicacion, c.radio_tolerancia_metros
    INTO v_cliente_ubicacion, v_tolerancia
    FROM public.clientes c
    WHERE c.id = p_cliente_id;

    -- Si el cliente no existe, retornar valores nulos con estado OUT_OF_RANGE
    IF NOT FOUND OR v_cliente_ubicacion IS NULL THEN
        RETURN QUERY SELECT 
            0.0::REAL,
            50::INTEGER,
            FALSE,
            'OUT_OF_RANGE'::TEXT;
        RETURN;
    END IF;

    -- Usar 50 metros como radio por defecto si no estuviese definido
    v_tolerancia := COALESCE(v_tolerancia, 50);

    -- 2. Cálculo geodésico exacto en metros sobre esferoide WGS84 (casteando a geography)
    v_distancia_calculada := ROUND(
        ST_Distance(v_cliente_ubicacion::geography, p_ubicacion_check_in::geography)::numeric, 
        2
    )::REAL;

    -- 3. Evaluación de geocerca con ST_DWithin
    v_dentro := ST_DWithin(v_cliente_ubicacion::geography, p_ubicacion_check_in::geography, v_tolerancia);

    -- 4. Asignación categórica de estado operativo
    IF v_dentro THEN
        v_estado := 'VERIFIED';
    ELSE
        v_estado := 'OUT_OF_RANGE';
    END IF;

    RETURN QUERY SELECT 
        v_distancia_calculada,
        v_tolerancia,
        v_dentro,
        v_estado;
END;
$$;

COMMENT ON FUNCTION public.calcular_distancia_geocerca_cliente(UUID, GEOMETRY) IS 
'Calcula geodésicamente la distancia en metros entre el check-in y el cliente, asignando VERIFIED si ST_DWithin es verdadero o OUT_OF_RANGE si excede la tolerancia.';

-- ------------------------------------------------------------------------------
-- 2. FUNCIÓN RPC: evaluar_geocerca_visita (Para Edge Functions y API Supabase)
-- ------------------------------------------------------------------------------
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
    -- Validar rangos de coordenadas WGS84
    IF p_latitud < -90.0 OR p_latitud > 90.0 OR p_longitud < -180.0 OR p_longitud > 180.0 THEN
        RAISE EXCEPTION 'Coordenadas WGS84 fuera de rango válido: lat=%, lon=%', p_latitud, p_longitud;
    END IF;

    -- Construir geometría WGS84 con orden X=Longitud, Y=Latitud
    v_punto := ST_SetSRID(ST_MakePoint(p_longitud, p_latitud), 4326);

    -- Obtener nombre del cliente
    SELECT c.nombre INTO v_nombre_cliente
    FROM public.clientes c
    WHERE c.id = p_cliente_id;

    -- Invocar cálculo geodésico
    SELECT * INTO v_resultado
    FROM public.calcular_distancia_geocerca_cliente(p_cliente_id, v_punto);

    RETURN jsonb_build_object(
        'cliente_id', p_cliente_id,
        'cliente_nombre', COALESCE(v_nombre_cliente, 'Cliente No Identificado'),
        'distancia_metros', v_resultado.distancia_metros,
        'radio_tolerancia_metros', v_resultado.radio_tolerancia_metros,
        'dentro_de_geocerca', v_resultado.dentro_de_geocerca,
        'estado', v_resultado.estado_evaluado
    );
END;
$$;

COMMENT ON FUNCTION public.evaluar_geocerca_visita(UUID, DOUBLE PRECISION, DOUBLE PRECISION) IS 
'Función RPC para evaluar si una coordenada se encuentra dentro de la geocerca de un cliente comercial, retornando estructura JSONB.';

-- ------------------------------------------------------------------------------
-- 3. TRIGGER AUTOMÁTICO DE AUDITORÍA: trg_validar_geocerca_visita
-- ------------------------------------------------------------------------------
-- Garantiza de manera inmutable y a nivel de motor PostgreSQL que NINGUNA visita
-- pueda persistirse con estado VERIFIED si la distancia física excede el radio de tolerancia.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_trigger_validar_geocerca_visita()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_resultado RECORD;
BEGIN
    -- Solo procesar si el registro contiene cliente y ubicación de check-in
    IF NEW.cliente_id IS NOT NULL AND NEW.ubicacion_check_in IS NOT NULL THEN
        -- Calcular distancia y estado real sobre PostGIS
        SELECT * INTO v_resultado
        FROM public.calcular_distancia_geocerca_cliente(NEW.cliente_id, NEW.ubicacion_check_in);

        IF FOUND THEN
            -- Sobrescribir distancia calculada fehacientemente por PostGIS
            NEW.distancia_cliente_metros := v_resultado.distancia_metros;
            
            -- Si la visita no fue cancelada manualmente, forzar el estado geográfico real
            IF NEW.estado != 'CANCELLED' THEN
                NEW.estado := v_resultado.estado_evaluado;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_geocerca_visita ON public.actividades_comerciales;
CREATE TRIGGER trg_validar_geocerca_visita
BEFORE INSERT OR UPDATE OF cliente_id, ubicacion_check_in
ON public.actividades_comerciales
FOR EACH ROW
EXECUTE FUNCTION public.fn_trigger_validar_geocerca_visita();

COMMENT ON TRIGGER trg_validar_geocerca_visita ON public.actividades_comerciales IS 
'Trigger BEFORE INSERT/UPDATE que calcula en PostGIS la distancia física exacta al cliente y fuerza el estado VERIFIED o OUT_OF_RANGE.';

-- ------------------------------------------------------------------------------
-- 4. PERMISOS DE EJECUCIÓN (RBAC Y SERVICE ROLE)
-- ------------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.calcular_distancia_geocerca_cliente(UUID, GEOMETRY) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.evaluar_geocerca_visita(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated, service_role;
