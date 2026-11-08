"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import type L from "leaflet";
import {
  Radio,
  RefreshCw,
  Search,
  Filter,
  Navigation,
  Compass,
  AlertTriangle,
  PauseCircle,
  CheckCircle2,
  WifiOff,
  ChevronRight,
  ChevronLeft,
  Eye,
  Crosshair,
  SlidersHorizontal,
} from "lucide-react";
import MapContainerWrapper from "@/components/map/MapContainerWrapper";
import SellerMarker from "@/components/map/SellerMarker";
import SellerPopupCard from "@/components/map/SellerPopup";
import {
  SellerLiveState,
  SellerOperationalStatus,
  OPERATIONAL_STATUS_CONFIGS,
  INITIAL_LIVE_SELLERS,
} from "@/types/seller";

export default function LiveMonitoringPage() {
  const [sellers, setSellers] = useState<SellerLiveState[]>(INITIAL_LIVE_SELLERS);
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  // Auto-refresco simulado cada 15 segundos
  useEffect(() => {
    if (!isAutoRefresh) return;

    const interval = setInterval(() => {
      // Pequeño desplazamiento dinámico para simular movimiento real de los vendedores en ruta
      setSellers((prev) =>
        prev.map((seller) => {
          if (seller.status === "EN_RUTA") {
            const rad = (seller.bearingDegrees * Math.PI) / 180;
            const deltaLat = (Math.cos(rad) * 0.0003);
            const deltaLng = (Math.sin(rad) * 0.0003);
            return {
              ...seller,
              latitude: seller.latitude + deltaLat,
              longitude: seller.longitude + deltaLng,
              lastReportTime: new Date().toISOString(),
              batteryLevel: Math.max(1, seller.batteryLevel - 0.1),
            };
          }
          return seller;
        })
      );
      setLastRefreshedAt(new Date());
    }, 15000);

    return () => clearInterval(interval);
  }, [isAutoRefresh]);

  // Vendedor actualmente seleccionado
  const selectedSeller = useMemo(() => {
    return sellers.find((s) => s.sellerId === selectedSellerId) || null;
  }, [sellers, selectedSellerId]);

  // Filtrado reactivo de vendedores
  const filteredSellers = useMemo(() => {
    return sellers.filter((seller) => {
      const matchesStatus =
        selectedStatus === "ALL" || seller.status === selectedStatus;
      const matchesSearch =
        seller.sellerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        seller.email.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [sellers, selectedStatus, searchQuery]);

  // Contadores por estado operativo
  const countsByStatus = useMemo(() => {
    return {
      TOTAL: sellers.length,
      EN_RUTA: sellers.filter((s) => s.status === "EN_RUTA").length,
      DETENIDO: sellers.filter((s) => s.status === "DETENIDO").length,
      VISITA_VALIDADA: sellers.filter((s) => s.status === "VISITA_VALIDADA").length,
      DESVIACION: sellers.filter((s) => s.status === "DESVIACION").length,
      SIN_CONEXION: sellers.filter((s) => s.status === "SIN_CONEXION").length,
    };
  }, [sellers]);

  // Centrar cámara en un vendedor específico
  const handleSelectSeller = useCallback(
    (seller: SellerLiveState) => {
      setSelectedSellerId(seller.sellerId);
      if (mapInstance) {
        mapInstance.flyTo([seller.latitude, seller.longitude], 16, {
          animate: true,
          duration: 1.2,
        });
      }
    },
    [mapInstance]
  );

  // Encuadrar a todos los vendedores en el mapa (Fit Bounds)
  const handleFitAllSellers = useCallback(() => {
    if (!mapInstance || sellers.length === 0) return;

    import("leaflet").then((LModule) => {
      const L = LModule.default || LModule;
      const bounds = L.latLngBounds(sellers.map((s) => [s.latitude, s.longitude]));
      mapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      setSelectedSellerId(null);
    });
  }, [mapInstance, sellers]);

  // Refrescar manualmente
  const handleManualRefresh = () => {
    setLastRefreshedAt(new Date());
  };

  return (
    <div className="space-y-4">
      {/* 1. Cabecera y Controles Globales */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
            <Radio className="h-4 w-4 animate-pulse" />
            <span>Monitoreo Activo en Tiempo Real</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Supervisión Geográfica de Fuerza de Ventas
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Última actualización:{" "}
            <span className="font-medium text-slate-700">
              {lastRefreshedAt.toLocaleTimeString("es-EC")}
            </span>{" "}
            (Frecuencia adaptativa)
          </p>
        </div>

        {/* Acciones de Cabecera */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleFitAllSellers}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors cursor-pointer"
            title="Encuadrar todos los vendedores en la pantalla"
          >
            <Crosshair className="h-3.5 w-3.5 text-blue-600" />
            <span>Ver Todos</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              isAutoRefresh
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
            title="Alternar refresco automático cada 15 segundos"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isAutoRefresh ? "bg-emerald-600 animate-pulse" : "bg-slate-400"
              }`}
            />
            <span>{isAutoRefresh ? "Auto (15s)" : "Pausado"}</span>
          </button>

          <button
            type="button"
            onClick={handleManualRefresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
            title="Refrescar datos de campo"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* 2. Tarjetas KPI / Filtros por Estado Operativo (docs/DESIGN.md § 2.2) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Total Vendedores */}
        <button
          type="button"
          onClick={() => setSelectedStatus("ALL")}
          className={`flex flex-col p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
            selectedStatus === "ALL"
              ? "border-slate-900 bg-slate-900 text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
          }`}
        >
          <span className="text-[11px] font-medium opacity-80 uppercase tracking-wider">
            Total Fuerza
          </span>
          <span className="text-xl font-bold font-mono mt-0.5">{countsByStatus.TOTAL}</span>
        </button>

        {/* En Ruta */}
        <button
          type="button"
          onClick={() => setSelectedStatus("EN_RUTA")}
          className={`flex flex-col p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
            selectedStatus === "EN_RUTA"
              ? "border-blue-600 bg-blue-600 text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-800 hover:bg-blue-50/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium opacity-80 uppercase tracking-wider">
              En Ruta
            </span>
            <Navigation className="h-3.5 w-3.5" />
          </div>
          <span className="text-xl font-bold font-mono mt-0.5">{countsByStatus.EN_RUTA}</span>
        </button>

        {/* Detenido */}
        <button
          type="button"
          onClick={() => setSelectedStatus("DETENIDO")}
          className={`flex flex-col p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
            selectedStatus === "DETENIDO"
              ? "border-amber-600 bg-amber-600 text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-800 hover:bg-amber-50/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium opacity-80 uppercase tracking-wider">
              Detenidos
            </span>
            <PauseCircle className="h-3.5 w-3.5" />
          </div>
          <span className="text-xl font-bold font-mono mt-0.5">{countsByStatus.DETENIDO}</span>
        </button>

        {/* Visita Validada */}
        <button
          type="button"
          onClick={() => setSelectedStatus("VISITA_VALIDADA")}
          className={`flex flex-col p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
            selectedStatus === "VISITA_VALIDADA"
              ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-800 hover:bg-emerald-50/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium opacity-80 uppercase tracking-wider">
              En Visita
            </span>
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
          <span className="text-xl font-bold font-mono mt-0.5">
            {countsByStatus.VISITA_VALIDADA}
          </span>
        </button>

        {/* Desviación */}
        <button
          type="button"
          onClick={() => setSelectedStatus("DESVIACION")}
          className={`flex flex-col p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
            selectedStatus === "DESVIACION"
              ? "border-red-600 bg-red-600 text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-800 hover:bg-red-50/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium opacity-80 uppercase tracking-wider">
              Desviación
            </span>
            <AlertTriangle className="h-3.5 w-3.5" />
          </div>
          <span className="text-xl font-bold font-mono mt-0.5">{countsByStatus.DESVIACION}</span>
        </button>

        {/* Sin Conexión */}
        <button
          type="button"
          onClick={() => setSelectedStatus("SIN_CONEXION")}
          className={`flex flex-col p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
            selectedStatus === "SIN_CONEXION"
              ? "border-slate-600 bg-slate-600 text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-800 hover:bg-slate-100"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium opacity-80 uppercase tracking-wider">
              Sin Señal
            </span>
            <WifiOff className="h-3.5 w-3.5" />
          </div>
          <span className="text-xl font-bold font-mono mt-0.5">{countsByStatus.SIN_CONEXION}</span>
        </button>
      </div>

      {/* 3. Área de Supervisión: Mapa Cartográfico + Panel Lateral */}
      <div className="relative rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs h-[calc(100vh-275px)] min-h-[550px] flex">
        {/* Contenedor del Mapa Leaflet */}
        <div className="flex-1 relative h-full">
          <MapContainerWrapper
            className="w-full h-full min-h-[inherit]"
            showControls={true}
            onMapReady={(map) => setMapInstance(map)}
          >
            {/* Marcadores Reactivos de Vendedores Activos */}
            {filteredSellers.map((seller) => (
              <SellerMarker
                key={seller.sellerId}
                seller={seller}
                isSelected={seller.sellerId === selectedSellerId}
                onClick={handleSelectSeller}
              />
            ))}
          </MapContainerWrapper>

          {/* Tarjeta flotante si hay un vendedor seleccionado */}
          {selectedSeller && (
            <div className="absolute top-4 left-4 z-[400] w-80 max-w-[calc(100%-2rem)]">
              <SellerPopupCard
                seller={selectedSeller}
                onClose={() => setSelectedSellerId(null)}
                onCenter={() => handleSelectSeller(selectedSeller)}
              />
            </div>
          )}

          {/* Botón flotante para abrir/cerrar barra lateral en pantallas pequeñas */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="absolute top-4 right-16 z-[400] flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-slate-200 shadow-md text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            title={isSidebarOpen ? "Ocultar lista de vendedores" : "Mostrar lista de vendedores"}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Panel Lateral de Vendedores en Campo */}
        {isSidebarOpen && (
          <aside className="w-80 border-l border-slate-200 bg-white flex flex-col h-full shrink-0 z-10 transition-all">
            {/* Cabecera del Panel */}
            <div className="p-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Fuerza en Campo ({filteredSellers.length})
                </h3>
                <span className="text-[10px] text-slate-400">
                  {selectedStatus !== "ALL" ? `Filtro: ${selectedStatus}` : "Todos"}
                </span>
              </div>

              {/* Buscador de Vendedor */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar vendedor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Lista Scrollable de Vendedores */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filteredSellers.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No se encontraron vendedores con los filtros aplicados.
                </div>
              ) : (
                filteredSellers.map((seller) => {
                  const config = OPERATIONAL_STATUS_CONFIGS[seller.status];
                  const isSelected = seller.sellerId === selectedSellerId;

                  return (
                    <div
                      key={seller.sellerId}
                      onClick={() => handleSelectSeller(seller)}
                      className={`p-3 transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-blue-50/70 border-l-4 border-l-blue-600"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-[11px] font-bold"
                          style={{ backgroundColor: config.colorHex }}
                        >
                          {seller.sellerName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">
                            {seller.sellerName}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                            <span
                              className="inline-block h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: config.colorHex }}
                            />
                            <span className="truncate">{config.label}</span>
                            <span>•</span>
                            <span className="font-mono text-slate-700">
                              {seller.speedKmh.toFixed(0)} km/h
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 text-slate-400">
                        {seller.isMock && (
                          <span title="Fake GPS">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pie del Panel Lateral */}
            <div className="p-2.5 border-t border-slate-200 bg-slate-50 text-[10px] text-slate-500 flex items-center justify-between">
              <span>Rastreo activo PostGIS</span>
              <span className="font-semibold text-blue-600">ROUTRACK v1.0</span>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
