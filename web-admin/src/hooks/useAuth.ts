"use client";

/**
 * ROUTRACK — Hook Reactivo de Autenticación y Estado de Sesión (useAuth)
 * Archivo: web-admin/src/hooks/useAuth.ts
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile, UserRole } from "@/types/auth";

export function useAuth() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(
    async (userId: string, email: string): Promise<UserProfile | null> => {
      try {
        const { data: profile, error: profileError } = await supabase
          .from("perfiles")
          .select("id, organizacion_id, rol, nombre_completo, email, telefono, activo, created_at, updated_at")
          .eq("id", userId)
          .maybeSingle();

        if (profileError || !profile) {
          // Si la consulta por RLS o tabla no retorna fila directa, estructurar perfil de fallback con metadatos de sesión
          const { data: sessionData } = await supabase.auth.getSession();
          const appMeta = sessionData.session?.user.app_metadata || {};
          const userMeta = sessionData.session?.user.user_metadata || {};

          return {
            id: userId,
            organization_id: (appMeta.organization_id as string) || (appMeta.organizacion_id as string) || "org-default",
            role: ((appMeta.role as UserRole) || (appMeta.rol as UserRole) || "SUPERVISOR"),
            full_name: (userMeta.full_name as string) || (userMeta.nombre_completo as string) || email.split("@")[0],
            email,
            phone: null,
            is_active: true,
          };
        }

        return {
          id: profile.id,
          organization_id: profile.organizacion_id,
          role: profile.rol as UserRole,
          full_name: profile.nombre_completo,
          email: profile.email || email,
          phone: profile.telefono,
          is_active: profile.activo,
          created_at: profile.created_at,
          updated_at: profile.updated_at,
        };
      } catch (err) {
        console.error("Error al cargar perfil de usuario:", err);
        return null;
      }
    },
    [supabase]
  );

  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      setIsLoading(true);
      setError(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          if (isMounted) {
            setUser(null);
            setIsLoading(false);
          }
          return;
        }

        const profile = await fetchProfile(session.user.id, session.user.email || "");
        if (isMounted) {
          setUser(profile);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Error al inicializar sesión");
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === "SIGNED_OUT" || !session?.user) {
        setUser(null);
        setIsLoading(false);
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        const profile = await fetchProfile(session.user.id, session.user.email || "");
        if (isMounted) {
          setUser(profile);
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
      setError(err instanceof Error ? err.message : "Error al cerrar sesión");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, router]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    signOut,
  };
}
