/**
 * ROUTRACK — Tipos de Autenticación y Control de Acceso Basado en Roles (RBAC)
 * Archivo: web-admin/src/types/auth.ts
 */

export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'VENDEDOR';

/**
 * Perfil de usuario sincronizado con public.perfiles en Supabase.
 */
export interface UserProfile {
  id: string;
  organization_id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Estado reactivo del contexto de autenticación en el cliente web.
 */
export interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}
