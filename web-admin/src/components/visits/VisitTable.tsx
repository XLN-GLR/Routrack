"use client";

import React, { useMemo } from "react";
import {
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Calendar,
  Clock,
  Building2,
  User,
  ShieldCheck,
  Package,
} from "lucide-react";
import type { VisitRecord, VisitFilters, VisitStatus } from "@/types/visit";
import { formatVisitDuration, formatTimeDisplay } from "@/types/visit";

interface VisitTableProps {
  visits: VisitRecord[];
  onSelectVisit: (visit: VisitRecord) => void;
  filters: VisitFilters;
  onFilterChange: (newFilters: VisitFilters) => void;
  sellers: Array<{ id: string; nombre: string }>;
}

/**
 * Tabla interactiva de Auditoría de Visitas Comerciales y Gestión de Geocercas.
 * Permite filtrar por vendedor, estado de geocerca, fecha y texto predictivo.
 */
export default function VisitTable({
  visits,
  onSelectVisit,
  filters,
  onFilterChange,
  sellers,
}: VisitTableProps) {
  // Filtrado de visitas en memoria
  const filteredVisits = useMemo(() => {
    const query = filters.search_query.trim().toLowerCase();

    return visits.filter((v) => {
      // Filtro por vendedor
      if (filters.vendedor_id !== "ALL" && v.vendedor_id !== filters.vendedor_id) {
        return false;
      }

      // Filtro por estado
      if (filters.estado !== "ALL" && v.estado !== filters.estado) {
        return false;
      }

      // Filtro por fecha (YYYY-MM-DD)
      if (filters.fecha && !v.hora_check_in.startsWith(filters.fecha)) {
        return false;
      }

      // Filtro de texto
      if (query) {
        const matchesClient = v.cliente_nombre.toLowerCase().includes(query);
        const matchesComercial = v.cliente_nombre_comercial?.toLowerCase().includes(query) ?? false;
        const matchesSeller = v.vendedor_nombre.toLowerCase().includes(query);
        const matchesAddress = v.cliente_direccion.toLowerCase().includes(query);
        const matchesObs = v.observaciones?.toLowerCase().includes(query) ?? false;
        if (!matchesClient && !matchesComercial && !matchesSeller && !matchesAddress && !matchesObs) {
          return false;
        }
      }

      return true;
    });
  }, [visits, filters]);

  return (
    <div className="space-y-4">
      {/* Barra de Filtros */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
        {/* Buscador de texto */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={filters.search_query}
            onChange={(e) => onFilterChange({ ...filters, search_query: e.target.value })}
            placeholder="Buscar por cliente, asesor comercial o dirección..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-9 pr-3 py-2 text-xs text-slate-900 shadow-xs focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Selectores de Filtro */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Asesor */}
          <select
            value={filters.vendedor_id}
            onChange={(e) => onFilterChange({ ...filters, vendedor_id: e.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">Todos los Asesores</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>

          {/* Selector de Estado */}
          <select
            value={filters.estado}
            onChange={(e) => onFilterChange({ ...filters, estado: e.target.value as "ALL" | VisitStatus })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="VERIFIED">Solo Verificadas</option>
            <option value="OUT_OF_RANGE">Solo Fuera de Geocerca</option>
          </select>

          {/* Selector de Fecha */}
          <div className="relative">
            <input
              type="date"
              value={filters.fecha}
              onChange={(e) => onFilterChange({ ...filters, fecha: e.target.value })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Tabla Responsiva */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Cliente / Punto de Venta</th>
                <th scope="col" className="px-4 py-3">Asesor Comercial</th>
                <th scope="col" className="px-4 py-3">Horario & Permanencia</th>
                <th scope="col" className="px-4 py-3 text-center">Distancia Geocerca</th>
                <th scope="col" className="px-4 py-3 text-center">Estado Validación</th>
                <th scope="col" className="px-4 py-3 text-right">Acuerdos Pactados</th>
                <th scope="col" className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVisits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="font-medium text-slate-600">No se encontraron visitas comerciales</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Modifica los filtros de fecha o asesor comercial para visualizar gestiones previas.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredVisits.map((visit) => {
                  const isVerified = visit.estado === "VERIFIED";
                  const totalAmount = visit.precios_pactados_compromisos?.total_amount || 0;
                  const totalItems = visit.precios_pactados_compromisos?.total_items || 0;

                  return (
                    <tr
                      key={visit.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => onSelectVisit(visit)}
                    >
                      {/* Cliente */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{visit.cliente_nombre}</div>
                        <div className="text-[11px] text-slate-500 max-w-[220px] truncate" title={visit.cliente_direccion}>
                          {visit.cliente_direccion}
                        </div>
                      </td>

                      {/* Vendedor */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                            {visit.vendedor_nombre.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-800">{visit.vendedor_nombre}</span>
                        </div>
                      </td>

                      {/* Horario */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-medium text-slate-800">
                          {formatTimeDisplay(visit.hora_check_in)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {formatVisitDuration(visit.hora_check_in, visit.hora_check_out)}
                        </div>
                      </td>

                      {/* Distancia & Tolerancia */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span className="font-mono text-[11px] font-semibold text-slate-800">
                          {visit.distancia_cliente_metros} m
                        </span>
                        <div className="text-[10px] text-slate-400">
                          Tol: {visit.cliente_radio_tolerancia}m
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            isVerified
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {isVerified ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              <span>En Rango</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                              <span>Fuera de Geocerca</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Acuerdos Pactados */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {totalAmount > 0 ? (
                          <div>
                            <span className="font-mono font-bold text-slate-900">
                              ${totalAmount.toFixed(2)}
                            </span>
                            <div className="text-[10px] text-slate-400">
                              {totalItems} {totalItems === 1 ? "producto" : "productos"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onSelectVisit(visit)}
                          title="Ver auditoría y mapa"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-blue-600 transition"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Ver Mapa</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pie con resumen */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-xs text-slate-500">
          <span>
            Mostrando <strong>{filteredVisits.length}</strong> de <strong>{visits.length}</strong> visitas registradas
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            PostGIS ST_DWithin &bull; Tolerancia elipsoidal WGS84
          </span>
        </div>
      </div>
    </div>
  );
}

