import React from "react";
import {
  MapPin,
  ShieldCheck,
  Activity,
  Layers,
  Database,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Clock,
  Compass,
} from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header Corporativo */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white shadow">
            <Compass className="h-6 w-6 text-blue-500 animate-spin-slow" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              ROUT<span className="text-blue-600">RACK</span>
            </span>
            <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
              v1.0.0-setup
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 border border-emerald-200 text-xs font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Entorno Base Operativo
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Banner de Estado */}
        <section className="mb-8 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white shadow-md">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-2xl">
              <span className="inline-block rounded-md bg-blue-600/30 px-3 py-1 text-xs font-semibold text-blue-300 border border-blue-500/30 mb-3">
                FASE 1 — SETUP DEL MONOREPO Y ESQUEMA POSTGIS
              </span>
              <h1 className="text-3xl font-bold tracking-tight">
                Panel Administrativo y Supervisión en Ruta
              </h1>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                El entorno base del monorepo ROUTRACK ha sido inicializado exitosamente.
                Las bibliotecas fundamentales (Next.js App Router, Tailwind CSS, Supabase SSR,
                Leaflet y Lucide Icons) se encuentran operativas bajo TypeScript estricto.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white/10 p-4 backdrop-blur border border-white/10 text-center">
                <span className="block text-2xl font-bold text-emerald-400">0 USD</span>
                <span className="text-xs text-slate-300">Costo Infraestructura</span>
              </div>
              <div className="rounded-xl bg-white/10 p-4 backdrop-blur border border-white/10 text-center">
                <span className="block text-2xl font-bold text-blue-400">100%</span>
                <span className="text-xs text-slate-300">RLS Activo</span>
              </div>
            </div>
          </div>
        </section>

        {/* Sección: Paleta de Estados Operativos (DESIGN.md) */}
        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Verificación de Estados Operativos (Design System)
            </h2>
            <span className="text-xs text-slate-500">Mapeo Semántico Oficial</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Estado 1: En Ruta */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
                  En Ruta
                </span>
                <Radio className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-sm font-medium text-slate-900">Velocidad &gt; 5 km/h</p>
              <p className="text-xs text-slate-500 mt-1">Telemetría en movimiento activo siguiendo corredor.</p>
            </div>

            {/* Estado 2: Detenido */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                  Detenido
                </span>
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <p className="text-sm font-medium text-slate-900">Parada &gt; 3 min</p>
              <p className="text-xs text-slate-500 mt-1">En jornada activa sin registro de check-in comercial.</p>
            </div>

            {/* Estado 3: Visita Validada */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  Visita Validada
                </span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-slate-900">ST_DWithin &le; 50m</p>
              <p className="text-xs text-slate-500 mt-1">Presencia presencial confirmada fehacientemente.</p>
            </div>

            {/* Estado 4: Desviación Detectada */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 border border-red-200">
                  Desviación
                </span>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <p className="text-sm font-medium text-slate-900">Desvío &gt; 300m</p>
              <p className="text-xs text-slate-500 mt-1">Fuera de geocerca o alerta de ubicación simulada.</p>
            </div>

            {/* Estado 5: Sin Conexión */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 border border-slate-300">
                  Sin Conexión
                </span>
                <Layers className="h-4 w-4 text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-900">&gt; 15 min sin reporte</p>
              <p className="text-xs text-slate-500 mt-1">Búfer local activo en SQLite con SQLCipher.</p>
            </div>
          </div>
        </section>

        {/* Sección: Componentes del Monorepo Inicializados */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Backend Supabase */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Supabase & PostGIS</h3>
                <span className="text-xs text-slate-500">PostgreSQL 15+ / PostGIS 3.3+</span>
              </div>
            </div>
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Migración 20260101000000_initial_schema.sql creada
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Tipos GEOMETRY(Point, 4326) con índices GiST
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Políticas RLS en el 100% de tablas públicas
              </li>
            </ul>
          </div>

          {/* Card 2: Panel Web */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Panel Web Admin</h3>
                <span className="text-xs text-slate-500">Next.js 14 App Router + TS</span>
              </div>
            </div>
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Tailwind CSS configurado con diseño DESIGN.md
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Cliente Supabase navegador y servidor listo
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Soporte Leaflet para mapas OpenStreetMap ($0 USD)
              </li>
            </ul>
          </div>

          {/* Card 3: Cliente Android */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-slate-100 p-2.5 text-slate-700">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Mobile Android</h3>
                <span className="text-xs text-slate-500">Kotlin + Jetpack Compose</span>
              </div>
            </div>
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Estructura de paquetes com/empresa/routrack
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Configuración Gradle con Room, Compose y WorkManager
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Preparado para apertura en Android Studio
              </li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}

