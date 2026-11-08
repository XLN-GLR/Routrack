"use client";

import React from "react";
import { CheckCircle2, Filter } from "lucide-react";

export default function VisitsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>Gestión en Campo</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Auditoría de Visitas Comerciales
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Supervisión de check-ins, acuerdos de precios pactados y validación automática de geocercas.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
        >
          <Filter className="h-3.5 w-3.5 text-slate-500" />
          Filtrar por Estado
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs min-h-[450px] flex flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-4">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">
          Supervisión de Visitas y Precios Pactados
        </h3>
        <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed">
          Las visitas sincronizadas desde los dispositivos móviles se auditarán aquí con badges semánticos
          (`VERIFIED` vs `OUT_OF_RANGE`) conforme a TASK-020.
        </p>
      </div>
    </div>
  );
}
