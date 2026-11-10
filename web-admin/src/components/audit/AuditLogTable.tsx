"use client";

import React, { useState, useMemo } from "react";
import {
  ShieldAlert,
  Search,
  Filter,
  Calendar,
  User,
  Copy,
  Check,
  Eye,
  Link as LinkIcon,
  Unlink,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  AuditLogRecord,
  AuditFilters,
  AuditSeverity,
  formatSeverityBadge,
  formatEventTypeLabel,
  formatAuditTimestamp,
  truncateHash,
} from "@/types/audit";
import { AuditDetailModal } from "./AuditDetailModal";

interface AuditLogTableProps {
  records: AuditLogRecord[];
  onResetFilters?: () => void;
  vendedoresList?: { id: string; nombre: string }[];
}

export function AuditLogTable({
  records,
  onResetFilters,
  vendedoresList = [],
}: AuditLogTableProps) {
  const [filters, setFilters] = useState<AuditFilters>({
    vendedorId: "TODOS",
    tipoEvento: "TODOS",
    severidad: "TODAS",
    fecha: "",
    busqueda: "",
  });

  const [selectedEvent, setSelectedEvent] = useState<AuditLogRecord | null>(
    null
  );
  const [copiedHashId, setCopiedHashId] = useState<string | number | null>(
    null
  );

  // Copiar hash al portapapeles
  const handleCopyHash = async (
    hash: string,
    id: string | number,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHashId(id);
      setTimeout(() => setCopiedHashId(null), 2000);
    } catch {
      // Fallback
    }
  };

  // Filtrado reactivo en cliente
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      // Filtro por vendedor
      if (
        filters.vendedorId !== "TODOS" &&
        rec.usuario_id !== filters.vendedorId
      ) {
        return false;
      }

      // Filtro por severidad
      if (
        filters.severidad !== "TODAS" &&
        rec.severidad !== filters.severidad
      ) {
        return false;
      }

      // Filtro por tipo de evento
      if (
        filters.tipoEvento !== "TODOS" &&
        rec.tipo_evento !== filters.tipoEvento
      ) {
        return false;
      }

      // Filtro por fecha (YYYY-MM-DD)
      if (filters.fecha) {
        const recordDate = rec.created_at.slice(0, 10);
        if (recordDate !== filters.fecha) return false;
      }

      // Búsqueda textual predictiva
      if (filters.busqueda.trim()) {
        const query = filters.busqueda.toLowerCase();
        const matchesName = (rec.vendedor_nombre || "")
          .toLowerCase()
          .includes(query);
        const matchesType = rec.tipo_evento.toLowerCase().includes(query);
        const matchesId = String(rec.id).includes(query);
        const matchesHash = rec.hmac_hash.toLowerCase().includes(query);
        const matchesMeta = JSON.stringify(rec.metadatos)
          .toLowerCase()
          .includes(query);

        if (
          !matchesName &&
          !matchesType &&
          !matchesId &&
          !matchesHash &&
          !matchesMeta
        ) {
          return false;
        }
      }

      return true;
    });
  }, [records, filters]);

  // Lista única de tipos de evento presentes
  const availableEventTypes = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => set.add(r.tipo_evento));
    return Array.from(set);
  }, [records]);

  // Resumen breve de metadatos para la celda de tabla
  const renderMetadataSnippet = (meta: Record<string, unknown>) => {
    if (!meta || Object.keys(meta).length === 0) {
      return <span className="text-slate-400 italic text-[11px]">Sin metadatos</span>;
    }

    const items: string[] = [];
    if ("clock_skew_seconds" in meta) {
      items.push(`Desfase: ${meta.clock_skew_seconds}s`);
    }
    if ("is_mock" in meta) {
      items.push(`Mock: ${meta.is_mock ? "Sí" : "No"}`);
    }
    if ("battery_level" in meta) {
      items.push(`Batería: ${meta.battery_level}%`);
    }
    if ("reason" in meta) {
      items.push(String(meta.reason));
    }
    if ("shift_id" in meta) {
      items.push(`Turno: ${String(meta.shift_id).slice(0, 6)}…`);
    }

    if (items.length === 0) {
      const firstKey = Object.keys(meta)[0];
      return (
        <span className="text-[11px] font-mono text-slate-600 truncate max-w-[160px] inline-block">
          {firstKey}: {String(meta[firstKey])}
        </span>
      );
    }

    return (
      <span className="text-[11px] font-mono text-slate-700 truncate max-w-[200px] inline-block">
        {items.join(" • ")}
      </span>
    );
  };

  const handleReset = () => {
    setFilters({
      vendedorId: "TODOS",
      tipoEvento: "TODOS",
      severidad: "TODAS",
      fecha: "",
      busqueda: "",
    });
    if (onResetFilters) onResetFilters();
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtros Interactivos */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            {/* Buscador predictivo */}
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por asesor, tipo, ID o hash..."
                value={filters.busqueda}
                onChange={(e) =>
                  setFilters({ ...filters, busqueda: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            {/* Selector de Vendedor */}
            <div className="flex items-center gap-1.5 min-w-[160px]">
              <User className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={filters.vendedorId}
                onChange={(e) =>
                  setFilters({ ...filters, vendedorId: e.target.value })
                }
                aria-label="Filtrar por Asesor Comercial"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
              >
                <option value="TODOS">Todos los Asesores</option>
                {vendedoresList.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de Severidad */}
            <div className="flex items-center gap-1.5 min-w-[140px]">
              <Filter className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={filters.severidad}
                onChange={(e) =>
                  setFilters({ ...filters, severidad: e.target.value })
                }
                aria-label="Filtrar por Severidad Semántica"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
              >
                <option value="TODAS">Todas las Severidades</option>
                <option value="CRITICAL">Crítico (Alerta Roja)</option>
                <option value="WARNING">Advertencia (Ámbar)</option>
                <option value="INFO">Informativo (Azul)</option>
              </select>
            </div>

            {/* Selector de Tipo de Evento */}
            <div className="flex items-center gap-1.5 min-w-[160px]">
              <Sparkles className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={filters.tipoEvento}
                onChange={(e) =>
                  setFilters({ ...filters, tipoEvento: e.target.value })
                }
                aria-label="Filtrar por Tipo de Evento"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
              >
                <option value="TODOS">Todos los Eventos</option>
                {availableEventTypes.map((t) => (
                  <option key={t} value={t}>
                    {formatEventTypeLabel(t).label}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de Fecha */}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="date"
                value={filters.fecha}
                onChange={(e) =>
                  setFilters({ ...filters, fecha: e.target.value })
                }
                aria-label="Filtrar por Fecha"
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Botón de Limpiar Filtros */}
          {(filters.busqueda ||
            filters.vendedorId !== "TODOS" ||
            filters.severidad !== "TODAS" ||
            filters.tipoEvento !== "TODOS" ||
            filters.fecha) && (
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Limpiar Filtros</span>
            </button>
          )}
        </div>
      </div>

      {/* Contenedor de la Tabla Adaptativa */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {filteredRecords.length === 0 ? (
          /* Estado Vacío Educativo (docs/DESIGN.md § 5.3) */
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-4">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              No se encontraron eventos en la bitácora
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
              No existen incidentes o registros de auditoría que coincidan con
              los filtros de severidad, fecha o asesor seleccionados.
            </p>
            <button
              onClick={handleReset}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors shadow-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Restablecer Filtros de Auditoría</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Fecha / Hora</th>
                  <th className="py-3 px-4">Asesor</th>
                  <th className="py-3 px-4">Tipo de Evento</th>
                  <th className="py-3 px-4">Severidad</th>
                  <th className="py-3 px-4">Metadatos Clave</th>
                  <th className="py-3 px-4 text-center">Cadena</th>
                  <th className="py-3 px-4">Hash HMAC-SHA256</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRecords.map((rec) => {
                  const severityConfig = formatSeverityBadge(rec.severidad);
                  const typeConfig = formatEventTypeLabel(rec.tipo_evento);
                  const isLinkValid =
                    rec.chain_link_status === "VALID" ||
                    rec.chain_link_status === "SEED";

                  return (
                    <tr
                      key={rec.id}
                      onClick={() => setSelectedEvent(rec)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      {/* Fecha / Hora */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-800 font-medium">
                        {formatAuditTimestamp(rec.created_at)}
                      </td>

                      {/* Asesor */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700 shrink-0">
                            {(rec.vendedor_nombre || "S")[0].toUpperCase()}
                          </div>
                          <span className="text-slate-800 font-medium">
                            {rec.vendedor_nombre || rec.usuario_id || "Sistema"}
                          </span>
                        </div>
                      </td>

                      {/* Tipo de Evento */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${typeConfig.badgeClass}`}
                        >
                          {typeConfig.label}
                        </span>
                      </td>

                      {/* Severidad Semántica (Criterio 1) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${severityConfig.badgeClass}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${severityConfig.dotClass}`}
                          />
                          {severityConfig.label}
                        </span>
                      </td>

                      {/* Metadatos Clave */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderMetadataSnippet(rec.metadatos)}
                      </td>

                      {/* Indicador de Cadena Criptográfica (Criterio 2) */}
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <span
                          title={
                            isLinkValid
                              ? "Eslabón de custodia íntegro y verificado"
                              : "Discontinuidad detectada: previous_hash no coincide con el eslabón anterior"
                          }
                          className={`inline-flex items-center justify-center h-6 w-6 rounded-full border ${
                            isLinkValid
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-red-50 text-red-700 border-red-200 animate-pulse"
                          }`}
                        >
                          {isLinkValid ? (
                            <LinkIcon className="h-3 w-3" />
                          ) : (
                            <Unlink className="h-3 w-3" />
                          )}
                        </span>
                      </td>

                      {/* Hash HMAC Truncado con Copiado */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200"
                            title={rec.hmac_hash}
                          >
                            {truncateHash(rec.hmac_hash, 8, 6)}
                          </span>
                          <button
                            onClick={(e) =>
                              handleCopyHash(rec.hmac_hash, rec.id, e)
                            }
                            className="text-slate-400 hover:text-blue-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
                            title="Copiar hash completo al portapapeles"
                          >
                            {copiedHashId === rec.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Acción */}
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(rec);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 rounded-md hover:bg-blue-50 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Inspeccionar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Detalle Forense */}
      <AuditDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}

