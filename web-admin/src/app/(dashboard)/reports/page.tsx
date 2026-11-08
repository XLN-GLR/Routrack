"use client";

import React from "react";
import { FileText, Download } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
            <FileText className="h-4 w-4" />
            <span>Consolidación de Datos</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Reportes de Jornada y Desempeño
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Totalización de horas efectivas, kilometraje recorrido, cobertura de visitas y exportación CSV con UTF-8 BOM.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs min-h-[450px] flex flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-4">
          <FileText className="h-7 w-7" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">
          Módulo de Exportación y KPIs
        </h3>
        <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed">
          Generador de reportes consolidados descargables con codificación compatible para Microsoft Excel
          conforme a la especificación de TASK-023.
        </p>
      </div>
    </div>
  );
}
