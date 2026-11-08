"use client";

import React from "react";
import { MapPin, Plus, Search } from "lucide-react";

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
            <MapPin className="h-4 w-4" />
            <span>Puntos de Venta</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Gestión y Georreferenciación de Clientes
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Catálogo de clientes con coordenadas espaciales y radio de tolerancia de geocercas en metros.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo Cliente
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs min-h-[450px] flex flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-4">
          <Search className="h-7 w-7" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">
          Catálogo Georreferenciado
        </h3>
        <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed">
          Los puntos de venta registrados en la tabla `clientes` con índices espaciales GiST
          se administrarán desde este módulo conforme a la especificación de TASK-017.
        </p>
      </div>
    </div>
  );
}
