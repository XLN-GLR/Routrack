-- =============================================================================
-- ROUTRACK — Disparadores de Autenticación y Perfil Automático
-- Archivo: 20260101000002_auth_triggers.sql
-- =============================================================================

-- Función para aprovisionar automáticamente el perfil en public.perfiles
-- cuando se crea un usuario en el módulo de Authentication de Supabase.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    default_org_id UUID;
    user_rol TEXT;
    user_nombre TEXT;
    user_telefono TEXT;
BEGIN
    -- 1. Obtener la organización por defecto o la especificada en metadata
    IF NEW.raw_user_meta_data->>'organization_id' IS NOT NULL THEN
        default_org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;
    ELSE
        SELECT id INTO default_org_id FROM public.organizaciones LIMIT 1;
        IF default_org_id IS NULL THEN
            default_org_id := '11111111-1111-4111-8111-111111111111'::UUID;
        END IF;
    END IF;

    -- 2. Determinar rol (VENDEDOR por defecto si no se especifica)
    user_rol := COALESCE(NEW.raw_user_meta_data->>'rol', 'VENDEDOR');
    IF user_rol NOT IN ('ADMIN', 'SUPERVISOR', 'VENDEDOR') THEN
        user_rol := 'VENDEDOR';
    END IF;

    -- 3. Determinar nombre completo
    user_nombre := COALESCE(
        NEW.raw_user_meta_data->>'nombre_completo',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );

    user_telefono := NEW.raw_user_meta_data->>'telefono';

    -- 4. Insertar o actualizar perfil en public.perfiles
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

-- Asociar el trigger a la tabla auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
