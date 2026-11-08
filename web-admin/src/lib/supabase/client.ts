import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para componentes del navegador (Client Components).
 * Utiliza variables públicas NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Sujeto estrictamente a políticas Row Level Security (RLS).
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
