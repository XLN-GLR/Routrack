"use client";

import React, { useState, useMemo, useCallback } from "react";
import type L from "leaflet";
import {
  Route,
  Calendar,
  User,
  Clock,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Compass,
  ArrowRight,
  SlidersHorizontal,
  ChevronRight,
  Eye,
  RefreshCw,
} from "lucide-react";
import MapContainerWrapper from "@/components/map/MapContainerWrapper";
import RoutePolyline from "@/components/map/RoutePolyline";
import {
  RoutePoint,
  RouteStop,
  DeviationSegment,
  calculateRouteMetrics,
  sortPointsChronologically,
  groupIntoDeviationSegments,
  detectDeviatedPoints,
  DEFAULT_DEVIATION_THRESHOLD_METERS,
} from "@/lib/geo/deviations";

// Vendedores disponibles para selección
const AVAILABLE_SELLERS = [
  { id: "vendedor-001", name: "Carlos Mendoza", email: "carlos.mendoza@routrack.ec" },
  { id: "vendedor-002", name: "Diana Paredes", email: "diana.paredes@routrack.ec" },
  { id: "vendedor-003", name: "Jorge Alarcón", email: "jorge.alarcon@routrack.ec" },
  { id: "vendedor-004", name: "Luis Morales", email: "luis.morales@routrack.ec" },
];

// Clientes y paradas autorizadas en la ruta de Quito (Plaza Foch -> La Mariscal -> González Suárez)
const MOCK_ROUTE_STOPS: RouteStop[] = [
  {
    id: "cliente-001",
    name: "Distribuidora Los Andes",
    address: "Av. 12 de Octubre y Lincoln",
    latitude: -0.2052,
    longitude: -78.4912,
    toleranceRadiusMeters: 50,
    plannedOrder: 1,
    visitedAt: "2026-11-08T08:45:00.000Z",
    isVerified: true,
  },
  {
    id: "cliente-002",
    name: "Minimarket El Trébol",
    address: "Reina Victoria y Calama",
    latitude: -0.2018,
    longitude: -78.4905,
    toleranceRadiusMeters: 50,
    plannedOrder: 2,
    visitedAt: "2026-11-08T10:15:00.000Z",
    isVerified: true,
  },
  {
    id: "cliente-003",
    name: "Farmacia San Gabriel",
    address: "Av. González Suárez y Coruña",
    latitude: -0.1985,
    longitude: -78.4795,
    toleranceRadiusMeters: 50,
    plannedOrder: 3,
    visitedAt: "2026-11-08T12:30:00.000Z",
    isVerified: true,
  },
  {
    id: "cliente-004",
    name: "Supermercado Santa María",
    address: "Av. Eloy Alfaro y Shyris",
    latitude: -0.1812,
    longitude: -78.4798,
    toleranceRadiusMeters: 50,
    plannedOrder: 4,
    visitedAt: "2026-11-08T15:20:00.000Z",
    isVerified: true,
  },
];

// Secuencia cronológica de telemetría de una jornada con una desviación intencional (> 300m)
const MOCK_ROUTE_POINTS: RoutePoint[] = [
  // 1. Inicio en Plaza Foch (08:00)
  {
    id: "pt-1",
    shiftId: "shift-001",
    latitude: -0.2065,
    longitude: -78.4935,
    accuracyMeters: 5.0,
    speedKmh: 15.0,
    bearingDegrees: 45,
    isMock: false,
    recordedAt: "2026-11-08T08:00:00.000Z",
  },
  // 2. Acercamiento al Cliente 1 (08:30)
  {
    id: "pt-2",
    shiftId: "shift-001",
    latitude: -0.2051,
    longitude: -78.4914,
    accuracyMeters: 4.2,
    speedKmh: 12.0,
    bearingDegrees: 60,
    isMock: false,
    recordedAt: "2026-11-08T08:30:00.000Z",
  },
  // 3. Cliente 1: Visita verificada (08:45)
  {
    id: "pt-3",
    shiftId: "shift-001",
    latitude: -0.2052,
    longitude: -78.4912,
    accuracyMeters: 3.8,
    speedKmh: 0.0,
    bearingDegrees: 0,
    isMock: false,
    recordedAt: "2026-11-08T08:45:00.000Z",
  },
  // 4. Traslado a Cliente 2 (10:00)
  {
    id: "pt-4",
    shiftId: "shift-001",
    latitude: -0.2035,
    longitude: -78.4908,
    accuracyMeters: 5.5,
    speedKmh: 24.5,
    bearingDegrees: 350,
    isMock: false,
    recordedAt: "2026-11-08T10:00:00.000Z",
  },
  // 5. Cliente 2: Visita verificada (10:15)
  {
    id: "pt-5",
    shiftId: "shift-001",
    latitude: -0.2018,
    longitude: -78.4905,
    accuracyMeters: 4.0,
    speedKmh: 0.0,
    bearingDegrees: 0,
    isMock: false,
    recordedAt: "2026-11-08T10:15:00.000Z",
  },

  // 6. ANOMALÍA: Desviación no autorizada hacia La Floresta/Guápulo (> 600m de los clientes)
  {
    id: "pt-6",
    shiftId: "shift-001",
    latitude: -0.2085,
    longitude: -78.4785, // Desvío evidente
    accuracyMeters: 7.0,
    speedKmh: 42.0,
    bearingDegrees: 120,
    isMock: false,
    recordedAt: "2026-11-08T11:00:00.000Z",
  },
  {
    id: "pt-7",
    shiftId: "shift-001",
    latitude: -0.2105,
    longitude: -78.4745, // Punto máximo de desvío (~1.2 km de paradas)
    accuracyMeters: 8.5,
    speedKmh: 38.0,
    bearingDegrees: 115,
    isMock: false,
    recordedAt: "2026-11-08T11:25:00.000Z",
  },
  {
    id: "pt-8",
    shiftId: "shift-001",
    latitude: -0.2075,
    longitude: -78.4765, // Retorno
    accuracyMeters: 6.0,
    speedKmh: 29.0,
    bearingDegrees: 310,
    isMock: false,
    recordedAt: "2026-11-08T11:50:00.000Z",
  },

  // 7. Retorno al corredor autorizado: Cliente 3 (12:30)
  {
    id: "pt-9",
    shiftId: "shift-001",
    latitude: -0.1985,
    longitude: -78.4795,
    accuracyMeters: 4.5,
    speedKmh: 0.0,
    bearingDegrees: 0,
    isMock: false,
    recordedAt: "2026-11-08T12:30:00.000Z",
  },
  // 8. Traslado hacia el norte por Av. 6 de Diciembre (14:15)
  {
    id: "pt-10",
    shiftId: "shift-001",
    latitude: -0.1895,
    longitude: -78.4796,
    accuracyMeters: 6.2,
    speedKmh: 35.0,
    bearingDegrees: 355,
    isMock: false,
    recordedAt: "2026-11-08T14:15:00.000Z",
  },
  // 9. Cliente 4: Supermercado Santa María (15:20)
  {
    id: "pt-11",
    shiftId: "shift-001",
    latitude: -0.1812,
    longitude: -78.4798,
    accuracyMeters: 4.0,
    speedKmh: 0.0,
    bearingDegrees: 0,
    isMock: false,
    recordedAt: "2026-11-08T15:20:00.000Z",
  },
  // 10. Cierre de jornada en oficinas centrales (16:45)
  {
    id: "pt-12",
    shiftId: "shift-001",
    latitude: -0.1785,
    longitude: -78.4820,
    accuracyMeters: 5.0,
    speedKmh: 0.0,
    bearingDegrees: 0,
    isMock: false,
    recordedAt: "2026-11-08T16:45:00.000Z",
  },
];

export default function RoutesHistoryPage() {
  const [selectedSellerId, setSelectedSellerId] = useState<string>("vendedor-001");
  const [selectedDate, setSelectedDate] = useState<string>("2026-11-08");
  const [showDeviations, setShowDeviations] = useState<boolean>(true);
  const [showStops, setShowStops] = useState<boolean>(true);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [activeTab, setActiveTab] = useState<"stops" | "deviations">("deviations");

  const handleMapReady = useCallback((map: L.Map) => {
    setMapInstance(map);
  }, []);

  // Puntos de ruta ordenados cronológicamente
  const points = useMemo(() => {
    return sortPointsChronologically(MOCK_ROUTE_POINTS);
  }, []);

  const stops = MOCK_ROUTE_STOPS;

  // Criterio 3: Métricas consolidadas de la jornada
  const metrics = useMemo(() => {
    return calculateRouteMetrics(points, stops, DEFAULT_DEVIATION_THRESHOLD_METERS);
  }, [points, stops]);

  // Segmentos de desviación detectados
  const deviationSegments = useMemo(() => {
    const deviated = detectDeviatedPoints(points, stops, DEFAULT_DEVIATION_THRESHOLD_METERS);
    return groupIntoDeviationSegments(deviated, points);
  }, [points, stops]);

  // Enfocar segmento de desvío en el mapa
  const handleFocusDeviation = useCallback(
    (segment: DeviationSegment) => {
      if (!mapInstance || segment.points.length === 0) return;

      import("leaflet").then((LModule) => {
        const L = LModule.default || LModule;
        const bounds = L.latLngBounds(segment.points.map((p) => [p.latitude, p.longitude]));
        mapInstance.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
      });
    },
    [mapInstance]
  );

  // Enfocar parada de cliente en el mapa
  const handleFocusStop = useCallback(
    (stop: RouteStop) => {
      if (!mapInstance) return;
      mapInstance.flyTo([stop.latitude, stop.longitude], 17, {
        animate: true,
        duration: 1.2,
      });
    },
    [mapInstance]
  );

  return (
    <div className="space-y-4">
      {/* 1. Cabecera y Filtros de Selección de Vendedor y Fecha */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
            <Route className="h-4 w-4" />
            <span>Trazabilidad Espacial y Auditoría de Rutas</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Histórico de Trayectorias y Desvíos
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Reconstrucción geodésica cronológica de jornada y análisis de desvíos en PostGIS (&gt; 300m).
          </p>
        </div>

        {/* Controles de Selección */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Selector de Vendedor */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
              <User className="h-3.5 w-3.5" />
            </div>
            <select
              value={selectedSellerId}
              onChange={(e) => setSelectedSellerId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs font-semibold text-slate-700 shadow-xs focus:border-blue-600 focus:outline-none cursor-pointer"
            >
              {AVAILABLE_SELLERS.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.name}
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Fecha */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
              <Calendar className="h-3.5 w-3.5" />
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-xs font-semibold text-slate-700 shadow-xs focus:border-blue-600 focus:outline-none cursor-pointer"
            />
          </div>

          {/* Toggle de Desvíos */}
          <button
            type="button"
            onClick={() => setShowDeviations(!showDeviations)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              showDeviations
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
            title="Alternar visibilidad de tramos desviados"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
            <span>Resaltar Desvíos</span>
          </button>
        </div>
      </div>

      {/* 2. Criterio 3: Métricas de Distancia Total, Duración y Velocidades */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Distancia Total Recorrida */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Distancia Total</span>
            <Route className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-slate-900">
              {metrics.totalDistanceKm.toFixed(2)}
            </span>
            <span className="text-xs font-medium text-slate-500">km</span>
          </div>
        </div>

        {/* Duración del Turno */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Duración Turno</span>
            <Clock className="h-3.5 w-3.5 text-slate-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-slate-900">
              {metrics.durationFormatted}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {metrics.startTimeFormatted} - {metrics.endTimeFormatted}
          </p>
        </div>

        {/* Puntos GPS Registrados */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Puntos GPS</span>
            <MapPin className="h-3.5 w-3.5 text-slate-600" />
          </div>
          <span className="text-xl font-bold font-mono text-slate-900">
            {metrics.pointCount}
          </span>
          <p className="text-[10px] text-emerald-600 mt-0.5">100% Auditados HMAC</p>
        </div>

        {/* Velocidad Promedio */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Vel. Promedio</span>
            <Gauge className="h-3.5 w-3.5 text-slate-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-slate-900">
              {metrics.averageSpeedKmh.toFixed(1)}
            </span>
            <span className="text-xs font-medium text-slate-500">km/h</span>
          </div>
        </div>

        {/* Velocidad Máxima */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Vel. Máxima</span>
            <Gauge className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-slate-900">
              {metrics.maxSpeedKmh.toFixed(1)}
            </span>
            <span className="text-xs font-medium text-slate-500">km/h</span>
          </div>
        </div>

        {/* Desvíos Detectados */}
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 shadow-xs">
          <div className="flex items-center justify-between text-red-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Desvíos (&gt;300m)</span>
            <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-red-700">
              {metrics.deviationCount}
            </span>
            <span className="text-xs font-medium text-red-600">
              ({metrics.totalDeviatedKm.toFixed(1)} km)
            </span>
          </div>
        </div>
      </div>

      {/* 3. Área Cartográfica y Desglose de Paradas / Desvíos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-320px)] min-h-[550px]">
        {/* Contenedor del Mapa Leaflet con Polilínea */}
        <div className="lg:col-span-2 relative rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs h-full min-h-[450px]">
          <MapContainerWrapper
            className="w-full h-full min-h-[inherit]"
            showControls={true}
            onMapReady={handleMapReady}
          >
            {/* Trazado de Ruta y Desvíos */}
            <RoutePolyline
              points={points}
              referenceStops={stops}
              deviationThresholdMeters={DEFAULT_DEVIATION_THRESHOLD_METERS}
              showStops={showStops}
              showDeviations={showDeviations}
              fitBoundsOnMount={true}
              onSelectDeviation={handleFocusDeviation}
            />
          </MapContainerWrapper>

          {/* Leyenda Cartográfica Flotante */}
          <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-xs rounded-lg border border-slate-200 p-2 text-[11px] shadow-sm space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-5 bg-blue-600 rounded-full" />
              <span className="text-slate-700 font-medium">Trayectoria Autorizada</span>
            </div>
            {showDeviations && (
              <div className="flex items-center gap-2">
                <span className="h-2 w-5 bg-red-600 border border-dashed border-red-800 rounded-full opacity-80" />
                <span className="text-red-700 font-medium">Desviación (&gt;300m)</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              <span className="text-slate-600">Visita Comercial</span>
            </div>
          </div>
        </div>

        {/* Panel Lateral: Desglose de Desvíos y Paradas */}
        <div className="rounded-xl border border-slate-200 bg-white flex flex-col h-full shadow-xs overflow-hidden">
          {/* Selector de Pestañas */}
          <div className="flex border-b border-slate-200 bg-slate-50 p-1 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("deviations")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "deviations"
                  ? "bg-white text-red-600 shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Desvíos ({deviationSegments.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("stops")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "stops"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Paradas ({stops.length})</span>
            </button>
          </div>

          {/* Contenido de la Pestaña Activa */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
            {activeTab === "deviations" ? (
              deviationSegments.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                  <p className="font-semibold text-slate-700">Ruta sin desviaciones anómalas</p>
                  <p className="mt-1 text-[11px]">
                    El vendedor se mantuvo dentro del umbral de 300m durante toda la jornada.
                  </p>
                </div>
              ) : (
                deviationSegments.map((segment, index) => (
                  <div
                    key={segment.id}
                    onClick={() => handleFocusDeviation(segment)}
                    className="p-3 hover:bg-red-50/50 rounded-lg transition-colors cursor-pointer mb-1 border border-transparent hover:border-red-100"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                          {index + 1}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900">
                          Desvío Crítico #{index + 1}
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono font-semibold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                        +{Math.round(segment.maxDeviationMeters)} m
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Apartado de la ruta planificada durante{" "}
                      <strong className="text-slate-700">{segment.durationMinutes} minutos</strong>.
                    </p>

                    <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400 font-mono">
                      <span>{new Date(segment.startTime).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span>{new Date(segment.endTime).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="text-blue-600 font-sans font-semibold inline-flex items-center gap-0.5 ml-auto">
                        <Eye className="h-3 w-3" /> Ver
                      </span>
                    </div>
                  </div>
                ))
              )
            ) : (
              stops.map((stop) => (
                <div
                  key={stop.id}
                  onClick={() => handleFocusStop(stop)}
                  className="p-3 hover:bg-blue-50/50 rounded-lg transition-colors cursor-pointer mb-1 border border-transparent hover:border-blue-100"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white text-[10px] font-bold">
                        {stop.plannedOrder}
                      </span>
                      <h4 className="text-xs font-semibold text-slate-900 truncate">
                        {stop.name}
                      </h4>
                    </div>
                    {stop.isVerified ? (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <CheckCircle2 className="h-3 w-3" /> Validada
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        Pendiente
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">{stop.address}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
