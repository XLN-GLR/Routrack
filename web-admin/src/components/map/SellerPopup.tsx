"use client";

import React from "react";
import {
  User,
  Gauge,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Clock,
  Compass,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import {
  SellerLiveState,
  OPERATIONAL_STATUS_CONFIGS,
} from "@/types/seller";

/**
 * Formatea una fecha ISO 8601 a un formato legible y tiempo relativo en español.
 */
export function formatReportTime(isoString: string): { formatted: string; relative: string } {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return { formatted: "Desconocida", relative: "Sin datos" };
    }

    const formatted = date.toLocaleTimeString("es-EC", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
    let relative = "Ahora";
    if (diffSeconds > 60 && diffSeconds < 3600) {
      relative = `Hace ${Math.floor(diffSeconds / 60)} min`;
    } else if (diffSeconds >= 3600) {
      relative = `Hace ${Math.floor(diffSeconds / 3600)} h`;
    } else if (diffSeconds > 10) {
      relative = `Hace ${diffSeconds} s`;
    }

    return { formatted, relative };
  } catch {
    return { formatted: isoString, relative: "" };
  }
}

/**
 * Genera el marcado HTML del Popup compatible con la API de Leaflet (`marker.bindPopup`).
 * Cumple rigurosamente con el Criterio 2: "Popup muestra datos de vendedor, velocidad, batería y última hora de reporte".
 */
export function renderSellerPopupHtml(seller: SellerLiveState): string {
  const statusConfig = OPERATIONAL_STATUS_CONFIGS[seller.status];
  const { formatted, relative } = formatReportTime(seller.lastReportTime);
  const initials = seller.sellerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const batteryColor =
    seller.batteryLevel <= 15
      ? "#DC2626"
      : seller.batteryLevel <= 40
      ? "#D97706"
      : "#059669";

  return `
    <div class="p-3 max-w-[280px] text-slate-800 font-sans leading-tight">
      <!-- Cabecera del Vendedor -->
      <div class="flex items-center gap-2.5 pb-2.5 mb-2.5 border-b border-slate-200">
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white text-xs font-bold">
          ${initials}
        </div>
        <div class="min-w-0 flex-1">
          <h4 class="text-xs font-semibold text-slate-900 truncate" title="${seller.sellerName}">
            ${seller.sellerName}
          </h4>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span class="inline-block h-2 w-2 rounded-full" style="background-color: ${statusConfig.colorHex}"></span>
            <span class="text-[11px] font-medium" style="color: ${statusConfig.colorHex}">
              ${statusConfig.label}
            </span>
          </div>
        </div>
      </div>

      <!-- Métricas Clave (Velocidad, Batería, Rumbo) -->
      <div class="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 mb-2.5 text-center">
        <div>
          <span class="text-[10px] text-slate-600 block uppercase font-medium">Velocidad</span>
          <span class="text-xs font-bold text-slate-900 font-mono">${seller.speedKmh.toFixed(1)} km/h</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-600 block uppercase font-medium">Batería</span>
          <span class="text-xs font-bold font-mono" style="color: ${batteryColor}">${seller.batteryLevel}%</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-600 block uppercase font-medium">Rumbo</span>
          <span class="text-xs font-bold text-slate-900 font-mono">${Math.round(seller.bearingDegrees)}°</span>
        </div>
      </div>

      <!-- Alertas Especiales (Mock Location o Desviación) -->
      ${
        seller.isMock
          ? `
          <div class="flex items-center gap-1.5 p-1.5 bg-red-50 text-red-700 border border-red-200 rounded text-[11px] font-medium mb-2">
            <svg class="h-3.5 w-3.5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <span>Ubicación simulada detectada (Fake GPS)</span>
          </div>
        `
          : ""
      }

      ${
        seller.status === "VISITA_VALIDADA" && seller.currentClientName
          ? `
          <div class="flex items-center gap-1.5 p-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[11px] font-medium mb-2 truncate">
            <svg class="h-3.5 w-3.5 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            <span class="truncate">Visita: <strong>${seller.currentClientName}</strong></span>
          </div>
        `
          : ""
      }

      <!-- Pie de Reporte y Coordenadas -->
      <div class="space-y-1 text-[11px] text-slate-500">
        <div class="flex items-center justify-between">
          <span class="flex items-center gap-1">
            <svg class="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Último reporte:
          </span>
          <span class="font-medium text-slate-700" title="${formatted}">${formatted} (${relative})</span>
        </div>
        <div class="flex items-center justify-between font-mono text-[10px]">
          <span>GPS:</span>
          <span>${seller.latitude.toFixed(5)}, ${seller.longitude.toFixed(5)}</span>
        </div>
      </div>
    </div>
  `;
}

export interface SellerPopupCardProps {
  seller: SellerLiveState;
  onCenter?: () => void;
  onClose?: () => void;
}

/**
 * Componente React puro para renderizar la tarjeta de detalles del vendedor
 * tanto en paneles flotantes como en la barra lateral de supervisión.
 */
export default function SellerPopupCard({
  seller,
  onCenter,
  onClose,
}: SellerPopupCardProps) {
  const statusConfig = OPERATIONAL_STATUS_CONFIGS[seller.status];
  const { formatted, relative } = formatReportTime(seller.lastReportTime);
  const initials = seller.sellerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg text-slate-800">
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white font-bold text-xs">
            {initials}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{seller.sellerName}</h3>
            <p className="text-xs text-slate-400">{seller.email}</p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white ${statusConfig.bgClass}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          {statusConfig.label}
        </span>
      </div>

      {/* Grid de Métricas */}
      <div className="grid grid-cols-3 gap-2 py-3">
        <div className="rounded-lg bg-slate-50 p-2 text-center border border-slate-100">
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 mb-0.5">
            <Gauge className="h-3 w-3" />
            <span>Velocidad</span>
          </div>
          <span className="text-sm font-bold text-slate-900 font-mono">
            {seller.speedKmh.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">km/h</span>
          </span>
        </div>

        <div className="rounded-lg bg-slate-50 p-2 text-center border border-slate-100">
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 mb-0.5">
            <Battery className="h-3 w-3" />
            <span>Batería</span>
          </div>
          <span
            className={`text-sm font-bold font-mono ${
              seller.batteryLevel <= 20
                ? "text-red-600"
                : seller.batteryLevel <= 50
                ? "text-amber-600"
                : "text-emerald-600"
            }`}
          >
            {seller.batteryLevel}%
          </span>
        </div>

        <div className="rounded-lg bg-slate-50 p-2 text-center border border-slate-100">
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 mb-0.5">
            <Compass className="h-3 w-3" />
            <span>Rumbo</span>
          </div>
          <span className="text-sm font-bold text-slate-900 font-mono">
            {Math.round(seller.bearingDegrees)}°
          </span>
        </div>
      </div>

      {/* Alerta de Mock Location */}
      {seller.isMock && (
        <div className="flex items-center gap-2 p-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium mb-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          <span>Alerta: Ubicación simulada detectada (Fake GPS)</span>
        </div>
      )}

      {/* Visita activa */}
      {seller.status === "VISITA_VALIDADA" && seller.currentClientName && (
        <div className="flex items-center gap-2 p-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-medium mb-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>Visita en curso: {seller.currentClientName}</span>
        </div>
      )}

      {/* Info complementaria */}
      <div className="space-y-1.5 text-xs text-slate-500 pt-1">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            Último reporte:
          </span>
          <span className="font-medium text-slate-700">
            {formatted} ({relative})
          </span>
        </div>
        <div className="flex items-center justify-between font-mono text-[11px]">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            Coordenadas:
          </span>
          <span className="text-slate-600">
            {seller.latitude.toFixed(5)}, {seller.longitude.toFixed(5)}
          </span>
        </div>
      </div>

      {/* Botón de Enfoque */}
      {onCenter && (
        <button
          type="button"
          onClick={onCenter}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 transition-colors cursor-pointer"
        >
          <MapPin className="h-3.5 w-3.5" />
          Enfocar en mapa
        </button>
      )}
    </div>
  );
}

