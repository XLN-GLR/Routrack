# Memoria Viva del Proyecto — ROUTRACK

**Última Actualización:** 7 de Noviembre de 2026  
**Documento:** Estado Vivo y Registro Dinámico de Contexto (Project Memory)  
**Versión:** 1.1.0  
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

- **Fase Activa:** **Fase 3 — Slice Vertical de Captura Local, Cifrado y Base Espacial.**
- **Progreso de Fase:** Culminación y validación exitosa de `TASK-001`, `TASK-002`, `TASK-003`, `TASK-004` y `TASK-005` (5 tareas completadas de 28 proyectadas). Se completó la definición de los contratos de sincronización offline-first con esquemas estrictos Zod, tipos TypeScript, contratos compartidos para Edge Functions y migración SQL de índices de idempotencia y control de lotes (`sync_batches`). Preparado para abordar la siguiente tarea: `TASK-006`.

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
- **[x] TASK-003 — Slice Vertical: Autenticación, Gestión de Sesión y Perfiles con Roles:**
  - Migración SQL `supabase/migrations/20260101000002_auth_triggers.sql`: Trigger `handle_new_user` sincronizando `auth.users` hacia `public.perfiles`, RPC `get_mi_perfil()` y políticas RLS por rol y organización.
  - Panel Web `web-admin`: Formulario de login en `src/app/login/page.tsx` con estados de carga y error, middleware `src/middleware.ts` para bloqueo de usuarios no autorizados o vendedores, hook `useAuth.ts` con prevención de hidratación, y dashboard protegido en `src/app/page.tsx` con cabecera de usuario, badge de rol y botón de logout.
  - Cliente Android `mobile-android`: Proveedor Singleton `SupabaseClientProvider`, repositorio `AuthRepositoryImpl` con GoTrue y Postgrest, `LoginViewModel` con StateFlow reactivo y `LoginScreen` en Compose con Material 3.
- **[x] TASK-004 — Slice Vertical: Captura de Ubicación en Segundo Plano, Almacenamiento Local Cifrado y Cadena de Integridad (Android):**
  - Criptografía Segura (`KeyStoreManager.kt`): Generación y custodia de clave simétrica AES-256-GCM en hardware Android Keystore (TEE/StrongBox) y derivación de passphrase para SQLCipher.
  - Cadena de Auditoría (`AuditChainManager.kt`): Algoritmo HMAC-SHA256 encadenado determinista ($Hash_n = \text{HMAC}(Payload_n \parallel Hash_{n-1}, K)$) con detección de adulteraciones y validación matemática unitaria.
  - Persistencia Local (`RoutrackDatabase.kt`): Base de datos Room cifrada en reposo con SQLCipher, entidades `JornadaEntity`, `UbicacionGpsEntity`, `BitacoraAuditoriaEntity` y DAOs reactivos con `Flow` y funciones `suspend`.
  - Servicio Foreground (`LocationForegroundService.kt`): Notificación permanente obligatoria transparente en barra de estado ("ROUTRACK: Seguimiento de jornada activo" bajo LOPDP), captura adaptativa con FusedLocationProvider y persistencia asíncrona con encadenamiento criptográfico.
  - Interfaz de Turno en Compose (`TrackingScreen.kt`, `TrackingViewModel.kt`): Gestión de inicio/fin de jornada, tarjetas de estado y telemetría en tiempo real, conteo local y solicitud reactiva de permisos.
- **[x] TASK-005 — Arquitectura de Sincronización y Resiliencia Offline-First hacia Supabase (Contratos Zod, Ingesta por Lotes e Idempotencia):**
  - Tipos TypeScript Estrictos (`web-admin/src/types/sync.ts`): Modelado de `SyncBatchPayload`, `SyncTrackingPoint`, `SyncVisitRecord`, `SyncSystemEvent`, `SyncBatchResponse`, `SyncBatchErrorResponse`, enums semánticos y estados de geocerca.
  - Validación Doble Capa con Zod (`web-admin/src/lib/validation/syncSchemas.ts`): Esquemas estrictos con validación de UUIDs RFC 4122, rangos de coordenadas WGS84, precisión, nivel de batería, hashes HMAC-SHA256 de 64 caracteres hex y rechazo de timestamps futuros mayores a 5 minutos (`MAX_CLOCK_SKEW_MS`).
  - Suite de Pruebas Unitarias (`web-admin/src/lib/validation/syncSchemas.test.ts`, `web-admin/scripts/run-sync-tests.mjs`): 8 casos de prueba cuantitativos ejecutados exitosamente al 100% mediante `npm test` y compilación limpia con `tsc --noEmit` y `next build`.
  - Contratos Compartidos Serverless (`supabase/functions/_shared/syncContracts.ts`): Definición de tipos y validadores portables para Edge Functions en runtime Deno.
  - Migración SQL de Idempotencia (`supabase/migrations/20260101000003_idempotency_indexes.sql`): Tabla `sync_batches` con RLS por organización y rol, columna `client_id` e índice único en `bitacora_auditoria (organizacion_id, hmac_hash)`, índices únicos de idempotencia en `ubicaciones_gps` y `actividades_comerciales`, y función RPC `verificar_lote_sincronizado`.

### 4.2. Tareas Pendientes Inmediatas
- **[ ] TASK-006 (Fase 3):** Arquitectura Base del Panel Web, Layout de Dashboard y Protección de Rutas RBAC en Next.js. Depende de `TASK-002`, `TASK-003`.
- **[ ] TASK-007 (Fase 3):** Procesamiento Geoespacial de Rutas, Distancias y Detección de Desvíos en PostGIS (`ST_MakeLine`, `ST_Length`, corredor de desvío > 300m). Depende de `TASK-002`, `TASK-005`.
- **[ ] TASK-008 (Fase 3):** Capa de Persistencia Local Avanzada, Repositorio Unificado y Resiliencia Offline en Android (`TrackingRepository`, `ShiftRepository`, `VisitRepository`, búfer 10k puntos). Depende de `TASK-004`, `TASK-005`.

---

## 5. Problemas Conocidos y Bloqueos

- *Ninguno identificado.* Los contratos de sincronización, esquemas Zod, tipos TypeScript y migraciones de idempotencia compilan sin errores y están certificados empíricamente.

---

## 6. Siguiente Paso Obligatorio

- Proceder con **TASK-006**: Desarrollar la arquitectura base del dashboard administrativo en `web-admin`, implementando el layout responsivo (`layout.tsx`), barra lateral (`Sidebar.tsx`), cabecera (`Header.tsx`) y middleware RBAC con `@supabase/ssr`.
