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
  Route,
} from "lucide-react";
import MapContainerWrapper from "@/components/map/MapContainerWrapper";
import SellerMarker from "@/components/map/SellerMarker";
import SellerPopupCard from "@/components/map/SellerPopup";
import RoadSnappedPolyline from "@/components/map/RoadSnappedPolyline";
import ShiftOriginMarker from "@/components/map/ShiftOriginMarker";
import type { LatLngTuple } from "@/types/map";
import {
  SellerLiveState,
  SellerOperationalStatus,
  OPERATIONAL_STATUS_CONFIGS,
  INITIAL_LIVE_SELLERS,
} from "@/types/seller";
import { createClient } from "@/lib/supabase/client";
import { parsePostgisPoint, smoothRoutePolyline } from "@/lib/geo/spatial";

export default function LiveMonitoringPage() {
  const [sellers, setSellers] = useState<SellerLiveState[]>([]);
  const [realShiftIds, setRealShiftIds] = useState<Set<string>>(new Set());
  const [realRoutesByShift, setRealRoutesByShift] = useState<Record<string, LatLngTuple[]>>({});
  const [realStartTimeByShift, setRealStartTimeByShift] = useState<Record<string, string>>({});
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);
  const [showRoadSnappedRoutes, setShowRoadSnappedRoutes] = useState<boolean>(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const hasAutoCenteredRealSellerRef = React.useRef<boolean>(false);

  // Consulta y carga de jornadas reales desde Supabase (decodificando PostGIS EWKB / WKT / GeoJSON)
  const loadLiveSellers = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: jornadas, error: jornadasError } = await supabase
        .from("jornadas_laborales")
        .select("id, vendedor_id, estado, fecha_inicio, fecha_fin, bateria_inicio, bateria_fin, ubicacion_inicio, ubicacion_fin")
        .order("fecha_inicio", { ascending: false })
        .limit(50);

      if (jornadasError || !jornadas) {
        return;
      }

      // Desduplicar por vendedor: priorizar jornada abierta ('OPEN' o 'EN_CURSO') si existe, sino la más reciente
      const latestJornadaBySeller = new Map<string, (typeof jornadas)[0]>();
      for (const j of jornadas) {
        const existing = latestJornadaBySeller.get(j.vendedor_id);
        if (!existing) {
          latestJornadaBySeller.set(j.vendedor_id, j);
        } else if (existing.estado === "CLOSED" && (j.estado === "OPEN" || j.estado === "EN_CURSO")) {
          latestJornadaBySeller.set(j.vendedor_id, j);
        }
      }
      const jornadasFiltradas = Array.from(latestJornadaBySeller.values());

      if (jornadasFiltradas.length === 0) {
        setRealShiftIds(new Set());
        setRealRoutesByShift({});
        setRealStartTimeByShift({});
        setSellers((prev) => {
          const demoIds = new Set(INITIAL_LIVE_SELLERS.map((d) => d.sellerId));
          const demosActuales = prev.filter((s) => demoIds.has(s.sellerId));
          return demosActuales.length > 0 ? demosActuales : INITIAL_LIVE_SELLERS;
        });
        return;
      }

      const vendedorIds = Array.from(new Set(jornadasFiltradas.map((j) => j.vendedor_id)));
      const { data: perfiles } = await supabase
        .from("perfiles")
        .select("id, nombre_completo, email, telefono")
        .in("id", vendedorIds);

      const jornadaIds = jornadasFiltradas.map((j) => j.id);
      const { data: puntos } = await supabase
        .from("ubicaciones_gps")
        .select("jornada_id, vendedor_id, ubicacion, precision_metros, velocidad_ms, orientacion_grados, nivel_bateria, es_simulado, registrado_en")
        .in("jornada_id", jornadaIds)
        .order("registrado_en", { ascending: true });

      const nextRoutes: Record<string, LatLngTuple[]> = {};
      const nextStartTimes: Record<string, string> = {};

      const realSellers: SellerLiveState[] = jornadasFiltradas.map((j) => {
        const isClosed = j.estado === "CLOSED";
        const perfil = perfiles?.find((p) => p.id === j.vendedor_id);
        const puntosJornada = (puntos || []).filter((pt) => pt.jornada_id === j.id);
        const routeCoords: LatLngTuple[] = [];

        // Solo si la jornada está ACTIVA (OPEN) mostramos la polilínea del trayecto
        if (!isClosed) {
          const originParsed = parsePostgisPoint(j.ubicacion_inicio);
          for (const pt of puntosJornada) {
            const parsed = parsePostgisPoint(pt.ubicacion);
            if (parsed) {
              routeCoords.push(parsed);
            }
          }
          if (routeCoords.length === 0 && originParsed) {
            routeCoords.push(originParsed);
          }
          // Suavizado estético de curva con algoritmo de Chaikin para eliminar zigzags bruscos
          nextRoutes[j.id] = smoothRoutePolyline(routeCoords, 2);
        } else {
          // Si la jornada FINALIZÓ, la polilínea del trayecto anterior se oculta para dejar el mapa limpio
          nextRoutes[j.id] = [];
        }

        nextStartTimes[j.id] = j.fecha_inicio
          ? new Date(j.fecha_inicio).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })
          : "Inicio";

        const ultPunto = puntosJornada.length > 0 ? puntosJornada[puntosJornada.length - 1] : null;
        const coords =
          (isClosed ? parsePostgisPoint(j.ubicacion_fin) : null) ||
          parsePostgisPoint(ultPunto?.ubicacion) ||
          parsePostgisPoint(j.ubicacion_inicio) ||
          [-0.180653, -78.467834];

        const rawSpeedKmh = ultPunto?.velocidad_ms ? Number((ultPunto.velocidad_ms * 3.6).toFixed(1)) : 0;
        const speedKmh = isClosed || rawSpeedKmh < 1.2 ? 0 : rawSpeedKmh;
        const isMock = ultPunto?.es_simulado ?? false;
        const lastTimeStr = isClosed && j.fecha_fin ? j.fecha_fin : (ultPunto?.registrado_en || j.fecha_inicio || new Date().toISOString());
        const minutesSinceReport = (Date.now() - new Date(lastTimeStr).getTime()) / 60000;

        let status: SellerOperationalStatus = "DETENIDO";
        if (isClosed) {
          status = "SIN_CONEXION";
        } else if (isMock) {
          status = "DESVIACION";
        } else if (minutesSinceReport > 15) {
          status = "SIN_CONEXION";
        } else if (speedKmh >= 1.5) {
          status = "EN_RUTA";
        } else {
          status = "DETENIDO";
        }

        return {
          sellerId: j.vendedor_id,
          sellerName: perfil?.nombre_completo || `Vendedor ${j.vendedor_id.slice(0, 8)}`,
          email: perfil?.email || "vendedor@routrack.ec",
          phone: perfil?.telefono || undefined,
          shiftId: j.id,
          latitude: coords[0],
          longitude: coords[1],
          accuracyMeters: ultPunto?.precision_metros ? Number(ultPunto.precision_metros.toFixed(1)) : 8.0,
          speedKmh,
          bearingDegrees: ultPunto?.orientacion_grados || 0,
          batteryLevel: ultPunto?.nivel_bateria ?? (isClosed ? j.bateria_fin : j.bateria_inicio) ?? 100,
          isMock,
          status,
          lastReportTime: lastTimeStr,
          deviationReason: isClosed ? "Jornada Concluida" : undefined,
        };
      });

      const activeRealShiftIds = new Set(realSellers.map((r) => r.shiftId));
      setRealShiftIds(activeRealShiftIds);
      setRealRoutesByShift(nextRoutes);
      setRealStartTimeByShift(nextStartTimes);

      setSellers(realSellers);
      setLastRefreshedAt(new Date());

      if (realSellers.length > 0 && !hasAutoCenteredRealSellerRef.current && mapInstance) {
        hasAutoCenteredRealSellerRef.current = true;
        const firstReal = realSellers[0];
        setSelectedSellerId(firstReal.sellerId);
        mapInstance.flyTo([firstReal.latitude, firstReal.longitude], 16, {
          animate: true,
          duration: 1.0,
        });
      }
    } catch (_err) {
      // En caso de corte de red, se preserva el estado actual sin caídas
    }
  }, [mapInstance]);

  // Carga inicial y suscripción a cambios Realtime de Supabase
  useEffect(() => {
    loadLiveSellers();

    const supabase = createClient();
    const channel = supabase
      .channel("realtime-live-sellers")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ubicaciones_gps" },
        () => {
          loadLiveSellers();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jornadas_laborales" },
        () => {
          loadLiveSellers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadLiveSellers]);

  // Auto-refresco real con Supabase cada 10s
  useEffect(() => {
    if (!isAutoRefresh) return;

    const interval = setInterval(() => {
      loadLiveSellers();
      setLastRefreshedAt(new Date());
    }, 10000);

    return () => clearInterval(interval);
  }, [isAutoRefresh, loadLiveSellers]);

  // Vendedor actualmente seleccionado
  const selectedSeller = useMemo(() => {
    return sellers.find((s) => s.sellerId === selectedSellerId) || null;
  }, [sellers, selectedSellerId]);

  // Corredor de coordenadas reales (si vienen de Supabase) o de muestra para trazado vial OSRM (TASK-034)
  const selectedSellerRoutePoints = useMemo<LatLngTuple[]>(() => {
    if (!selectedSeller) return [];
    const realRoute = realRoutesByShift[selectedSeller.shiftId];
    if (realRoute && realRoute.length >= 1) {
      return realRoute;
    }
    const baseLat = selectedSeller.latitude;
    const baseLng = selectedSeller.longitude;
    return [
      [baseLat - 0.0055, baseLng - 0.0045],
      [baseLat - 0.0035, baseLng - 0.0030],
      [baseLat - 0.0018, baseLng - 0.0012],
      [baseLat, baseLng],
    ];
  }, [selectedSeller, realRoutesByShift]);

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

  // Callback estable para capturar la instancia del mapa sin gatillar renders en cascada
  const handleMapReady = useCallback((map: L.Map) => {
    setMapInstance(map);
  }, []);

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
    loadLiveSellers();
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
            onClick={() => setShowRoadSnappedRoutes(!showRoadSnappedRoutes)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              showRoadSnappedRoutes
                ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
            title="Alternar trazado vial realista ajustado a calles (OSRM $0 USD)"
          >
            <Route className="h-3.5 w-3.5" />
            <span>{showRoadSnappedRoutes ? "Vía Real (OSRM)" : "Vía Directa"}</span>
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
            onMapReady={handleMapReady}
          >
            {/* Polilínea Vial Ajustada a Calles Físicas con OSRM (TASK-032 / TASK-034) */}
            {showRoadSnappedRoutes && selectedSellerRoutePoints.length >= 2 && (
              <RoadSnappedPolyline
                coordinates={selectedSellerRoutePoints}
                color={selectedSeller ? OPERATIONAL_STATUS_CONFIGS[selectedSeller.status].colorHex : "#2563EB"}
                weight={5}
                opacity={0.85}
              />
            )}

            {/* Marcador de Inicio de Turno (Punto de Partida del Vendedor Seleccionado) */}
            {selectedSeller && selectedSellerRoutePoints.length >= 1 && (
              <ShiftOriginMarker
                point={selectedSellerRoutePoints[0]}
                sellerName={selectedSeller.sellerName}
                label="Inicio de Turno"
                startTime={realStartTimeByShift[selectedSeller.shiftId] || "08:15 AM"}
              />
            )}

            {/* Marcadores Reactivos de Vendedores Activos con Animación Cinemática 60 FPS */}
            {filteredSellers.map((seller) => (
              <SellerMarker
                key={seller.sellerId}
                seller={seller}
                isSelected={seller.sellerId === selectedSellerId}
                onClick={handleSelectSeller}
                enableKinematicAnimation={true}
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
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {seller.sellerName}
                            </p>
                            {realShiftIds.has(seller.shiftId) && (
                              <span className="inline-flex items-center rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700 shrink-0">
                                Real
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                            <span
                              className="inline-block h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: seller.deviationReason === "Jornada Concluida" ? "#64748B" : config.colorHex }}
                            />
                            <span className="truncate">
                              {seller.deviationReason === "Jornada Concluida" ? "Jornada Concluida" : config.label}
                            </span>
                            {seller.deviationReason !== "Jornada Concluida" && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-slate-700">
                                  {seller.speedKmh.toFixed(0)} km/h
                                </span>
                              </>
                            )}
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
