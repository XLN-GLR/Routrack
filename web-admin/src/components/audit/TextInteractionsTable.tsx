"use client";

import React, { useState, useMemo } from "react";
import {
  MessageSquare,
  Search,
  Filter,
  Calendar,
  User,
  Copy,
  Check,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  TextInteractionRecord,
  TextInteractionFilterState,
  filterTextInteractions,
} from "@/types/text-interactions";

interface TextInteractionsTableProps {
  records: TextInteractionRecord[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  vendedoresList?: { id: string; nombre: string }[];
  showSellerColumn?: boolean;
  title?: string;
  description?: string;
}

export function TextInteractionsTable({
  records,
  isLoading = false,
  error = null,
  onRetry,
  vendedoresList = [],
  showSellerColumn = true,
  title = "Auditoría de Interacciones de Texto Corporativo",
  description = "Registro inmutable de acuerdos, descuentos y precios acordados vía mensajería durante la jornada laboral.",
}: TextInteractionsTableProps) {
  const [filters, setFilters] = useState<TextInteractionFilterState>({
    searchQuery: "",
    selectedPackage: "ALL",
    startDate: "",
    endDate: "",
    selectedSellerId: "ALL",
  });

  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);
  const [expandedTextIds, setExpandedTextIds] = useState<Set<string>>(new Set());

  // Copiar hash al portapapeles
  const handleCopyHash = async (hash: string, id: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHashId(id);
      setTimeout(() => setCopiedHashId(null), 2000);
    } catch {
      // Fallback
    }
  };

  const toggleExpandText = (id: string) => {
    setExpandedTextIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleResetFilters = () => {
    setFilters({
      searchQuery: "",
      selectedPackage: "ALL",
      startDate: "",
      endDate: "",
      selectedSellerId: "ALL",
    });
  };

  // Obtener lista única de paquetes en el dataset
  const availablePackages = useMemo(() => {
    const pkgs = new Map<string, string>();
    records.forEach((r) => {
      if (!pkgs.has(r.paquete_aplicacion)) {
        pkgs.set(r.paquete_aplicacion, r.nombre_aplicacion || r.paquete_aplicacion);
      }
    });
    return Array.from(pkgs.entries());
  }, [records]);

  // Registros filtrados reactivamente
  const filteredRecords = useMemo(() => {
    return filterTextInteractions(records, filters);
  }, [records, filters]);

  // Formateo de fecha y hora local para Quito (UTC-5)
  const formatDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat("es-EC", {
        timeZone: "America/Guayaquil",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(d);
    } catch {
      return isoString;
    }
  };

  const truncateHash = (hash: string) => {
    if (!hash || hash.length <= 16) return hash || "";
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  const renderAppBadge = (packageName: string, appLabel: string | null) => {
    const pkg = packageName.toLowerCase();
    const label = appLabel || packageName;

    if (pkg.includes("whatsapp")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {label}
        </span>
      );
    }

    if (pkg.includes("messaging") || pkg.includes("sms") || pkg.includes("mms")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          {label}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        {label}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Cabecera del Módulo */}
      <div className="p-5 border-b border-slate-200 bg-slate-50/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 mt-0.5">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end lg:self-auto text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Cadena de Custodia Inmutable (HMAC-SHA256)</span>
          </div>
        </div>

        {/* Barra de Filtros Reactivos */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Búsqueda por términos */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar en texto, app o asesor..."
              value={filters.searchQuery}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
              }
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Filtro por Aplicación */}
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={filters.selectedPackage}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, selectedPackage: e.target.value }))
              }
              aria-label="Filtrar por aplicación"
              className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white appearance-none"
            >
              <option value="ALL">Todas las aplicaciones</option>
              {availablePackages.map(([pkg, name]) => (
                <option key={pkg} value={pkg}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Asesor (si está habilitado) */}
          {showSellerColumn && vendedoresList.length > 0 && (
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={filters.selectedSellerId}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, selectedSellerId: e.target.value }))
                }
                aria-label="Filtrar por asesor comercial"
                className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white appearance-none"
              >
                <option value="ALL">Todos los asesores</option>
                {vendedoresList.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filtro por Fecha Inicio */}
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, startDate: e.target.value }))
              }
              aria-label="Fecha de registro"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
            />
          </div>
        </div>

        {/* Indicador de Filtros Activos y Botón Reset */}
        {(filters.searchQuery ||
          filters.selectedPackage !== "ALL" ||
          filters.selectedSellerId !== "ALL" ||
          filters.startDate ||
          filters.endDate) && (
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>
              Mostrando <b>{filteredRecords.length}</b> de <b>{records.length}</b> registros
            </span>
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restablecer filtros
            </button>
          </div>
        )}
      </div>

      {/* Estados del Componente: Error */}
      {error && (
        <div className="p-8 text-center bg-rose-50/50">
          <div className="inline-flex p-3 rounded-full bg-rose-100 text-rose-600 mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">Error al consultar interacciones</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm"
            >
              Reintentar consulta
            </button>
          )}
        </div>
      )}

      {/* Estados del Componente: Skeleton Loader */}
      {isLoading && !error && (
        <div className="p-6 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-4">
              <div className="h-4 w-28 bg-slate-200 rounded" />
              {showSellerColumn && <div className="h-4 w-32 bg-slate-200 rounded" />}
              <div className="h-4 w-20 bg-slate-200 rounded" />
              <div className="h-4 flex-1 bg-slate-200 rounded" />
              <div className="h-4 w-24 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Estados del Componente: Vacío (Empty State) */}
      {!isLoading && !error && filteredRecords.length === 0 && (
        <div className="p-12 text-center">
          <div className="inline-flex p-3.5 rounded-full bg-slate-100 text-slate-400 mb-3">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">
            No se encontraron interacciones de texto
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            No existen registros que coincidan con los filtros aplicados o no se redactaron acuerdos comerciales en el período.
          </p>
          {(filters.searchQuery ||
            filters.selectedPackage !== "ALL" ||
            filters.selectedSellerId !== "ALL" ||
            filters.startDate) && (
            <button
              onClick={handleResetFilters}
              className="mt-4 px-3.5 py-1.5 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
            >
              Limpiar filtros de búsqueda
            </button>
          )}
        </div>
      )}

      {/* Tabla Principal */}
      {!isLoading && !error && filteredRecords.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Fecha y Hora</th>
                {showSellerColumn && <th className="px-4 py-3">Asesor Comercial</th>}
                <th className="px-4 py-3">Aplicación</th>
                <th className="px-4 py-3">Texto / Acuerdo Comercial</th>
                <th className="px-4 py-3">Firma Criptográfica</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((item) => {
                const isExpanded = expandedTextIds.has(item.id);
                const isLongText = item.texto_capturado.length > 120;
                const displayText =
                  isLongText && !isExpanded
                    ? `${item.texto_capturado.slice(0, 120)}...`
                    : item.texto_capturado;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Fecha y Hora */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {formatDateTime(item.registrado_en)}
                    </td>

                    {/* Asesor Comercial */}
                    {showSellerColumn && (
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-medium text-slate-800">
                          {item.vendedor_nombre || "Asesor Asignado"}
                        </div>
                        {item.vendedor_email && (
                          <div className="text-[10px] text-slate-400">{item.vendedor_email}</div>
                        )}
                      </td>
                    )}

                    {/* Aplicación */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {renderAppBadge(item.paquete_aplicacion, item.nombre_aplicacion)}
                    </td>

                    {/* Texto Capturado */}
                    <td className="px-4 py-3.5 max-w-md">
                      <div className="text-slate-800 font-normal leading-relaxed break-words">
                        "{displayText}"
                      </div>
                      {isLongText && (
                        <button
                          onClick={() => toggleExpandText(item.id)}
                          className="mt-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-0.5"
                        >
                          {isExpanded ? (
                            <>
                              Ver menos <ChevronUp className="w-3 h-3" />
                            </>
                          ) : (
                            <>
                              Ver más <ChevronDown className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      )}
                    </td>

                    {/* Firma Criptográfica */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200"
                          title={`Hash completo: ${item.hmac_hash}\nHash previo: ${item.previous_hash}`}
                        >
                          {truncateHash(item.hmac_hash)}
                        </span>
                        <button
                          onClick={() => handleCopyHash(item.hmac_hash, item.id)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors"
                          title="Copiar firma HMAC-SHA256"
                        >
                          {copiedHashId === item.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pie de tabla con totalizadores */}
      {!isLoading && !error && filteredRecords.length > 0 && (
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Total de interacciones auditadas: <b>{filteredRecords.length}</b>
          </span>
          <span className="text-[11px] text-slate-400">
            LOPDP Ecuador: Textos corporativos auditados bajo custodia HMAC-SHA256
          </span>
        </div>
      )}
    </div>
  );
}
