-- =============================================================================
-- ROUTRACK — Corrección de RLS: Fallback a public.perfiles para JWT Claims
-- Archivo: 20261126000000_fix_rls_jwt_claims_fallback.sql
-- =============================================================================
-- Problema resuelto:
-- Cuando un vendedor o usuario nuevo inicia sesión, Supabase GoTrue genera un
-- token JWT donde auth.jwt()->'app_metadata' no contiene 'organization_id' a menos
-- que haya sido inyectado previamente con la service_role key.
-- Esto provocaba que public.jwt_organizacion_id() retornara NULL y fallara la
-- política RLS de jornadas_laborales (Error HTTP 403 / 42501).
--
-- Solución:
-- 1. public.jwt_organizacion_id() con fallback a public.perfiles (SECURITY DEFINER).
-- 2. public.jwt_rol() con fallback a public.perfiles (SECURITY DEFINER).
-- 3. Sincronización de raw_app_meta_data en auth.users para usuarios existentes.
-- 4. Actualización del trigger on_auth_user_created para poblar raw_app_meta_data.
-- =============================================================================

-- 1. Función public.jwt_organizacion_id() con fallback resiliente
CREATE OR REPLACE FUNCTION public.jwt_organizacion_id()
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- 1. Intentar obtener desde claims del token JWT (app_metadata)
  v_org_id := NULLIF(
    COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'organization_id'),
      (auth.jwt() -> 'app_metadata' ->> 'organizacion_id'),
      current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'organization_id',
      current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'organizacion_id'
    ),
    ''
  )::UUID;

  -- 2. Si no viene en el token JWT, consultar directamente la tabla public.perfiles
  IF v_org_id IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT p.organizacion_id INTO v_org_id
    FROM public.perfiles p
    WHERE p.id = auth.uid()
    LIMIT 1;
  END IF;

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Función public.jwt_rol() con fallback resiliente
CREATE OR REPLACE FUNCTION public.jwt_rol()
RETURNS TEXT AS $$
DECLARE
  v_rol TEXT;
BEGIN
  -- 1. Intentar obtener desde claims del token JWT (app_metadata)
  v_rol := NULLIF(
    COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'role'),
      (auth.jwt() -> 'app_metadata' ->> 'rol'),
      current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role',
      current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'rol'
    ),
    ''
  );

  -- 2. Si no viene en el token JWT, consultar directamente la tabla public.perfiles
  IF v_rol IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT p.rol INTO v_rol
    FROM public.perfiles p
    WHERE p.id = auth.uid()
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_rol, 'VENDEDOR');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Asegurar que todos los usuarios registrados en auth.users tengan su perfil en public.perfiles
INSERT INTO public.perfiles (id, organizacion_id, rol, nombre_completo, email, activo)
SELECT 
    u.id, 
    COALESCE(
        (SELECT id FROM public.organizaciones LIMIT 1),
        '11111111-1111-4111-8111-111111111111'::UUID
    ), 
    'VENDEDOR', 
    COALESCE(
        u.raw_user_meta_data->>'nombre_completo', 
        u.raw_user_meta_data->>'name', 
        split_part(u.email, '@', 1)
    ), 
    COALESCE(u.email, 'sin-email@routrack.local'), 
    TRUE
FROM auth.users u
LEFT JOIN public.perfiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 4. Sincronizar raw_app_meta_data en auth.users para todos los usuarios existentes
UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
        'organization_id', p.organizacion_id,
        'organizacion_id', p.organizacion_id,
        'role', p.rol,
        'rol', p.rol
    )
FROM public.perfiles p
WHERE u.id = p.id;

-- 5. Actualizar el trigger handle_new_user para aprovisionar public.perfiles (AFTER INSERT)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    default_org_id UUID;
    user_rol TEXT;
    user_nombre TEXT;
    user_telefono TEXT;
BEGIN
    -- Determinar organización
    IF NEW.raw_user_meta_data->>'organization_id' IS NOT NULL THEN
        default_org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;
    ELSE
        SELECT id INTO default_org_id FROM public.organizaciones LIMIT 1;
        IF default_org_id IS NULL THEN
            default_org_id := '11111111-1111-4111-8111-111111111111'::UUID;
        END IF;
    END IF;

    -- Determinar rol
    user_rol := COALESCE(NEW.raw_user_meta_data->>'rol', 'VENDEDOR');
    IF user_rol NOT IN ('ADMIN', 'SUPERVISOR', 'VENDEDOR') THEN
        user_rol := 'VENDEDOR';
    END IF;

    -- Determinar nombre completo
    user_nombre := COALESCE(
        NEW.raw_user_meta_data->>'nombre_completo',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );

    user_telefono := NEW.raw_user_meta_data->>'telefono';

    -- Insertar o actualizar perfil en public.perfiles
    -- NOTA: Debe ejecutarse AFTER INSERT para que NEW.id ya exista en auth.users (Foreign Key)
    INSERT INTO public.perfiles (
        id,
        organizacion_id,
        rol,
        nombre_completo,
        email,
        telefono,
        activo
    )
    VALUES (
        NEW.id,
        default_org_id,
        user_rol,
        user_nombre,
        NEW.email,
        user_telefono,
        TRUE
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        nombre_completo = EXCLUDED.nombre_completo,
        email = EXCLUDED.email,
        activo = TRUE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reasociar el trigger como AFTER INSERT en auth.users (evita error de clave foránea en perfiles)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
