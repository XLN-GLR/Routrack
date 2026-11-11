import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * ROUTRACK — Middleware de Protección de Rutas y RBAC con Supabase SSR
 * Archivo: web-admin/src/middleware.ts
 *
 * Intercepta peticiones entrantes para:
 * 1. Mantener sincronizadas las cookies de sesión HttpOnly de Supabase.
 * 2. Redirigir usuarios no autenticados hacia /login.
 * 3. Bloquear con código 403 / redirección a usuarios con rol VENDEDOR (solo móvil).
 * 4. Redirigir usuarios ya autenticados lejos de /login hacia el panel principal.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login";

  // Soporte para pruebas E2E automatizadas con Playwright (TASK-024)
  const e2eSession = request.cookies.get("routrack_e2e_session")?.value;
  if (e2eSession === "supervisor" || e2eSession === "admin") {
    if (isLoginPage) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }
  if (e2eSession === "vendedor") {
    if (isLoginPage) return response;
    const unauthorizedUrl = new URL("/login", request.url);
    unauthorizedUrl.searchParams.set("error", "unauthorized_role");
    return NextResponse.redirect(unauthorizedUrl);
  }

  // Refrescar y validar sesión con getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Si no hay usuario y trata de acceder a rutas protegidas, redirigir a /login
  if (!user && !isLoginPage) {
    const redirectUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      redirectUrl.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Si hay usuario autenticado
  if (user) {
    const role = (user.app_metadata?.role as string) || (user.app_metadata?.rol as string) || "";

    // Bloqueo estricto para vendedores en el panel web administrativo
    if (role.toUpperCase() === "VENDEDOR") {
      if (isLoginPage) {
        return response;
      }
      const unauthorizedUrl = new URL("/login", request.url);
      unauthorizedUrl.searchParams.set("error", "unauthorized_role");
      return NextResponse.redirect(unauthorizedUrl);
    }

    // Si ya está autenticado y visita /login, redirigir al dashboard principal
    if (isLoginPage) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Coincidir con todas las rutas excepto recursos estáticos:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico (icono)
     * - imágenes públicas (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
