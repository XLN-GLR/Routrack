"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  LayoutDashboard,
  Radio,
  Route,
  MapPin,
  CheckCircle2,
  ShieldAlert,
  FileText,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
}

const navItems: NavItem[] = [
  {
    name: "Panel General",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Monitoreo en Vivo",
    href: "/live",
    icon: Radio,
    badge: "EN VIVO",
    badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  },
  {
    name: "Histórico de Rutas",
    href: "/routes",
    icon: Route,
  },
  {
    name: "Clientes y Geocercas",
    href: "/clients",
    icon: MapPin,
  },
  {
    name: "Visitas Comerciales",
    href: "/visits",
    icon: CheckCircle2,
  },
  {
    name: "Bitácora de Auditoría",
    href: "/audit",
    icon: ShieldAlert,
  },
  {
    name: "Reportes de Jornada",
    href: "/reports",
    icon: FileText,
  },
];

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Overlay para móvil */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Contenedor del Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r border-slate-800 bg-slate-900 text-slate-100 transition-all duration-300 ease-in-out ${
          /* Móvil */
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 ${
          /* Escritorio Colapsable */
          isCollapsed ? "lg:w-20" : "lg:w-64"
        } w-64`}
      >
        {/* Cabecera del Sidebar */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
          <Link
            href="/"
            className="flex items-center gap-3 overflow-hidden"
            onClick={onCloseMobile}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-900/30">
              <Compass className="h-6 w-6" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-white">
                  ROUT<span className="text-blue-500">RACK</span>
                </span>
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  Supervisión de Ruta
                </span>
              </div>
            )}
          </Link>

          {/* Botón cerrar en móvil */}
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            onClick={onCloseMobile}
            aria-label="Cerrar menú de navegación"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Botón colapsar en escritorio */}
          <button
            type="button"
            className="hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:flex"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Lista de Navegación */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                title={isCollapsed ? item.name : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-semibold"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                } ${isCollapsed ? "justify-center" : ""}`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 transition-transform duration-150 ${
                    isActive
                      ? "text-white"
                      : "text-slate-400 group-hover:scale-105 group-hover:text-slate-200"
                  }`}
                />

                {!isCollapsed && (
                  <span className="truncate flex-1">{item.name}</span>
                )}

                {!isCollapsed && item.badge && (
                  <span
                    className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      item.badgeColor || "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Pie de Sidebar */}
        <div className="border-t border-slate-800 p-3">
          {!isCollapsed ? (
            <div className="rounded-xl bg-slate-950/50 p-3 border border-slate-800/80">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Infraestructura</span>
                <span className="font-semibold text-emerald-400">0 USD / mes</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Supabase + PostGIS</span>
                <span>v1.0.0</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-2" title="ROUTRACK v1.0.0 (Costo $0 USD)">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
