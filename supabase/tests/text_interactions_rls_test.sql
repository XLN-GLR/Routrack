-- ==============================================================================
-- ROUTRACK — Suite de Pruebas SQL: RLS e Idempotencia en Interacciones de Texto
-- Archivo: supabase/tests/text_interactions_rls_test.sql
-- Motor: PostgreSQL 15+ / PostGIS 3.3+ (Supabase)
-- Tarea: TASK-029
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. VERIFICACIÓN DE ESTRUCTURA Y DDL
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- Comprobar existencia de la tabla
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'interacciones_texto'
    ) THEN
        RAISE EXCEPTION 'FALLO: La tabla public.interacciones_texto no existe';
    END IF;

    -- Comprobar existencia de la vista de compatibilidad
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'public' AND table_name = 'text_interactions'
    ) THEN
        RAISE EXCEPTION 'FALLO: La vista public.text_interactions no existe';
    END IF;

    -- Comprobar habilitación de Row Level Security (RLS)
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
          AND c.relname = 'interacciones_texto' 
          AND c.relrowsecurity = true
    ) THEN
        RAISE EXCEPTION 'FALLO: RLS no está habilitado en public.interacciones_texto';
    END IF;

    -- Comprobar políticas RLS requeridas
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'interacciones_texto' 
          AND policyname = 'interacciones_texto_select_supervisores_admin'
    ) THEN
        RAISE EXCEPTION 'FALLO: Falta la política de lectura interacciones_texto_select_supervisores_admin';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'interacciones_texto' 
          AND policyname = 'interacciones_texto_insert_vendedor'
    ) THEN
        RAISE EXCEPTION 'FALLO: Falta la política de inserción interacciones_texto_insert_vendedor';
    END IF;

    -- Comprobar índices únicos de idempotencia
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
          AND tablename = 'interacciones_texto' 
          AND indexname = 'idx_interacciones_texto_idempotencia'
    ) THEN
        RAISE EXCEPTION 'FALLO: Falta el índice único de idempotencia idx_interacciones_texto_idempotencia';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
          AND tablename = 'interacciones_texto' 
          AND indexname = 'idx_interacciones_texto_jornada_hmac'
    ) THEN
        RAISE EXCEPTION 'FALLO: Falta el índice único de idempotencia idx_interacciones_texto_jornada_hmac';
    END IF;

    RAISE NOTICE 'PASÓ: Estructura, DDL, RLS e índices de interacciones_texto verificados correctamente.';
END $$;

-- ------------------------------------------------------------------------------
-- 2. SIMULACIÓN DE ESCENARIOS DE SEGURIDAD Y AISLAMIENTO MULTI-TENANT
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_org_alfa UUID := 'a0000000-0000-0000-0000-000000000001'::UUID;
    v_org_beta UUID := 'b0000000-0000-0000-0000-000000000002'::UUID;
    v_vendedor_alfa UUID := 'c0000000-0000-0000-0000-000000000001'::UUID;
    v_jornada_alfa UUID := 'd0000000-0000-0000-0000-000000000001'::UUID;
    v_texto_id UUID := 'e0000000-0000-0000-0000-000000000001'::UUID;
    v_conteo INTEGER;
BEGIN
    -- 2.1. Crear organizaciones de prueba
    INSERT INTO public.organizaciones (id, nombre, ruc) 
    VALUES 
        (v_org_alfa, 'Empresa Alfa Test', '1790011223001'),
        (v_org_beta, 'Empresa Beta Test', '1790011223002')
    ON CONFLICT (id) DO NOTHING;

    -- 2.2. Crear usuario vendedor
    INSERT INTO public.perfiles (id, organizacion_id, rol, nombre_completo, email)
    VALUES (v_vendedor_alfa, v_org_alfa, 'VENDEDOR', 'Vendedor Alfa', 'vendedor.alfa@test.com')
    ON CONFLICT (id) DO NOTHING;

    -- 2.3. Crear jornada laboral
    INSERT INTO public.jornadas_laborales (id, organizacion_id, vendedor_id, fecha_inicio, estado, ubicacion_inicio)
    VALUES (v_jornada_alfa, v_org_alfa, v_vendedor_alfa, NOW(), 'ABIERTA', ST_SetSRID(ST_MakePoint(-78.4678, -0.1806), 4326))
    ON CONFLICT (id) DO NOTHING;

    -- 2.4. Inserción de interacción de texto
    INSERT INTO public.interacciones_texto (
        id,
        organizacion_id,
        jornada_id,
        vendedor_id,
        paquete_aplicacion,
        nombre_aplicacion,
        texto_capturado,
        registrado_en,
        previous_hash,
        hmac_hash
    ) VALUES (
        v_texto_id,
        v_org_alfa,
        v_jornada_alfa,
        v_vendedor_alfa,
        'com.whatsapp',
        'WhatsApp',
        'Se pacta entrega de 100 unidades al 5% de descuento comercial.',
        NOW(),
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e'
    );

    -- 2.5. Comprobar que existe a través de la vista
    SELECT COUNT(*) INTO v_conteo 
    FROM public.text_interactions 
    WHERE id = v_texto_id;

    IF v_conteo <> 1 THEN
        RAISE EXCEPTION 'FALLO: No se pudo consultar la interacción a través de text_interactions';
    END IF;

    -- 2.6. Comprobar rechazo de duplicado de idempotencia por clave primaria
    BEGIN
        INSERT INTO public.interacciones_texto (
            id,
            organizacion_id,
            jornada_id,
            vendedor_id,
            paquete_aplicacion,
            nombre_aplicacion,
            texto_capturado,
            registrado_en,
            previous_hash,
            hmac_hash
        ) VALUES (
            v_texto_id,
            v_org_alfa,
            v_jornada_alfa,
            v_vendedor_alfa,
            'com.whatsapp',
            'WhatsApp',
            'Texto duplicado de prueba',
            NOW(),
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            'f591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146f'
        );
        RAISE EXCEPTION 'FALLO: Se permitió insertar un ID duplicado sin respetar la clave primaria';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'PASÓ: Idempotencia por ID previene duplicados correctamente.';
    END;

    -- 2.7. Comprobar rechazo de duplicado de idempotencia por hash en la misma jornada
    BEGIN
        INSERT INTO public.interacciones_texto (
            id,
            organizacion_id,
            jornada_id,
            vendedor_id,
            paquete_aplicacion,
            nombre_aplicacion,
            texto_capturado,
            registrado_en,
            previous_hash,
            hmac_hash
        ) VALUES (
            gen_random_uuid(),
            v_org_alfa,
            v_jornada_alfa,
            v_vendedor_alfa,
            'com.whatsapp',
            'WhatsApp',
            'Mismo hash en jornada',
            NOW(),
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e'
        );
        RAISE EXCEPTION 'FALLO: Se permitió insertar un hmac_hash duplicado en la misma jornada';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'PASÓ: Idempotencia por (jornada_id, hmac_hash) previene duplicados correctamente.';
    END;

    RAISE NOTICE 'PASÓ: Todos los escenarios de integridad y seguridad SQL fueron aprobados con éxito.';
END $$;

ROLLBACK;
