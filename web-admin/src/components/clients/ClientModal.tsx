"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Building2, MapPin, ShieldCheck, Phone, FileText, Check, AlertCircle, Loader2 } from "lucide-react";
import type { Client, ClientFormData } from "@/types/client";
import { validateClientInput } from "@/lib/validation/clientSchema";
import ClientLocationPicker from "./ClientLocationPicker";

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientToEdit: Client | null;
  onSave: (data: ClientFormData, clientId?: string) => Promise<{ success: boolean; error?: string }>;
}

const GEOFENCE_PRESETS = [25, 50, 100, 200];
const DEFAULT_COORDINATES: [number, number] = [-0.180653, -78.467834]; // Quito, Ecuador

/**
 * Modal accesible de alta fidelidad para Creación y Edición de Clientes Georreferenciados.
 * Integra validación Zod estricta en doble capa y selector de mapa Leaflet en tiempo real.
 */
export default function ClientModal({
  isOpen,
  onClose,
  clientToEdit,
  onSave,
}: ClientModalProps) {
  // Estado local del formulario
  const [nombre, setNombre] = useState("");
  const [nombreComercial, setNombreComercial] = useState("");
  const [identificacionFiscal, setIdentificacionFiscal] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [latitud, setLatitud] = useState(DEFAULT_COORDINATES[0]);
  const [longitud, setLongitud] = useState(DEFAULT_COORDINATES[1]);
  const [radioTolerancia, setRadioTolerancia] = useState(50);
  const [activo, setActivo] = useState(true);

  // Estados de retroalimentación
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Sincronizar estado cuando se abre para editar o crear
  useEffect(() => {
    if (clientToEdit) {
      setNombre(clientToEdit.nombre || "");
      setNombreComercial(clientToEdit.nombre_comercial || "");
      setIdentificacionFiscal(clientToEdit.identificacion_fiscal || "");
      setDireccion(clientToEdit.direccion || "");
      setTelefono(clientToEdit.telefono || "");
      setLatitud(clientToEdit.latitud ?? DEFAULT_COORDINATES[0]);
      setLongitud(clientToEdit.longitud ?? DEFAULT_COORDINATES[1]);
      setRadioTolerancia(clientToEdit.radio_tolerancia_metros || 50);
      setActivo(clientToEdit.activo ?? true);
    } else {
      // Valores iniciales limpios para nuevo cliente
      setNombre("");
      setNombreComercial("");
      setIdentificacionFiscal("");
      setDireccion("");
      setTelefono("");
      setLatitud(DEFAULT_COORDINATES[0]);
      setLongitud(DEFAULT_COORDINATES[1]);
      setRadioTolerancia(50);
      setActivo(true);
    }
    setErrors({});
    setServerError(null);
  }, [clientToEdit, isOpen]);

  // Manejo de tecla Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    },
    [isOpen, isSubmitting, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  const isEditing = Boolean(clientToEdit);

  // Manejador del envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const payload: ClientFormData = {
      nombre,
      nombre_comercial: nombreComercial ? nombreComercial : null,
      identificacion_fiscal: identificacionFiscal,
      direccion,
      telefono: telefono ? telefono : null,
      latitud,
      longitud,
      radio_tolerancia_metros: radioTolerancia,
      activo,
    };

    // Validación Zod
    const validation = validateClientInput(payload);
    if (!validation.success) {
      setErrors(validation.errors || {});
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const res = await onSave(validation.data!, clientToEdit?.id);
      if (res.success) {
        onClose();
      } else {
        setServerError(res.error || "Ocurrió un error inesperado al guardar el cliente.");
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Error de comunicación con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-client-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        onClick={() => !isSubmitting && onClose()}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
      />

      {/* Contenedor Modal */}
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 z-10 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 id="modal-client-title" className="text-base font-bold text-slate-900">
                {isEditing ? "Editar Cliente Comercial" : "Registrar Nuevo Cliente"}
              </h2>
              <p className="text-xs text-slate-500">
                {isEditing
                  ? "Actualiza la razón social, RUC o coordenadas espaciales de la geocerca"
                  : "Ingresa los datos fiscales y fija las coordenadas cartográficas del punto de venta"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {serverError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Sección 1: Datos Generales */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-blue-600" />
              Información Comercial y Fiscal
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Razón Social */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Razón Social / Nombre Oficial <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Corporación Favorita C.A. / Supermaxi"
                  className={`w-full rounded-lg border px-3 py-2 text-xs text-slate-900 shadow-xs focus:outline-hidden transition ${
                    errors.nombre
                      ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-red-50/20"
                      : "border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  }`}
                />
                {errors.nombre && (
                  <p className="mt-1 text-[11px] text-red-600">{errors.nombre}</p>
                )}
              </div>

              {/* Nombre Comercial */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre Comercial (Opcional)
                </label>
                <input
                  type="text"
                  value={nombreComercial}
                  onChange={(e) => setNombreComercial(e.target.value)}
                  placeholder="Ej. Supermaxi El Jardín"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* RUC / Cédula */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  RUC / Cédula <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={13}
                  value={identificacionFiscal}
                  onChange={(e) => setIdentificacionFiscal(e.target.value.replace(/\D/g, ""))}
                  placeholder="1790016919001"
                  className={`w-full rounded-lg border px-3 py-2 text-xs font-mono text-slate-900 shadow-xs focus:outline-hidden transition ${
                    errors.identificacion_fiscal
                      ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-red-50/20"
                      : "border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  }`}
                />
                {errors.identificacion_fiscal && (
                  <p className="mt-1 text-[11px] text-red-600">{errors.identificacion_fiscal}</p>
                )}
              </div>

              {/* Dirección Física */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dirección Física Completa <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Av. Amazonas N24-196 y Av. República, Quito"
                  className={`w-full rounded-lg border px-3 py-2 text-xs text-slate-900 shadow-xs focus:outline-hidden transition ${
                    errors.direccion
                      ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-red-50/20"
                      : "border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  }`}
                />
                {errors.direccion && (
                  <p className="mt-1 text-[11px] text-red-600">{errors.direccion}</p>
                )}
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Phone className="h-3 w-3 text-slate-400" />
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="02-2980-000 / 0991234567"
                  className={`w-full rounded-lg border px-3 py-2 text-xs text-slate-900 shadow-xs focus:outline-hidden transition ${
                    errors.telefono
                      ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      : "border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  }`}
                />
                {errors.telefono && (
                  <p className="mt-1 text-[11px] text-red-600">{errors.telefono}</p>
                )}
              </div>

              {/* Estado Activo / Inactivo */}
              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={(e) => setActivo(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Punto de venta habilitado para visitas
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Sección 2: Georreferenciación y Geocerca PostGIS */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-blue-600" />
                Ubicación Espacial y Geocerca (PostGIS WGS84)
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-medium">Tolerancia:</span>
                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
                  {radioTolerancia} metros
                </span>
              </div>
            </div>

            {/* Selector de Presets de Radio */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[11px] text-slate-500">Radio predefinido:</span>
              {GEOFENCE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setRadioTolerancia(preset)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    radioTolerancia === preset
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {preset}m
                </button>
              ))}
              <div className="flex items-center gap-1.5 ml-auto">
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="5"
                  value={radioTolerancia}
                  onChange={(e) => setRadioTolerancia(Number(e.target.value))}
                  className="h-1.5 w-24 sm:w-32 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            </div>

            {errors.radio_tolerancia_metros && (
              <p className="mb-2 text-[11px] text-red-600">{errors.radio_tolerancia_metros}</p>
            )}

            {/* Visor interactivo Leaflet */}
            <ClientLocationPicker
              latitude={latitud}
              longitude={longitud}
              radiusMeters={radioTolerancia}
              onChange={(newLat, newLng) => {
                setLatitud(newLat);
                setLongitud(newLng);
              }}
              height="280px"
            />

            {(errors.latitud || errors.longitud) && (
              <p className="mt-2 text-[11px] text-red-600">
                {errors.latitud || errors.longitud}
              </p>
            )}
          </div>
        </form>

        {/* Pie de Acciones */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/70">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>{isEditing ? "Actualizar Cliente" : "Guardar Cliente"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

