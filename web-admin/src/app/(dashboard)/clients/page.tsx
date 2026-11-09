"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  MapPin,
  Plus,
  Search,
  Building2,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Eye,
  SlidersHorizontal,
  RefreshCw,
  Navigation,
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import type { Client, ClientFormData, ClientPostGISRow } from "@/types/client";
import { mapPostGISToClient, formatCoordinatesDisplay, formatToWKTPoint } from "@/types/client";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import ClientModal from "@/components/clients/ClientModal";
import ClientLocationPicker from "@/components/clients/ClientLocationPicker";

// Datos iniciales de demostración con georreferenciación en Quito, Ecuador
const INITIAL_MOCK_CLIENTS: Client[] = [
  {
    id: "c1000000-0000-0000-0000-000000000001",
    organizacion_id: "00000000-0000-0000-0000-000000000001",
    nombre: "Corporación Favorita C.A.",
    nombre_comercial: "Supermaxi El Jardín",
    identificacion_fiscal: "1790016919001",
    direccion: "Av. Amazonas N24-196 y Av. República, Quito",
    telefono: "02-2980-000",
    latitud: -0.190123,
    longitud: -78.487654,
    radio_tolerancia_metros: 60,
    activo: true,
    created_at: "2026-11-01T08:00:00Z",
    updated_at: "2026-11-01T08:00:00Z",
  },
  {
    id: "c1000000-0000-0000-0000-000000000002",
    organizacion_id: "00000000-0000-0000-0000-000000000001",
    nombre: "Tiendas Industriales Asociadas TIA S.A.",
    nombre_comercial: "Tía La Mariscal",
    identificacion_fiscal: "0990011234001",
    direccion: "Calle Juan León Mera N22-34 y Mariscal Foch, Quito",
    telefono: "02-2554-123",
    latitud: -0.203456,
    longitud: -78.491234,
    radio_tolerancia_metros: 40,
    activo: true,
    created_at: "2026-11-01T08:30:00Z",
    updated_at: "2026-11-01T08:30:00Z",
  },
  {
    id: "c1000000-0000-0000-0000-000000000003",
    organizacion_id: "00000000-0000-0000-0000-000000000001",
    nombre: "Comercial de Ferreterías Kywi S.A.",
    nombre_comercial: "Kywi El Inca",
    identificacion_fiscal: "1790034567001",
    direccion: "Av. El Inca E4-120 y Av. 6 de Diciembre, Quito",
    telefono: "02-2245-890",
    latitud: -0.165432,
    longitud: -78.472109,
    radio_tolerancia_metros: 75,
    activo: true,
    created_at: "2026-11-01T09:00:00Z",
    updated_at: "2026-11-01T09:00:00Z",
  },
  {
    id: "c1000000-0000-0000-0000-000000000004",
    organizacion_id: "00000000-0000-0000-0000-000000000001",
    nombre: "Distribuidora de Alimentos San Bartolo",
    nombre_comercial: "Bodega Sur San Bartolo",
    identificacion_fiscal: "1712345678001",
    direccion: "Av. Maldonado S14-88 y Pujilí, Quito Sur",
    telefono: "02-2678-901",
    latitud: -0.258901,
    longitud: -78.523456,
    radio_tolerancia_metros: 50,
    activo: false,
    created_at: "2026-11-01T09:30:00Z",
    updated_at: "2026-11-01T09:30:00Z",
  },
  {
    id: "c1000000-0000-0000-0000-000000000005",
    organizacion_id: "00000000-0000-0000-0000-000000000001",
    nombre: "Farmacias y Droguerías Fybeca S.A.",
    nombre_comercial: "Fybeca San Rafael",
    identificacion_fiscal: "1790056789001",
    direccion: "Av. General Rumiñahui e Isla Genovesa, Valle de los Chillos",
    telefono: "02-2865-432",
    latitud: -0.298765,
    longitud: -78.456789,
    radio_tolerancia_metros: 50,
    activo: true,
    created_at: "2026-11-02T10:00:00Z",
    updated_at: "2026-11-02T10:00:00Z",
  },
];

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>(INITIAL_MOCK_CLIENTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Estados de modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [quickViewClient, setQuickViewClient] = useState<Client | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Auto-desvanecer notificaciones
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Cargar clientes desde Supabase si la base de datos está inicializada
  const loadClientsFromSupabase = useCallback(async () => {
    try {
      const supabase = createSupabaseClient();
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("nombre", { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped = (data as unknown as ClientPostGISRow[]).map(mapPostGISToClient);
        setClients(mapped);
      }
    } catch {
      // Si el backend no está disponible en este momento, se mantiene el estado local
    }
  }, []);

  useEffect(() => {
    loadClientsFromSupabase();
  }, [loadClientsFromSupabase]);

  // Filtrado reactivo de clientes
  const filteredClients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return clients.filter((c) => {
      // Filtro de búsqueda
      const matchesQuery =
        !query ||
        c.nombre.toLowerCase().includes(query) ||
        (c.nombre_comercial && c.nombre_comercial.toLowerCase().includes(query)) ||
        c.identificacion_fiscal.includes(query) ||
        c.direccion.toLowerCase().includes(query);

      // Filtro por estado activo/inactivo
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && c.activo) ||
        (statusFilter === "INACTIVE" && !c.activo);

      return matchesQuery && matchesStatus;
    });
  }, [clients, searchQuery, statusFilter]);

  // Métricas para tarjetas KPI
  const stats = useMemo(() => {
    const total = clients.length;
    const activos = clients.filter((c) => c.activo).length;
    const inactivos = total - activos;
    const avgRadius =
      total > 0
        ? Math.round(clients.reduce((acc, c) => acc + c.radio_tolerancia_metros, 0) / total)
        : 50;

    return { total, activos, inactivos, avgRadius };
  }, [clients]);

  // Abrir modal en modo crear
  const handleOpenCreateModal = () => {
    setClientToEdit(null);
    setIsModalOpen(true);
  };

  // Abrir modal en modo editar
  const handleOpenEditModal = (client: Client) => {
    setClientToEdit(client);
    setIsModalOpen(true);
  };

  // Alternar estado activo/inactivo
  const handleToggleActive = async (client: Client) => {
    const newStatus = !client.activo;
    setClients((prev) =>
      prev.map((c) => (c.id === client.id ? { ...c, activo: newStatus, updated_at: new Date().toISOString() } : c))
    );

    try {
      const supabase = createSupabaseClient();
      await supabase.from("clientes").update({ activo: newStatus }).eq("id", client.id);
    } catch {
      // Ignorar error de red y mantener en local
    }

    setNotification({
      type: "success",
      message: `El cliente "${client.nombre}" ahora está ${newStatus ? "HABILITADO" : "DESHABILITADO"} para visitas.`,
    });
  };

  // Eliminar cliente
  const handleDeleteClient = async (client: Client) => {
    const confirmDelete = window.confirm(
      `¿Está seguro de eliminar el cliente comercial "${client.nombre}"?\nEsta acción no se puede deshacer.`
    );
    if (!confirmDelete) return;

    setClients((prev) => prev.filter((c) => c.id !== client.id));

    try {
      const supabase = createSupabaseClient();
      await supabase.from("clientes").delete().eq("id", client.id);
    } catch {
      // Mantener eliminación local
    }

    setNotification({
      type: "success",
      message: `Cliente "${client.nombre}" eliminado correctamente.`,
    });
  };

  // Guardar cliente (Creación o Edición)
  const handleSaveClient = async (
    formData: ClientFormData,
    clientId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const nowIso = new Date().toISOString();

    if (clientId) {
      // Actualizar cliente existente
      setClients((prev) =>
        prev.map((c) =>
          c.id === clientId
            ? {
                ...c,
                nombre: formData.nombre,
                nombre_comercial: formData.nombre_comercial ?? null,
                identificacion_fiscal: formData.identificacion_fiscal,
                direccion: formData.direccion,
                telefono: formData.telefono ?? null,
                latitud: formData.latitud,
                longitud: formData.longitud,
                radio_tolerancia_metros: formData.radio_tolerancia_metros,
                activo: formData.activo,
                updated_at: nowIso,
              }
            : c
        )
      );

      // Persistir en Supabase con columna PostGIS
      try {
        const supabase = createSupabaseClient();
        await supabase
          .from("clientes")
          .update({
            nombre: formData.nombre,
            nombre_comercial: formData.nombre_comercial ?? null,
            identificacion_fiscal: formData.identificacion_fiscal,
            direccion: formData.direccion,
            telefono: formData.telefono ?? null,
            ubicacion: formatToWKTPoint(formData.latitud, formData.longitud),
            radio_tolerancia_metros: formData.radio_tolerancia_metros,
            activo: formData.activo,
            updated_at: nowIso,
          })
          .eq("id", clientId);
      } catch {
        // Fallback local completado
      }

      setNotification({
        type: "success",
        message: `Cliente "${formData.nombre}" actualizado exitosamente.`,
      });
      return { success: true };
    } else {
      // Crear nuevo cliente
      const newId = `c${Date.now().toString(16).padStart(12, "0")}-0000-0000-0000-000000000000`;
      const newClient: Client = {
        id: newId,
        organizacion_id: "00000000-0000-0000-0000-000000000001",
        nombre: formData.nombre,
        nombre_comercial: formData.nombre_comercial ?? null,
        identificacion_fiscal: formData.identificacion_fiscal,
        direccion: formData.direccion,
        telefono: formData.telefono ?? null,
        latitud: formData.latitud,
        longitud: formData.longitud,
        radio_tolerancia_metros: formData.radio_tolerancia_metros,
        activo: formData.activo,
        created_at: nowIso,
        updated_at: nowIso,
      };

      setClients((prev) => [newClient, ...prev]);

      // Persistir en Supabase
      try {
        const supabase = createSupabaseClient();
        await supabase.from("clientes").insert({
          id: newId,
          organizacion_id: "00000000-0000-0000-0000-000000000001",
          nombre: formData.nombre,
          nombre_comercial: formData.nombre_comercial ?? null,
          identificacion_fiscal: formData.identificacion_fiscal,
          direccion: formData.direccion,
          telefono: formData.telefono ?? null,
          ubicacion: formatToWKTPoint(formData.latitud, formData.longitud),
          radio_tolerancia_metros: formData.radio_tolerancia_metros,
          activo: formData.activo,
        });
      } catch {
        // Fallback local completado
      }

      setNotification({
        type: "success",
        message: `Nuevo cliente "${formData.nombre}" registrado exitosamente.`,
      });
      return { success: true };
    }
  };

  return (
    <div className="space-y-6">
      {/* Notificación Flotante */}
      {notification && (
        <div
          role="status"
          className={`flex items-center justify-between rounded-xl p-3.5 text-xs font-medium shadow-md transition-all ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            &times;
          </button>
        </div>
      )}

      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
            <MapPin className="h-4 w-4" />
            <span>Puntos de Venta y Geocercas PostGIS</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Gestión y Georreferenciación de Clientes
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Administra el catálogo de clientes comerciales, coordenadas exactas WGS84 y radios de tolerancia para validación de visitas presenciales.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Nuevo Cliente</span>
        </button>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Clientes */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Total de Clientes</span>
            <Building2 className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats.total}</span>
            <span className="text-[11px] text-slate-400 font-medium">puntos</span>
          </div>
        </div>

        {/* Clientes Activos */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Clientes Habilitados</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">{stats.activos}</span>
            <span className="text-[11px] text-slate-400 font-medium">activos en ruta</span>
          </div>
        </div>

        {/* Clientes Inactivos */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Clientes Pausados</span>
            <XCircle className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-700">{stats.inactivos}</span>
            <span className="text-[11px] text-slate-400 font-medium">inactivos</span>
          </div>
        </div>

        {/* Radio Promedio */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Geocerca Promedio</span>
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-600">{stats.avgRadius} m</span>
            <span className="text-[11px] text-slate-400 font-medium">tolerancia ST_DWithin</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        {/* Buscador */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por razón social, nombre comercial, RUC o dirección..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs text-slate-900 shadow-xs focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Filtro por estado */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">Todos los Estados ({clients.length})</option>
            <option value="ACTIVE">Solo Habilitados ({stats.activos})</option>
            <option value="INACTIVE">Solo Pausados ({stats.inactivos})</option>
          </select>
        </div>
      </div>

      {/* Tabla de Clientes Comerciales */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Cliente / Razón Social</th>
                <th scope="col" className="px-4 py-3">RUC / Cédula</th>
                <th scope="col" className="px-4 py-3">Dirección Física</th>
                <th scope="col" className="px-4 py-3">Coordenadas WGS84</th>
                <th scope="col" className="px-4 py-3 text-center">Geocerca</th>
                <th scope="col" className="px-4 py-3 text-center">Estado</th>
                <th scope="col" className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <Building2 className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="font-medium text-slate-600">No se encontraron clientes comerciales</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {searchQuery
                        ? "Intenta modificar el término de búsqueda o limpiar los filtros."
                        : "Haz clic en 'Nuevo Cliente' para registrar tu primer punto de venta."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Nombre y Nombre Comercial */}
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900">{client.nombre}</div>
                      {client.nombre_comercial && (
                        <div className="text-[11px] text-slate-500 font-normal">
                          {client.nombre_comercial}
                        </div>
                      )}
                    </td>

                    {/* RUC */}
                    <td className="px-4 py-3.5 font-mono text-slate-700">
                      {client.identificacion_fiscal || "—"}
                    </td>

                    {/* Dirección */}
                    <td className="px-4 py-3.5 max-w-[240px] truncate" title={client.direccion}>
                      {client.direccion}
                    </td>

                    {/* Coordenadas */}
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setQuickViewClient(client)}
                        title="Ver en mapa interactivo"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span>{formatCoordinatesDisplay(client.latitud, client.longitud)}</span>
                      </button>
                    </td>

                    {/* Geocerca */}
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
                        {client.radio_tolerancia_metros} m
                      </span>
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(client)}
                        title={`Haz clic para ${client.activo ? "pausar" : "habilitar"} este cliente`}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${
                          client.activo
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            client.activo ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        <span>{client.activo ? "Habilitado" : "Pausado"}</span>
                      </button>
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setQuickViewClient(client)}
                          title="Vista previa de geocerca"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(client)}
                          title="Editar cliente"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClient(client)}
                          title="Eliminar cliente"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Resumen inferior */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-xs text-slate-500">
          <span>
            Mostrando <strong>{filteredClients.length}</strong> de <strong>{clients.length}</strong> clientes registrados
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            PostGIS SRID 4326 &bull; Geocercas circulares
          </span>
        </div>
      </div>

      {/* Modal de Creación / Edición */}
      <ClientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clientToEdit={clientToEdit}
        onSave={handleSaveClient}
      />

      {/* Modal de Vista Rápida de Geocerca en Mapa */}
      {quickViewClient && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
        >
          <div
            onClick={() => setQuickViewClient(null)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
          />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 z-10 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{quickViewClient.nombre}</h3>
                <p className="text-xs text-slate-500">{quickViewClient.direccion}</p>
              </div>
              <button
                type="button"
                onClick={() => setQuickViewClient(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                &times;
              </button>
            </div>

            <div className="p-4 space-y-3">
              <ClientLocationPicker
                latitude={quickViewClient.latitud}
                longitude={quickViewClient.longitud}
                radiusMeters={quickViewClient.radio_tolerancia_metros}
                onChange={() => {}}
                readonly={true}
                height="260px"
              />

              <div className="flex items-center justify-between rounded-lg bg-blue-50/80 p-3 text-xs text-blue-900 border border-blue-200">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  <span>Radio de Validación Presencial:</span>
                </div>
                <span className="font-bold">{quickViewClient.radio_tolerancia_metros} metros</span>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 px-5 py-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setQuickViewClient(null)}
                className="rounded-lg bg-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
