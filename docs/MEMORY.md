# Memoria Viva del Proyecto — ROUTRACK

**Última Actualización:** 6 de Noviembre de 2026  
**Documento:** Estado Vivo del Sistema (Project Memory)  
**Versión:** 1.0.0  

---

## 1. Identificación del Proyecto

- **Nombre:** ROUTRACK
- **Descripción:** Plataforma integral B2B de seguimiento GPS, supervisión operativa y auditoría de vendedores y personal comercial en rutas de campo (preventa y autoventa).
- **Objetivo Principal:** Proveer visibilidad en tiempo real de la fuerza de ventas en ruta, verificar fehacientemente la ejecución de visitas en puntos de venta mediante geocercas PostGIS, operar de forma resiliente bajo arquitectura *offline-first* y respetar rigurosamente la privacidad del trabajador y la normativa ecuatoriana (LOPDP).

---

## 2. Stack Tecnológico Acordado

- **Entorno de Desarrollo:** Google Antigravity.
- **Control de Versiones y Repositorio:** Git + GitHub (`XLN-GLR/Routrack`, rama principal `main`).
- **Aplicación Móvil (Campo):** Android nativo con Kotlin y Jetpack Compose.
- **Persistencia Local Móvil:** Room Database (SQLite).
- **Tareas de Sincronización Móvil:** Android WorkManager (política de backoff exponencial).
- **Servicios de Ubicación Móvil:** Google Play Services Fused Location Provider.
- **Servicio de Ejecución Móvil:** Android Foreground Service con notificación permanente en barra de estado.
- **Seguridad en Dispositivo Móvil:** Android Keystore System con cifrado AES-256-GCM.
- **Panel Web (Supervisión):** Next.js (App Router) + TypeScript en modo estricto (`strict: true`).
- **Estilos Web:** Tailwind CSS.
- **Visualización Cartográfica:** Leaflet + React-Leaflet con proveedor de tiles configurable (OpenStreetMap / CartoDB / Mapbox).
- **Backend y Base de Datos:** Supabase unificado (PostgreSQL 15+ con extensión PostGIS 3.3+).
- **Autenticación y Autorización:** Supabase Auth con JWTs firmados y control de roles (RBAC).
- **Seguridad de Datos en Servidor:** Row Level Security (RLS) en el 100% de tablas públicas.
- **Lógica de Servidor Específica:** Supabase Edge Functions (Deno / TypeScript).
- **Almacenamiento de Archivos:** Supabase Storage (evidencias fotográficas de visitas).
- **Pruebas Automatizadas:** Playwright (E2E Web), JUnit 5 + MockK + Compose UI Tests (Android), pgTAP / scripts SQL (RLS).
- **Despliegue Web:** Vercel.

---

## 3. Arquitectura Acordada

- Arquitectura modular desacoplada con cliente móvil *Offline-First* (Clean Architecture + MVVM), backend serverless sobre Supabase BaaS y panel web en Next.js con Server Components.
- Aislamiento multi-tenant estricto por organización (`organization_id`) a nivel de motor SQL mediante RLS.
- Ingesta de telemetría optimizada por lotes (batching de 50 a 100 puntos) para preservar batería y datos celulares.
- No se incorpora backend independiente en FastAPI ni Express; Supabase es el backend unificado inicial (ADR-001).

---

## 4. Estado de Fases y Progreso

- **Fase Actual:** Fase 0 — Investigación y Documentación Fundacional.

### Tareas Completadas:
- **TASK-001 (Fase 0):** Creación y estructuración de la documentación fundacional completa de ROUTRACK (PRD, Arquitectura, Diseño, Plan de Pruebas, Seguridad, ADRs, Memoria, Plan de Tareas, Reglas de Antigravity, README, .env.example y .gitignore) y publicación en el repositorio GitHub.

### Tareas Pendientes:
- **Fase 1: Configuración del Proyecto** (TASK-002 a TASK-005).
- **Fase 2: Autenticación y Usuarios** (TASK-006 a TASK-008).
- **Fase 3: Gestión de Vendedores y Clientes** (TASK-009 a TASK-011).
- **Fase 4: Jornadas y Ubicación en Android** (TASK-012 a TASK-016).
- **Fase 5: Rutas y Mapas en Panel Web** (TASK-017 a TASK-019).
- **Fase 6: Visitas Comerciales** (TASK-020 a TASK-023).
- **Fase 7: Auditoría y Reportes** (TASK-024 a TASK-026).
- **Fase 8: Pruebas Finales y Producción** (TASK-027 a TASK-030).

---

## 5. Decisiones Arquitectónicas Registradas (ADRs)

- **ADR-001:** Supabase como backend inicial unificado (evita backend adicional en FastAPI/Express).
- **ADR-002:** Next.js + TypeScript estricto para el panel web de supervisión.
- **ADR-003:** Kotlin + Jetpack Compose para la aplicación móvil Android nativa.
- **ADR-004:** PostgreSQL + PostGIS para datos geográficos y geocercas.
- **ADR-005:** Row Level Security (RLS) para el aislamiento estricto multi-tenant.
- **ADR-006:** Vercel para el despliegue del panel web.
- **ADR-007:** GitHub como repositorio central de control de versiones.
- **ADR-008:** Desarrollo incremental mediante vertical slices de funcionalidad.

---

## 6. Problemas Conocidos y Bloqueos

- *Ninguno identificado en esta etapa.* La arquitectura y la documentación se encuentran alineadas y validadas sin contradicciones.

---

## 7. Siguiente Paso Recomendado

- **TASK-002:** Inicialización de la estructura de directorios y proyecto base (configuración de carpetas `apps/web`, `apps/android` y `supabase`, herramientas de control y linters).
