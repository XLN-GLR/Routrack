"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Compass,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  ShieldAlert,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "unauthorized_role") {
      setErrorMessage(
        "Acceso no autorizado: Su usuario cuenta con rol VENDEDOR. El panel web está reservado exclusivamente para Supervisores y Administradores. Por favor ingrese desde la aplicación móvil."
      );
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage("Por favor ingrese su correo electrónico y contraseña.");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setErrorMessage("Credenciales inválidas. Verifique su correo o contraseña.");
        } else {
          setErrorMessage(error.message);
        }
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // Consultar el perfil para verificar rol
        const { data: profile } = await supabase
          .from("perfiles")
          .select("rol, activo")
          .eq("id", data.user.id)
          .maybeSingle();

        if (profile) {
          if (!profile.activo) {
            await supabase.auth.signOut();
            setErrorMessage("Su usuario se encuentra inactivo. Contacte al Administrador.");
            setIsLoading(false);
            return;
          }

          if (profile.rol === "VENDEDOR") {
            await supabase.auth.signOut();
            setErrorMessage(
              "Acceso no autorizado: Los usuarios con rol VENDEDOR deben utilizar la app móvil ROUTRACK."
            );
            setIsLoading(false);
            return;
          }
        }

        // Redirigir al dashboard protegido
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      console.error("Error en inicio de sesión:", err);
      setErrorMessage("Ocurrió un error al procesar su solicitud. Intente nuevamente.");
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Tarjeta de Inicio de Sesión */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        {/* Cabecera del Formulario */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md">
            <Compass className="h-8 w-8 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            ROUT<span className="text-blue-600">RACK</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Supervisión Operativa y Auditoría de Rutas
          </p>
        </div>

        {/* Alerta de Error (DESIGN.md) */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-lg border-l-4 border-red-500 bg-red-50 p-4 text-xs text-red-800"
          >
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
            >
              Correo Electrónico
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Mail className="h-4 w-4" />
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="supervisor@empresa.com"
                required
                disabled={isLoading}
                autoComplete="email"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
              >
                Contraseña
              </label>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                disabled={isLoading}
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600/30 active:scale-[0.99] disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Verificando credenciales...</span>
              </>
            ) : (
              <span>Iniciar Sesión</span>
            )}
          </button>
        </form>

        {/* Pie Informativo */}
        <div className="mt-8 border-t border-slate-100 pt-6 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-500 border border-slate-200">
            <ShieldAlert className="h-3.5 w-3.5 text-slate-400" />
            <span>Acceso protegido con Supabase Auth & RLS</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span>Cargando formulario...</span>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
