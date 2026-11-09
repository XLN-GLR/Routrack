"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import type L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  X,
  Building2,
  User,
  Clock,
  ShieldCheck,
  AlertTriangle,
  FileText,
  DollarSign,
  Copy,
  Check,
  MapPin,
  Calendar,
  Package,
} from "lucide-react";
import type { VisitRecord } from "@/types/visit";
import { formatVisitDuration, formatTimeDisplay } from "@/types/visit";

interface VisitDetailModalProps {
  visit: VisitRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal detallado de auditoría de visitas comerciales.
 * Cumple con el Criterio 2 de TASK-020:
 * Renderiza en mapa interactivo Leaflet la geocerca circular del cliente, la posición
 * de check-in del vendedor y la línea de distancia geodésica con cálculo métrico en PostGIS.
 */
export default function VisitDetailModal({
  visit,
  isOpen,
  onClose,
}: VisitDetailModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  // Manejo de Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Inicializar o actualizar mapa Leaflet al abrir el modal con una visita
  useEffect(() => {
    if (!isOpen || !visit || !mapContainerRef.current) return;

    let isMounted = true;

    // Destruir mapa previo si existiese
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    import("leaflet").then((LModule) => {
      if (!isMounted || !mapContainerRef.current) return;
      const L = LModule.default || LModule;

      const clientPos: [number, number] = [visit.cliente_lat, visit.cliente_lng];
      const sellerPos: [number, number] = [visit.check_in_lat, visit.check_in_lng];

      const map = L.map(mapContainerRef.current, {
        center: clientPos,
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      const tileUrl =
        process.env.NEXT_PUBLIC_MAP_TILE_PROVIDER_URL ||
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

      L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(map);

      // Icono corporativo para el Cliente
      const clientIcon = L.divIcon({
        className: "custom-client-marker",
        html: `
          <div style="width: 32px; height: 32px; border-radius: 9999px; background: #0F172A; border: 2.5px solid #FFFFFF; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      // Icono para la ubicación del Vendedor (Check-in)
      const isVerified = visit.estado === "VERIFIED";
      const sellerPinColor = isVerified ? "#059669" : "#DC2626";
      const sellerIcon = L.divIcon({
        className: "custom-seller-checkin-marker",
        html: `
          <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 34px; height: 34px; border-radius: 9999px; background-color: ${
              isVerified ? "rgba(5, 150, 105, 0.25)" : "rgba(220, 38, 38, 0.25)"
            }; animation: pulse 2s infinite;"></div>
            <div style="width: 26px; height: 26px; border-radius: 9999px; background: ${sellerPinColor}; border: 2.5px solid #FFFFFF; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      // 1. Geocerca circular del cliente
      L.circle(clientPos, {
        radius: visit.cliente_radio_tolerancia || 50,
        color: isVerified ? "#059669" : "#DC2626",
        fillColor: isVerified ? "#10B981" : "#EF4444",
        fillOpacity: 0.15,
        weight: 2,
        dashArray: "4, 4",
      })
        .addTo(map)
        .bindPopup(`<b>Geocerca del Cliente:</b> Radio ${visit.cliente_radio_tolerancia}m`);

      // 2. Marcador del Cliente
      L.marker(clientPos, { icon: clientIcon })
        .addTo(map)
        .bindPopup(`<b>${visit.cliente_nombre}</b><br/>${visit.cliente_direccion}`);

      // 3. Marcador del Vendedor en Check-In
      L.marker(sellerPos, { icon: sellerIcon })
        .addTo(map)
        .bindPopup(`<b>Check-in Vendedor:</b> ${visit.vendedor_nombre}<br/>Distancia: ${visit.distancia_cliente_metros} m`);

      // 4. Línea geodésica conectora con etiqueta métrica
      const connectorLine = L.polyline([clientPos, sellerPos], {
        color: isVerified ? "#059669" : "#DC2626",
        weight: 2.5,
        dashArray: "6, 6",
        opacity: 0.85,
      }).addTo(map);

      connectorLine.bindTooltip(`Distancia: ${visit.distancia_cliente_metros} m`, {
        permanent: true,
        direction: "center",
        className: "bg-white text-slate-800 text-[11px] font-mono px-2 py-0.5 rounded shadow border border-slate-200",
      });

      // 5. Auto-encuadre de cámara
      const bounds = L.latLngBounds([clientPos, sellerPos]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });

      mapInstanceRef.current = map;

      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 200);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, visit]);

  if (!isOpen || !visit) return null;

  const isVerified = visit.estado === "VERIFIED";
  const agreements = visit.precios_pactados_compromisos?.agreements || [];
  const totalAgreementsAmount = visit.precios_pactados_compromisos?.total_amount || 0;

  const handleCopyHash = () => {
    navigator.clipboard.writeText(visit.hmac_hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-visit-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
      />

      {/* Contenedor Modal */}
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 z-10 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                isVerified ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              }`}
            >
              {isVerified ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="modal-visit-title" className="text-base font-bold text-slate-900">
                  {visit.cliente_nombre}
                </h2>
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${
                    isVerified
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {isVerified ? "VISITA VERIFICADA" : "FUERA DE GEOCERCA"}
                </span>
              </div>
              <p className="text-xs text-slate-500">{visit.cliente_direccion}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cuerpo del Modal con scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Criterio 2: Visor Cartográfico Interactivo con Geocerca y Check-in */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-blue-600" />
                Auditoría Cartográfica de la Visita (PostGIS WGS84)
              </h3>
              <span className="text-[11px] font-mono font-medium text-slate-600">
                Distancia real: <strong>{visit.distancia_cliente_metros} m</strong> / Tolerancia:{" "}
                <strong>{visit.cliente_radio_tolerancia} m</strong>
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs relative">
              <div ref={mapContainerRef} style={{ height: "260px", width: "100%" }} />
              <div className="absolute bottom-2 left-2 z-[500] rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm border border-slate-200 backdrop-blur-xs flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-900 inline-block" />
                  Cliente
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className={`h-2.5 w-2.5 rounded-full inline-block ${
                      isVerified ? "bg-emerald-600" : "bg-red-600"
                    }`}
                  />
                  Check-In Asesor
                </span>
              </div>
            </div>
          </div>

          {/* Tarjetas Informativas: Vendedor y Horarios */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <User className="h-3.5 w-3.5 text-blue-600" />
                <span>Asesor Comercial</span>
              </div>
              <div className="text-xs font-bold text-slate-900">{visit.vendedor_nombre}</div>
              <div className="text-[11px] text-slate-400 font-mono">ID: {visit.vendedor_id.slice(0, 8)}...</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <Clock className="h-3.5 w-3.5 text-emerald-600" />
                <span>Permanencia en Tienda</span>
              </div>
              <div className="text-xs font-bold text-slate-900">
                {formatVisitDuration(visit.hora_check_in, visit.hora_check_out)}
              </div>
              <div className="text-[11px] text-slate-500">
                In: {formatTimeDisplay(visit.hora_check_in)} &bull; Out: {formatTimeDisplay(visit.hora_check_out)}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <DollarSign className="h-3.5 w-3.5 text-indigo-600" />
                <span>Total Acuerdos Pactados</span>
              </div>
              <div className="text-xs font-bold text-indigo-700">
                ${totalAgreementsAmount.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-500">
                {agreements.length} productos acordados
              </div>
            </div>
          </div>

          {/* Acuerdos Comerciales y Precios Pactados */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2.5">
              <Package className="h-3.5 w-3.5 text-blue-600" />
              Precios y Acuerdos Comerciales Pactados
            </h3>

            {agreements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                No se registraron líneas de precios pactados en esta visita comercial.
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-600">
                    <tr>
                      <th className="px-3.5 py-2.5">Producto / SKU</th>
                      <th className="px-3.5 py-2.5 text-center">Cantidad</th>
                      <th className="px-3.5 py-2.5 text-right">Precio Pactado</th>
                      <th className="px-3.5 py-2.5 text-center">Descuento</th>
                      <th className="px-3.5 py-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {agreements.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-3.5 py-2 font-medium text-slate-900">{item.product_name}</td>
                        <td className="px-3.5 py-2 text-center text-slate-700 font-mono">{item.quantity}</td>
                        <td className="px-3.5 py-2 text-right text-slate-700 font-mono">
                          ${item.agreed_unit_price.toFixed(2)}
                        </td>
                        <td className="px-3.5 py-2 text-center text-slate-600">
                          {item.discount_percentage > 0 ? `${item.discount_percentage}%` : "—"}
                        </td>
                        <td className="px-3.5 py-2 text-right font-bold text-slate-900 font-mono">
                          ${item.subtotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50/80 border-t border-slate-200 font-bold text-xs">
                    <tr>
                      <td colSpan={4} className="px-3.5 py-2.5 text-right text-slate-700">
                        Total Facturado / Comprometido:
                      </td>
                      <td className="px-3.5 py-2.5 text-right text-blue-700 font-mono">
                        ${totalAgreementsAmount.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Observaciones de Campo y Compromisos de Entrega */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {visit.precios_pactados_compromisos?.promised_delivery_date && (
              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  <span>Fecha Prometida de Despacho:</span>
                </div>
                <div className="text-xs text-slate-800">
                  {visit.precios_pactados_compromisos.promised_delivery_date}
                </div>
              </div>
            )}

            {visit.precios_pactados_compromisos?.stock_notes && (
              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                  <FileText className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Inventario y Stock en Percha:</span>
                </div>
                <div className="text-xs text-slate-800">
                  {visit.precios_pactados_compromisos.stock_notes}
                </div>
              </div>
            )}
          </div>

          {visit.observaciones && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3.5">
              <div className="text-xs font-semibold text-slate-700 mb-1">Notas y Acuerdos Verbales:</div>
              <p className="text-xs text-slate-600 leading-relaxed">{visit.observaciones}</p>
            </div>
          )}

          {/* Auditoría Forense Criptográfica (HMAC-SHA256) */}
          <div className="rounded-xl border border-slate-200 bg-slate-900 p-3.5 text-white">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Firma Criptográfica HMAC-SHA256 Inmutable
              </span>
              <button
                type="button"
                onClick={handleCopyHash}
                className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
              >
                {copiedHash ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-emerald-400">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copiar Hash</span>
                  </>
                )}
              </button>
            </div>
            <div className="font-mono text-xs text-slate-300 break-all select-all bg-slate-950/60 p-2 rounded-lg border border-slate-800">
              {visit.hmac_hash}
            </div>
          </div>
        </div>

        {/* Pie de Acciones */}
        <div className="flex items-center justify-end border-t border-slate-100 px-6 py-3.5 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300 transition"
          >
            Cerrar Detalle
          </button>
        </div>
      </div>
    </div>
  );
}

