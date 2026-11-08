"use client";

import React from "react";
import { Menu, LogOut, Shield, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface HeaderProps {
  onOpenMobile: () => void;
}

export function Header({ onOpenMobile }: HeaderProps) {
  const { user, isLoading, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 lg:px-6 backdrop-blur-sm shadow-xs">
      {/* Lado Izquierdo: Botón Menú Móvil y Estado Operativo */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobile}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Abrir menú de navegación"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Indicador de Estado del Sistema */}
        <div className="hidden sm:flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 border border-emerald-200 text-xs font-semibold text-emerald-800">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>Telemetría en Vivo Conectada</span>
        </div>
      </div>

      {/* Lado Derecho: Perfil de Usuario y Logout */}
      <div className="flex items-center gap-3 lg:gap-4">
        {isLoading ? (
          <div className="flex items-center gap-3 animate-pulse">
            <div className="h-8 w-24 rounded-lg bg-slate-200" />
            <div className="h-8 w-8 rounded-full bg-slate-200" />
          </div>
        ) : user ? (
          <div className="flex items-center gap-3">
            {/* Información del Perfil */}
            <div className="flex flex-col text-right">
              <span className="text-sm font-semibold text-slate-900 leading-tight">
                {user.full_name}
              </span>
              <span className="text-[11px] text-slate-500 leading-tight">
                {user.email}
              </span>
            </div>

            {/* Badge de Rol Semántico */}
            <span
              className={`hidden sm:inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                user.role === "ADMIN"
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}
            >
              <Shield className="h-3 w-3" />
              {user.role}
            </span>

            {/* Avatar */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              <User className="h-4 w-4" />
            </div>

            {/* Separador */}
            <div className="h-6 w-px bg-slate-200" />

            {/* Botón de Cierre de Sesión */}
            <button
              type="button"
              onClick={signOut}
              title="Cerrar sesión segura"
              className="group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-700 border border-transparent hover:border-red-200 transition-all duration-150"
            >
              <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              <span className="hidden md:inline">Cerrar Sesión</span>
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
