"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  Calendar,
  User,
  Activity,
  Layers,
  MapPin,
  Lock,
  Link as LinkIcon,
  Unlink,
} from "lucide-react";
import {
  AuditLogRecord,
  formatSeverityBadge,
  formatEventTypeLabel,
  formatAuditTimestamp,
} from "@/types/audit";

interface AuditDetailModalProps {
  event: AuditLogRecord | null;
  onClose: () => void;
  expectedPreviousHash?: string;
}

export function AuditDetailModal({
  event,
  onClose,
  expectedPreviousHash,
}: AuditDetailModalProps) {
  const [copiedHmac, setCopiedHmac] = useState(false);
  const [copiedPrev, setCopiedPrev] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!event) return null;

  const severityConfig = formatSeverityBadge(event.severidad);
  const typeConfig = formatEventTypeLabel(event.tipo_evento);

  const copyToClipboard = async (text: string, type: "hmac" | "prev") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "hmac") {
        setCopiedHmac(true);
        setTimeout(() => setCopiedHmac(false), 2000);
      } else {
        setCopiedPrev(true);
        setTimeout(() => setCopiedPrev(false), 2000);
      }
    } catch {
      // Fallback silencioso en entornos restringidos
    }
  };

  const isChainLinkValid =
    event.chain_link_status === "VALID" ||
    event.chain_link_status === "SEED" ||
    (expectedPreviousHash
      ? (event.previous_hash || "").toLowerCase() ===
        expectedPreviousHash.toLowerCase()
      : true);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity"
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado del Modal con Severidad */}
        <div
          className={`flex items-start justify-between p-6 border-b border-slate-100 ${
            event.severidad === "CRITICAL"
              ? "bg-red-50/50"
              : event.severidad === "WARNING"
              ? "bg-amber-50/40"
              : "bg-blue-50/30"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                event.severidad === "CRITICAL"
                  ? "bg-red-100 text-red-700 border-red-200"
                  : event.severidad === "WARNING"
                  ? "bg-amber-100 text-amber-800 border-amber-200"
                  : "bg-blue-100 text-blue-700 border-blue-200"
              }`}
            >
              {event.severidad === "CRITICAL" ? (
                <ShieldAlert className="h-6 w-6" />
              ) : (
                <ShieldCheck className="h-6 w-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${severityConfig.badgeClass}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${severityConfig.dotClass}`}
                  />
                  {severityConfig.label}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  ID: #{event.id}
                </span>
              </div>
              <h2
                id="audit-modal-title"
                className="text-lg font-bold text-slate-900 mt-1"
              >
                {typeConfig.label}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {typeConfig.description}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            title="Cerrar ventana (Escape)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenido del Evento */}
        <div className="p-6 space-y-6">
          {/* Bloque de Metadatos Principales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <Calendar className="h-4 w-4 text-slate-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-500 uppercase">
                  Marca Temporal
                </p>
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {formatAuditTimestamp(event.created_at)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <User className="h-4 w-4 text-slate-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-500 uppercase">
                  Asesor Comercial
                </p>
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {event.vendedor_nombre || event.usuario_id || "Sistema"}
                </p>
              </div>
            </div>
          </div>

          {/* Estado de Integridad Forense y Hash Chaining */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-purple-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Custodia Criptográfica (HMAC-SHA256)
                </h3>
              </div>
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  isChainLinkValid
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}
              >
                {isChainLinkValid ? (
                  <>
                    <LinkIcon className="h-3 w-3" />
                    <span>Eslabón Íntegro</span>
                  </>
                ) : (
                  <>
                    <Unlink className="h-3 w-3" />
                    <span>Discontinuidad Forense</span>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2 text-xs font-mono">
              {/* Previous Hash */}
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1 font-sans">
                  <span className="flex items-center gap-1 font-medium">
                    <Layers className="h-3.5 w-3.5" /> Hash Previo (Previous
                    Hash):
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(event.previous_hash, "prev")
                    }
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                    title="Copiar hash previo completo"
                  >
                    {copiedPrev ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span className="text-[10px] text-emerald-600">
                          Copiado
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span className="text-[10px]">Copiar</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="break-all text-slate-700 text-[11px]">
                  {event.previous_hash || "SEED_ORIGEN_JORNADA"}
                </p>
              </div>

              {/* Current Hash */}
              <div className="p-2.5 rounded-lg bg-white border border-purple-200">
                <div className="flex items-center justify-between text-[11px] text-purple-700 mb-1 font-sans">
                  <span className="flex items-center gap-1 font-medium">
                    <Activity className="h-3.5 w-3.5 text-purple-600" /> Hash
                    del Evento (HMAC-SHA256):
                  </span>
                  <button
                    onClick={() => copyToClipboard(event.hmac_hash, "hmac")}
                    className="inline-flex items-center gap-1 text-purple-700 hover:text-purple-900 font-medium"
                    title="Copiar firma HMAC completa"
                  >
                    {copiedHmac ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span className="text-[10px] text-emerald-600">
                          Copiado
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span className="text-[10px]">Copiar</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="break-all text-purple-900 font-bold text-[11px]">
                  {event.hmac_hash}
                </p>
              </div>
            </div>
          </div>

          {/* Coordenadas Geográficas si existen */}
          {event.ubicacion && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
                <div>
                  <p className="text-[11px] font-medium text-slate-500 uppercase">
                    Coordenadas GPS del Incidente
                  </p>
                  <p className="font-mono text-slate-800">
                    {event.ubicacion.lat.toFixed(6)}, {event.ubicacion.lng.toFixed(6)}
                  </p>
                </div>
              </div>
              <span className="text-[11px] text-slate-500">SRID: 4326 (WGS84)</span>
            </div>
          )}

          {/* Metadatos Estructurados (JSON) */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Metadatos del Evento (Payload JSON)
            </h4>
            <div className="rounded-xl bg-slate-900 p-4 text-xs font-mono text-emerald-400 overflow-x-auto shadow-inner border border-slate-800">
              <pre className="whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(event.metadatos, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        {/* Pie del Modal */}
        <div className="flex items-center justify-end gap-3 p-4 bg-slate-50 border-t border-slate-100 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

