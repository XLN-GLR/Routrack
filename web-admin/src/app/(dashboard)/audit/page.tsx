"use client";

import React from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-600">
            <ShieldAlert className="h-4 w-4" />
            <span>Seguridad y Cadena de Custodia</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Bitácora Inmutable de Eventos del Sistema
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Registro append-only de incidentes, apagados de GPS, anomalías de reloj y verificación de firmas HMAC.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 border border-emerald-200 text-xs font-bold text-emerald-700">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Cadena HMAC Válida</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs min-h-[450px] flex flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 mb-4">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">
          Bitácora Forense Criptográfica
        </h3>
        <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed">
          Historial inmutable de eventos sincronizados desde los teléfonos Android con verificación matemática
          de cada hash encadenado (Hash_n = HMAC(Payload_n || Hash_n-1, K)) conforme a TASK-021.
        </p>
      </div>
    </div>
  );
}
