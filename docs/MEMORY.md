# Memoria Viva del Proyecto — ROUTRACK

**Última Actualización:** 6 de Noviembre de 2026  
**Documento:** Estado Vivo y Registro Dinámico de Contexto (Project Memory)  
**Versión:** 1.0.0  
**Autor:** Senior Software Engineer, Cloud/Mobile Solutions Architect & Technical Lead  

---

## 1. Identificación del Proyecto

- **Nombre:** ROUTRACK
- **Descripción:** Plataforma B2B empresarial de rastreo geográfico, supervisión operativa y auditoría inmutable para equipos comerciales y de preventa en ruta.
- **Objetivo Principal:** Otorgar visibilidad operativa fehaciente en tiempo real a supervisores de campo, validar matemáticamente visitas en puntos de venta mediante geocercas PostGIS, operar de forma autónoma bajo arquitectura *Offline-First* y respetar rigurosamente la privacidad laboral del trabajador y la Ley Orgánica de Protección de Datos Personales (LOPDP) de Ecuador.

---

## 2. Stack Tecnológico Oficial Acordado

- **Entorno de Desarrollo:** Google Antigravity.
- **Control de Versiones y Repositorio:** Git + GitHub (`XLN-GLR/Routrack`, rama principal `main`).
- **Aplicación Móvil (Campo):** Android nativo en Kotlin + Jetpack Compose (Material 3).
- **Persistencia Local Móvil:** Room Database + SQLCipher (SQLite cifrado en reposo).
- **Criptografía en Dispositivo:** Android Keystore System (clave maestra AES-256-GCM para SQLCipher y firmado HMAC).
- **Telemetría y Ubicación:** Fused Location Provider Client + Activity Recognition Client + Android Foreground Service con notificación persistente.
- **Sincronización en Segundo Plano:** Android WorkManager (encolado de lotes, reintentos con backoff exponencial e idempotencia).
- **Panel Web Administrativo:** Next.js (App Router) + React + TypeScript estricto (`strict: true`).
- **Estilos Web:** Tailwind CSS.
- **Visualización Cartográfica:** Leaflet + React-Leaflet con teselas de OpenStreetMap (sin APIs comerciales de pago).
- **Backend y Base de Datos:** Supabase unificado (PostgreSQL 15+ con extensión espacial PostGIS 3.3+).
- **Seguridad en Servidor:** Row Level Security (RLS) en el 100% de tablas públicas con aislamiento por `organization_id`.
- **Lógica de Ingesta Serverless:** Supabase Edge Functions (`sync-jornada` en Deno/TypeScript).
- **Almacenamiento de Archivos:** Supabase Storage (evidencias fotográficas en buckets privados).
- **Estrategia de Pruebas:** Pirámide de pruebas: Unitarias (JUnit 5, MockK, Vitest), Integración (Supabase CLI, PostGIS queries, pgTAP), E2E (Playwright en navegadores reales).
- **Despliegue Web:** Vercel / Cloudflare Pages (Free Tier a costo $0 USD).

> **Regla de Arquitectura Inmutable:** No se implementará un backend independiente en FastAPI ni Express; Supabase actúa como el backend unificado inicial (ADR-001).

---

## 3. Fase Actual del Proyecto

- **Fase Activa:** **Fase 1 — Configuración del Entorno, Monorepo y Esquema Base de Supabase con PostGIS (Completada).**
- **Progreso de Fase:** Culminación y validación exitosa de `TASK-001` y `TASK-002`. Preparado para iniciar Fase 2 (`TASK-003`).

---

## 4. Registro de Tareas

### 4.1. Tareas Completadas
- **[x] TASK-001 — Crear documentación fundacional de ROUTRACK y publicarla en GitHub:**
  - Redacción exhaustiva y sin placeholders de la documentación técnica en `docs/`: `PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, `TEST_PLAN.md`, `SECURITY.md`, `DECISIONS.md`, `MEMORY.md`.
  - Elaboración del plan secuencial por rebanadas verticales en `TASKS.md` (Fases 0 a 8).
  - Configuración nativa de reglas del agente para Google Antigravity (`GEMINI.md`, `AGENTS.md`, `.agent/rules/rules.md`, `.agents/rules/rules.md`).
  - Creación de archivos raíz de configuración: `README.md`, `.env.example`, `.gitignore`.
  - Publicación en el repositorio remoto GitHub en la rama `main`.
- **[x] TASK-002 — Configuración del Entorno, Monorepo y Esquema Base de Supabase con PostGIS:**
  - Inicialización del backend Supabase con `supabase/config.toml`.
  - Creación de la migración SQL `supabase/migrations/20260101000000_initial_schema.sql` con extensión PostGIS, tablas (`organizaciones`, `perfiles`, `clientes`, `jornadas_laborales`, `ubicaciones_gps`, `actividades_comerciales`, `bitacora_auditoria`), tipos `GEOMETRY(Point, 4326)`, índices GiST, vistas de compatibilidad y políticas RLS estrictas.
  - Configuración del panel web `web-admin` con Next.js 14 (App Router), TypeScript estricto, Tailwind CSS, clientes Supabase y página de inicio operativa. Verificación exitosa con `tsc --noEmit` y `npm run build`.
  - Estructuración de `mobile-android` con árbol de paquetes `com.empresa.routrack`, `AndroidManifest.xml` y dependencias de Gradle (Compose, Room, WorkManager, Play Services Location y Supabase).

### 4.2. Tareas Pendientes Inmediatas
- **[ ] TASK-003 (Fase 2):** Slice Vertical de Autenticación y Perfiles (Supabase Auth + Web Login + Android Login).

---

## 5. Problemas Conocidos y Bloqueos

- *Ninguno identificado en esta etapa.* La estructura de monorepo compila limpiamente, las tablas espaciales y políticas RLS están declaradas y verificadas.

---

## 6. Siguiente Paso Obligatorio

- Proceder con la **Fase 2 / TASK-003**: Implementación de la primera rebanada vertical completa de Autenticación y Perfiles (Triggers de Supabase Auth, login web con SSR y login móvil en Compose con Keystore).
