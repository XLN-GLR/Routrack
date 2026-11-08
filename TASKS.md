# Plan Maestro de Tareas y Desarrollo — ROUTRACK

**Proyecto:** ROUTRACK  
**Documento:** Backlog Secuencial por Rebanadas Verticales (Vertical Slices)  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Metodología:** Desarrollo guiado por IA (Vibe Coding) mediante Vertical Slices  
**Estado:** Activo  

---

## Resumen del Estado de Tareas

- **Tareas Totales:** 28
- **Tareas Completadas:** 15 (`TASK-001`, `TASK-002`, `TASK-003`, `TASK-004`, `TASK-005`, `TASK-006`, `TASK-007`, `TASK-008`, `TASK-009`, `TASK-010`, `TASK-011`, `TASK-012`, `TASK-013`, `TASK-014`, `TASK-015`)
- **Tareas En Progreso:** 0
- **Tareas Pendientes:** 13 (`TASK-016` a `TASK-028`)

---

## FASE 0: Investigación y Documentación Fundacional

### [x] TASK-001 — Crear documentación fundacional de ROUTRACK y publicarla en GitHub
- **Identificador:** `TASK-001`
- **Nombre:** Crear documentación fundacional de ROUTRACK y publicarla en GitHub
- **Descripción:** Redactar de forma exhaustiva y técnica la documentación fundacional en `docs/` (`PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, `TEST_PLAN.md`, `SECURITY.md`, `DECISIONS.md`, `MEMORY.md`), definir el plan secuencial de tareas por rebanadas verticales en `TASKS.md`, configurar las reglas operativas de Google Antigravity y generar los archivos de configuración raíz (`README.md`, `.env.example`, `.gitignore`). Publicar los cambios en la rama `main` del repositorio remoto.
- **Dependencias:** Ninguna.
- **Archivos Involucrados:**
  - `docs/PRD.md`
  - `docs/ARCHITECTURE.md`
  - `docs/DESIGN.md`
  - `docs/TEST_PLAN.md`
  - `docs/SECURITY.md`
  - `docs/DECISIONS.md`
  - `docs/MEMORY.md`
  - `TASKS.md`
  - `README.md`
  - `.env.example`
  - `.gitignore`
  - `GEMINI.md`
  - `AGENTS.md`
  - `.agent/rules/rules.md`
  - `.agents/rules/rules.md`
- **Criterios de Aceptación:**
  1. Todos los archivos requeridos existen en sus rutas exactas sin placeholders ni comentarios TODO.
  2. `docs/PRD.md` responde las 5 preguntas clave, los 4 RFs, los 3 RNFs y delimita el alcance del MVP.
  3. `docs/ARCHITECTURE.md` detalla el flujo desacoplado, esquemas PostGIS y contratos JSON de sincronización.
  4. `docs/SECURITY.md` formula matemáticamente el encadenamiento HMAC y las políticas bajo la LOPDP de Ecuador.
  5. `docs/DESIGN.md` especifica los 5 estados operativos y los 4 estados obligatorios de interfaz.
  6. Reglas del agente configuradas en el estándar nativo de Antigravity.
  7. Commit formal generado y cambios publicados exitosamente en GitHub.
- **Estado:** Completada.

---

## FASE 1: Configuración del Entorno, Monorepo y Esquema Base de Supabase con PostGIS

### [x] TASK-002 — Configuración del Entorno, Monorepo y Esquema Base de Supabase con PostGIS
- **Identificador:** `TASK-002`
- **Nombre:** Configuración del Entorno, Monorepo y Esquema Base de Supabase con PostGIS
- **Descripción:** Configurar el entorno base del proyecto ROUTRACK en la estructura monorepo acordada (`mobile-android/`, `supabase/`, `web-admin/`), migración inicial de PostGIS con tablas centrales y RLS, configuración de Next.js App Router con Tailwind CSS y estructura base de Android con Jetpack Compose y Gradle.
- **Dependencias:** `TASK-001`.
- **Archivos Involucrados:**
  - `supabase/config.toml`
  - `supabase/migrations/20260101000000_initial_schema.sql`
  - `web-admin/package.json`
  - `web-admin/tsconfig.json`
  - `web-admin/tailwind.config.ts`
  - `web-admin/src/lib/supabase/client.ts`
  - `web-admin/src/app/page.tsx`
  - `mobile-android/build.gradle.kts`
  - `mobile-android/app/build.gradle.kts`
  - `mobile-android/settings.gradle.kts`
  - `mobile-android/app/src/main/AndroidManifest.xml`
  - `mobile-android/app/src/main/java/com/empresa/routrack/`
  - `TASKS.md`
  - `docs/MEMORY.md`
- **Criterios de Aceptación:**
  1. La migración SQL de Supabase es sintácticamente válida para PostgreSQL 16+ con PostGIS y tiene RLS activo en cada tabla.
  2. El proyecto `web-admin/` compila sin errores de TypeScript (`npx tsc --noEmit` y `npm run build` exitosos) y Tailwind CSS está operativo.
  3. La estructura de carpetas coincide exactamente con lo especificado en `docs/ARCHITECTURE.md`.
  4. Android cuenta con estructura de paquetes `com.empresa.routrack` y dependencias de Compose, Room y WorkManager declaradas.
- **Estado:** Completada.

---

## FASE 2: Slice Vertical de Autenticación y Perfiles (Supabase Auth + Web Login + Android Login)

### [x] TASK-003 — Slice Vertical: Autenticación, Gestión de Sesión y Perfiles con Roles
- **Identificador:** `TASK-003`
- **Nombre:** Slice Vertical: Autenticación, Gestión de Sesión y Perfiles con Roles
- **Descripción:** Implementar el flujo de autenticación de extremo a extremo: triggers en Supabase para sincronización automática de `auth.users` hacia `public.perfiles` con claims RBAC en JWT, función RPC `get_mi_perfil()`, pantalla de login y rutas protegidas en `web-admin` con middleware, y cliente de autenticación en `mobile-android` con repositorio y ViewModel en Compose.
- **Dependencias:** `TASK-002`.
- **Archivos Involucrados:**
  - `supabase/migrations/20260101000002_auth_triggers.sql`
  - `web-admin/src/middleware.ts`
  - `web-admin/src/app/login/page.tsx`
  - `web-admin/src/app/page.tsx`
  - `web-admin/src/hooks/useAuth.ts`
  - `web-admin/src/types/auth.ts`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/network/SupabaseClientProvider.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/repository/AuthRepository.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/ui/auth/LoginViewModel.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/ui/auth/LoginScreen.kt`
  - `TASKS.md`
  - `docs/MEMORY.md`
- **Criterios de Aceptación:**
  1. Trigger `handle_new_user` sincroniza automáticamente registros en `perfiles`.
  2. Middleware bloquea acceso a usuarios sin sesión o con rol `VENDEDOR`.
  3. Panel web permite login, muestra cabecera con rol y permite cerrar sesión.
  4. Repositorio Android conecta con Supabase Auth y expone ViewModel reactivo.
  5. `tsc --noEmit` y `npm run build` pasan al 100% sin errores.
- **Estado:** Completada.

---

## FASE 3: Slice Vertical de Captura Local, Cifrado y Base Espacial

### [x] TASK-004 — Slice Vertical: Captura de Ubicación en Segundo Plano, Almacenamiento Local Cifrado y Cadena de Integridad (Android)
- **Identificador:** `TASK-004`
- **Nombre:** Slice Vertical: Captura de Ubicación en Segundo Plano, Almacenamiento Local Cifrado y Cadena de Integridad (Android)
- **Descripción:** Implementación integral del motor local de captura y persistencia segura en `mobile-android`: `KeyStoreManager` (AES-256-GCM en hardware seguro), `AuditChainManager` (HMAC-SHA256 encadenado determinista), base de datos Room cifrada (`RoutrackDatabase`), entidades (`JornadaEntity`, `UbicacionGpsEntity`, `BitacoraAuditoriaEntity`), DAOs correspondientes, `LocationForegroundService` con notificación persistente transparente y `TrackingScreen`/`TrackingViewModel` en Jetpack Compose.
- **Dependencias:** `TASK-003`.
- **Archivos Involucrados:**
  - `mobile-android/app/src/main/AndroidManifest.xml`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/crypto/KeyStoreManager.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/crypto/AuditChainManager.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/local/entity/JornadaEntity.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/local/entity/UbicacionGpsEntity.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/local/entity/BitacoraAuditoriaEntity.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/local/dao/JornadaDao.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/local/dao/UbicacionGpsDao.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/local/dao/BitacoraAuditoriaDao.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/local/RoutrackDatabase.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/service/LocationForegroundService.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/ui/tracking/TrackingViewModel.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/ui/tracking/TrackingScreen.kt`
  - `mobile-android/app/src/test/java/com/empresa/routrack/data/crypto/AuditChainManagerTest.kt`
- **Criterios de Aceptación:**
  1. `AuditChainManager` encadena correctamente los hashes; alteración de registros invalida la verificación.
  2. Room expone DAOs funcionales con `Flow` y funciones `suspend` para telemetría, turnos y auditoría.
  3. `LocationForegroundService` implementa notificación permanente visible bajo LOPDP y captura optimizada por FusedLocation.
  4. `TrackingScreen` y `TrackingViewModel` gestionan el ciclo de jornada y telemetría local de puntos almacenados.
- **Estado:** Completada.

### [x] TASK-005 — Arquitectura de Sincronización y Resiliencia Offline-First hacia Supabase (Contratos Zod, Ingesta por Lotes e Idempotencia)
- **Identificador:** `TASK-005`
- **Nombre:** Arquitectura de Sincronización y Resiliencia Offline-First hacia Supabase (Contratos Zod, Ingesta por Lotes e Idempotencia)
- **Fase:** FASE 3: Slice Vertical de Captura Local, Cifrado y Base Espacial
- **Descripción:** Definir y estructurar los contratos de datos y la arquitectura de sincronización offline-first entre `mobile-android` y Supabase: esquemas de validación estricta con Zod para telemetría de ubicaciones, visitas comerciales y bitácoras de auditoría, definición del protocolo de retransmisión por lotes (*batching*), control de idempotencia mediante identificadores UUID únicos (`client_generated_id`), políticas de resolución de conflictos (*last-write-wins* para metadatos, append-only para telemetría) y tipado TypeScript compartido para las Edge Functions y el panel web.
- **Dependencias:** `TASK-002`, `TASK-004`.
- **Archivos Involucrados:**
  - `web-admin/src/types/sync.ts`
  - `web-admin/src/lib/validation/syncSchemas.ts`
  - `web-admin/src/lib/validation/syncSchemas.test.ts`
  - `web-admin/scripts/run-sync-tests.mjs`
  - `supabase/functions/_shared/syncContracts.ts`
  - `supabase/migrations/20260101000003_idempotency_indexes.sql`
- **Criterios de Aceptación:**
  1. Esquemas Zod validan paquetes de sincronización conteniendo cabeceras de jornada, arreglos de puntos GPS y eventos de auditoría con tipos estrictos (rechazo automático de payloads con coordenadas espurias o timestamps futuros > 5 minutos).
  2. Protocolo de ingesta garantiza idempotencia estricta mediante restricciones `ON CONFLICT (id) DO NOTHING` e índices únicos en `ubicaciones_gps` y `bitacora_auditoria`.
  3. Contratos de serialización JSON coinciden exactamente entre los modelos Room de Android y los esquemas TypeScript/Deno del backend.
  4. Pruebas de validación de esquemas Zod se ejecutan sin errores con comprobaciones de TypeScript (`tsc --noEmit`).
- **Estado:** Completada.

### [x] TASK-006 — Arquitectura Base del Panel Web, Layout de Dashboard y Protección de Rutas RBAC en Next.js
- **Identificador:** `TASK-006`
- **Nombre:** Arquitectura Base del Panel Web, Layout de Dashboard y Protección de Rutas RBAC en Next.js
- **Fase:** FASE 3: Slice Vertical de Captura Local, Cifrado y Base Espacial
- **Descripción:** Desarrollar en `web-admin` la infraestructura base del dashboard administrativo: estructura de layout persistente con barra lateral de navegación (`Sidebar.tsx`), cabecera con perfil de usuario y badge de rol semántico (`Header.tsx`), middleware de protección de rutas y gestión de sesiones mediante cookies HttpOnly seguras con `@supabase/ssr`, sirviendo de contenedor común para los módulos de monitoreo en vivo, rutas, clientes, visitas y auditoría.
- **Dependencias:** `TASK-002`, `TASK-003`.
- **Archivos Involucrados:**
  - `web-admin/src/app/(dashboard)/layout.tsx`
  - `web-admin/src/app/(dashboard)/page.tsx`
  - `web-admin/src/app/(dashboard)/live/page.tsx`
  - `web-admin/src/app/(dashboard)/routes/page.tsx`
  - `web-admin/src/app/(dashboard)/clients/page.tsx`
  - `web-admin/src/app/(dashboard)/visits/page.tsx`
  - `web-admin/src/app/(dashboard)/audit/page.tsx`
  - `web-admin/src/app/(dashboard)/reports/page.tsx`
  - `web-admin/src/components/navigation/Sidebar.tsx`
  - `web-admin/src/components/navigation/Header.tsx`
  - `web-admin/src/middleware.ts`
  - `web-admin/src/hooks/useAuth.ts`
  - `web-admin/src/types/auth.ts`
- **Criterios de Aceptación:**
  1. Layout responsivo de dashboard con navegación colapsable hacia `/live`, `/routes`, `/clients`, `/visits`, `/audit` y `/reports`.
  2. Middleware intercepta peticiones no autenticadas redirigiendo a `/login` y bloquea accesos no autorizados con código HTTP 403 para usuarios con rol `VENDEDOR`.
  3. Header refleja el nombre completo del usuario autenticado, su rol semántico y botón funcional de cierre de sesión (`logout`).
  4. Despliegue sin errores de compilación (`tsc --noEmit` y `npm run build` limpios) ni desajustes de hidratación en Server Components.
- **Estado:** Completada.

### [x] TASK-007 — Procesamiento Geoespacial de Rutas, Distancias y Detección de Desvíos en PostGIS
- **Identificador:** `TASK-007`
- **Nombre:** Procesamiento Geoespacial de Rutas, Distancias y Detección de Desvíos en PostGIS
- **Fase:** FASE 3: Slice Vertical de Captura Local, Cifrado y Base Espacial
- **Descripción:** Implementar en Supabase/PostgreSQL las funciones espaciales y vistas optimizadas para el procesamiento geoespacial analítico: agregación cronológica de puntos GPS en polilíneas continuas (`ST_MakeLine`), cálculo geodésico exacto de distancias recorridas en metros/kilómetros (`ST_Length` sobre esferoide WGS84), detección de desvíos espaciales superiores al umbral de 300 metros respecto al corredor de clientes asignados en la jornada, y optimización de consultas con índices espaciales GiST y ordenamiento por timestamp.
- **Dependencias:** `TASK-002`, `TASK-005`.
- **Archivos Involucrados:**
  - `supabase/migrations/20260101000004_postgis_route_processing.sql`
  - `supabase/tests/postgis_route_processing_test.sql`
  - `web-admin/src/lib/geo/spatial.ts`
  - `web-admin/src/lib/geo/spatial.test.ts`
  - `web-admin/scripts/run-spatial-tests.mjs`
- **Criterios de Aceptación:**
  1. Función SQL `calcular_trayectoria_jornada(p_jornada_id UUID)` genera una polilínea `GEOMETRY(LineString, 4326)` válida sin auto-intersecciones degeneradas ni inversión cronológica de vértices.
  2. Función SQL `calcular_distancia_total_jornada(p_jornada_id UUID)` retorna la distancia real en kilómetros con precisión geodésica.
  3. Función SQL `detectar_desvios_jornada(p_jornada_id UUID, p_umbral_metros DOUBLE PRECISION)` identifica y retorna los puntos que exceden el radio de tolerancia (300 metros) respecto a clientes o paradas autorizadas.
  4. Las consultas sobre trayectorias de 10.000 puntos ejecutan en menos de 250 ms aprovechando índices espaciales `gist(coordenadas)`.
- **Estado:** Completada.

### [x] TASK-008 — Capa de Persistencia Local Avanzada, Repositorio Unificado y Resiliencia Offline en Android
- **Identificador:** `TASK-008`
- **Nombre:** Capa de Persistencia Local Avanzada, Repositorio Unificado y Resiliencia Offline en Android
- **Fase:** FASE 3: Slice Vertical de Captura Local, Cifrado y Base Espacial
- **Descripción:** Construir en `mobile-android` la capa de abstracción de datos y repositorios de dominio (`TrackingRepository`, `ShiftRepository` y `VisitRepository`): desacoplar el acceso directo a DAOs de Room, orquestar transacciones concurrentes entre la captura de telemetría GPS, firmas HMAC y visitas comerciales, implementar el búfer local de resiliencia ante pérdida de red y exponer flujos reactivos estructurados (`Flow` / `StateFlow`) en `Dispatchers.IO` para consumo seguro de la UI y los workers de sincronización.
- **Dependencias:** `TASK-004`, `TASK-005`.
- **Archivos Involucrados:**
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/repository/ShiftRepository.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/repository/ShiftRepositoryImpl.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/repository/TrackingRepository.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/repository/TrackingRepositoryImpl.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/repository/VisitRepository.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/repository/VisitRepositoryImpl.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/repository/RepositoryProvider.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/RoutrackRepository.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/local/RoutrackDatabase.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/local/entity/VisitaEntity.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/local/dao/VisitaDao.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/local/dao/UbicacionGpsDao.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/local/dao/JornadaDao.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/local/dao/BitacoraAuditoriaDao.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/ui/tracking/TrackingViewModel.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/service/LocationForegroundService.kt`
  - `mobile-android/app/src/test/java/com/empresa/routrack/data/repository/TrackingRepositoryTest.kt`
  - `mobile-android/app/src/test/java/com/empresa/routrack/data/repository/ShiftRepositoryTest.kt`
  - `mobile-android/scripts/validate-persistence-architecture.mjs`
- **Criterios de Aceptación:**
  1. Repositorios de datos desacoplan totalmente la lógica de Room de los ViewModels y servicios en primer plano mediante interfaces limpias.
  2. Inserciones concurrentes de coordenadas GPS y bitácora de auditoría se realizan atómicamente sin bloqueos de UI ni excepciones `SQLiteDatabaseLockedException`.
  3. Búfer de telemetría garantiza retención de al menos 10.000 puntos locales sin degradar la memoria del dispositivo.
  4. Flujos reactivos de datos emiten exclusivamente modelos inmutables bajo corrutinas controladas en `Dispatchers.IO`.
- **Estado:** Completada.

### [x] TASK-009 — Generador criptográfico de HMAC encadenado en Android
- **Identificador:** `TASK-009`
- **Nombre:** Generador criptográfico de HMAC encadenado en Android
- **Fase:** FASE 3: Slice Vertical de Captura Local, Cifrado y Base Espacial
- **Descripción:** Desarrollar el componente `HmacChainSigner.kt` en Kotlin que calcula el hash HMAC-SHA256 encadenado para cada nuevo punto o evento de jornada ($Hash_n = \text{HMAC}(Payload_n + Hash_{n-1}, K)$).
- **Dependencias:** `TASK-008`.
- **Archivos Involucrados:**
  - `mobile-android/app/src/main/java/com/routrack/mobile/security/HmacChainSigner.kt`
  - `mobile-android/app/src/test/java/com/routrack/mobile/security/HmacChainSignerTest.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/crypto/AuditChainManager.kt`
  - `mobile-android/scripts/run-hmac-tests.mjs`
- **Criterios de Aceptación:**
  1. Generación determinista y reproducible de firmas HMAC-SHA256.
  2. Pruebas unitarias demuestran que cualquier alteración en el payload invalida la cadena.
- **Estado:** Completada.

### [x] TASK-010 — Android Foreground Service de captura adaptativa con Fused Location y Activity Recognition
- **Identificador:** `TASK-010`
- **Nombre:** Android Foreground Service de captura adaptativa con Fused Location y Activity Recognition
- **Fase:** FASE 3: Slice Vertical de Captura Local, Cifrado y Base Espacial
- **Descripción:** Implementar `TrackingForegroundService.kt` con notificación permanente visible en barra de estado, integración con `FusedLocationProviderClient` y `ActivityRecognitionClient` para adaptar la frecuencia de muestreo de acuerdo con el movimiento del vendedor (reducción de consumo de batería), persistiendo los puntos con su firma HMAC en Room.
- **Dependencias:** `TASK-008`, `TASK-009`.
- **Archivos Involucrados:**
  - `mobile-android/app/src/main/java/com/routrack/mobile/services/TrackingForegroundService.kt`
  - `mobile-android/app/src/main/java/com/routrack/mobile/services/ActivityTransitionReceiver.kt`
  - `mobile-android/app/src/main/AndroidManifest.xml`
  - `mobile-android/app/src/main/java/com/empresa/routrack/service/TrackingForegroundService.kt`
  - `mobile-android/app/src/test/java/com/routrack/mobile/services/TrackingForegroundServiceTest.kt`
  - `mobile-android/scripts/validate-foreground-service.mjs`
- **Criterios de Aceptación:**
  1. Notificación persistente se muestra de inmediato al iniciar el servicio.
  2. Coordenadas persistidas en Room con metadatos completos y hash HMAC.
  3. Cese inmediato de recolección al invocar la parada del servicio.
- **Estado:** Completada.

### [x] TASK-011 — Detección de Mock Locations y anomalías de tiempo en Android
- **Identificador:** `TASK-011`
- **Nombre:** Detección de Mock Locations y anomalías de tiempo en Android
- **Fase:** FASE 3: Slice Vertical de Captura Local, Cifrado y Base Espacial
- **Descripción:** Implementar `AntiTamperingManager.kt` para detectar proveedores de ubicación simulada (`Location.isFromMockProvider` / `isMock`) y desajustes de reloj mediante comparación de `SystemClock.elapsedRealtime()` vs tiempo de red/GPS, etiquetando anomalías en los eventos del sistema.
- **Dependencias:** `TASK-010`.
- **Archivos Involucrados:**
  - `mobile-android/app/src/main/java/com/routrack/mobile/security/AntiTamperingManager.kt`
  - `mobile-android/app/src/test/java/com/routrack/mobile/security/AntiTamperingManagerTest.kt`
  - `mobile-android/app/src/main/java/com/routrack/mobile/services/TrackingForegroundService.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/service/LocationForegroundService.kt`
  - `mobile-android/scripts/run-antitampering-tests.mjs`
- **Criterios de Aceptación:**
  1. Ubicaciones inyectadas por apps de Fake GPS se marcan inequívocamente con `is_mock = true`.
  2. Desvíos de reloj > 60s generan un evento de auditoría advertencia.
- **Estado:** Completada.

---

## FASE 4: Slice Vertical de Sincronización Offline-First (WorkManager + Edge Function `sync-jornada` + Idempotencia)

### [x] TASK-012 — Supabase Edge Function `sync-jornada` con validación HMAC e idempotencia
- **Identificador:** `TASK-012`
- **Nombre:** Supabase Edge Function `sync-jornada` con validación HMAC e idempotencia
- **Fase:** FASE 4: Slice Vertical de Sincronización Offline-First
- **Descripción:** Desarrollar en Deno/TypeScript la Edge Function `sync-jornada` que recibe lotes de telemetría, visitas y eventos, valida el JWT, recalcula la cadena de hashes HMAC-SHA256 y persiste de forma idempotente (`ON CONFLICT (id) DO NOTHING`) en PostgreSQL.
- **Dependencias:** `TASK-004`, `TASK-005`, `TASK-009`.
- **Archivos Involucrados:**
  - `supabase/functions/sync-jornada/index.ts`
  - `supabase/functions/sync-jornada/schema.ts`
  - `supabase/functions/sync-jornada/verify-hmac.ts`
  - `supabase/functions/_shared/syncContracts.ts`
  - `supabase/tests/sync_jornada_edge_test.mjs`
- **Criterios de Aceptación:**
  1. Lotes válidos se insertan atómicamente retornando HTTP 200 con resumen.
  2. Lotes con firma manipulada se rechazan con HTTP 400 y se registra alerta en `audit_logs`.
  3. Retransmisiones duplicadas son ignoradas sin error.
- **Estado:** Completada.

### [x] TASK-013 — Worker de sincronización en segundo plano con WorkManager en Android
- **Identificador:** `TASK-013`
- **Nombre:** Worker de sincronización en segundo plano con WorkManager en Android
- **Descripción:** Implementar `SyncJornadaWorker.kt` que empaqueta en lotes de hasta 100 registros pendientes en Room y los transmite mediante HTTP POST seguro a la Edge Function `sync-jornada` bajo la restricción `NetworkType.CONNECTED` y con política de reintentos exponenciales.
- **Dependencias:** `TASK-010`, `TASK-012`.
- **Archivos Involucrados:**
  - `mobile-android/app/src/main/java/com/routrack/mobile/workers/SyncJornadaWorker.kt`
  - `mobile-android/app/src/main/java/com/routrack/mobile/data/repository/SyncRepository.kt`
  - `mobile-android/app/src/main/java/com/routrack/mobile/data/repository/SyncRepositoryImpl.kt`
  - `mobile-android/app/src/main/java/com/routrack/mobile/data/repository/HttpTransport.kt`
  - `mobile-android/app/src/main/java/com/routrack/mobile/workers/SyncScheduler.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/workers/SyncWorker.kt`
  - `mobile-android/app/src/main/java/com/empresa/routrack/data/repository/RepositoryProvider.kt`
  - `mobile-android/app/src/test/java/com/routrack/mobile/workers/SyncJornadaWorkerTest.kt`
  - `mobile-android/scripts/validate-sync-worker.mjs`
- **Criterios de Aceptación:**
  1. Registros en estado `PENDING` cambian a `SYNCED` tras confirmación HTTP 200.
  2. Fallos de red disparan reintento con backoff sin perder datos en local.
- **Estado:** Completada.

---

## FASE 5: Slice Vertical de Monitoreo Web y Mapas (Leaflet + Trazado de Rutas + Detección de Desvíos PostGIS)

### [x] TASK-014 — Componente base de visor de mapas interactivo con Leaflet y OpenStreetMap
- **Identificador:** `TASK-014`
- **Nombre:** Componente base de visor de mapas interactivo con Leaflet y OpenStreetMap
- **Descripción:** Desarrollar en `web-admin` el componente modular `MapView.tsx` utilizando React y Leaflet con carga dinámica (`ssr: false`), tiles de OpenStreetMap configurables vía variables de entorno (`NEXT_PUBLIC_MAP_TILE_PROVIDER_URL`) y controles de zoom y centrado.
- **Dependencias:** `TASK-006`.
- **Archivos Involucrados:**
  - `web-admin/src/components/map/MapView.tsx`
  - `web-admin/src/components/map/MapContainerWrapper.tsx`
  - `web-admin/src/app/(dashboard)/live/page.tsx`
  - `web-admin/scripts/run-map-tests.mjs`
  - `web-admin/package.json`
- **Criterios de Aceptación:**
  1. Renderizado fluido sin errores de hidratación de Next.js en servidor.
  2. Proveedor de teselas responde a `NEXT_PUBLIC_MAP_TILE_PROVIDER_URL`.
- **Estado:** Completada.

### [x] TASK-015 — Vista de monitoreo en vivo con marcadores de estados operativos
- **Identificador:** `TASK-015`
- **Nombre:** Vista de monitoreo en vivo con marcadores de estados operativos
- **Descripción:** Desarrollar la vista `/live` en `web-admin` suscrita a la última posición de vendedores activos, renderizando marcadores diferenciados con los 5 estados operativos definidos en `docs/DESIGN.md` (En Ruta, Detenido, Visita Validada, Desviación, Sin Conexión).
- **Dependencias:** `TASK-014`, `TASK-004`.
- **Archivos Involucrados:**
  - `web-admin/src/app/(dashboard)/live/page.tsx`
  - `web-admin/src/components/map/SellerMarker.tsx`
  - `web-admin/src/components/map/SellerPopup.tsx`
  - `web-admin/src/types/seller.ts`
  - `web-admin/src/components/map/MapView.tsx`
  - `web-admin/src/components/map/MapContainerWrapper.tsx`
  - `web-admin/scripts/run-live-monitoring-tests.mjs`
  - `web-admin/package.json`
- **Criterios de Aceptación:**
  1. Marcador azul en movimiento con rumbo (*bearing*), ámbar detenido y rojo en anomalía.
  2. Popup muestra datos de vendedor, velocidad, batería y última hora de reporte.
- **Estado:** Completada.

### [ ] TASK-016 — Vista de histórico de rutas, polilíneas y detección espacial de desvíos en PostGIS
- **Identificador:** `TASK-016`
- **Nombre:** Vista de histórico de rutas, polilíneas y detección espacial de desvíos en PostGIS
- **Descripción:** Implementar en `web-admin` la vista `/routes` con selector de vendedor y fecha para renderizar la polilínea completa de la jornada, calculando visualmente y mediante consulta PostGIS los segmentos con desviaciones no autorizadas superiores a 300 metros.
- **Dependencias:** `TASK-007`, `TASK-014`.
- **Archivos Involucrados:**
  - `web-admin/src/app/(dashboard)/routes/page.tsx`
  - `web-admin/src/components/map/RoutePolyline.tsx`
  - `web-admin/src/lib/geo/deviations.ts`
- **Criterios de Aceptación:**
  1. Polilínea dibuja cronológicamente el recorrido sin deformaciones espaciales.
  2. Trazos desviados se destacan en color rojo semitransparente.
  3. Muestra métricas de distancia total recorrida y duración del turno.
- **Estado:** Pendiente.

---

## FASE 6: Slice Vertical de Visitas y Acuerdos Comerciales (Registro Móvil + Geocerca + Reporte Web)

### [ ] TASK-017 — Módulo de gestión y georreferenciación de clientes en panel web
- **Identificador:** `TASK-017`
- **Nombre:** Módulo de gestión y georreferenciación de clientes en panel web
- **Descripción:** Desarrollar el CRUD de clientes comerciales en `web-admin` permitiendo registrar nombre, RUC, dirección, coordenadas exactas (mediante selector interactivo en mapa Leaflet) y radio de tolerancia en metros.
- **Dependencias:** `TASK-014`, `TASK-004`.
- **Archivos Involucrados:**
  - `web-admin/src/app/(dashboard)/clients/page.tsx`
  - `web-admin/src/components/clients/ClientModal.tsx`
  - `web-admin/src/components/clients/ClientLocationPicker.tsx`
- **Criterios de Aceptación:**
  1. Creación y edición de clientes validada con Zod.
  2. Coordenadas persistidas en columna PostGIS `GEOMETRY(Point, 4326)`.
- **Estado:** Pendiente.

### [ ] TASK-018 — Pantalla y flujo móvil de registro de visita comercial en Android
- **Identificador:** `TASK-018`
- **Nombre:** Pantalla y flujo móvil de registro de visita comercial en Android
- **Descripción:** Desarrollar en `mobile-android` la pantalla de clientes asignados y el flujo de check-in / check-out de visita con captura de coordenadas de alta precisión, campo de observaciones, precios pactados y compromisos comerciales en formato estructurado.
- **Dependencias:** `TASK-008`, `TASK-010`.
- **Archivos Involucrados:**
  - `mobile-android/app/src/main/java/com/routrack/mobile/presentation/visits/VisitCheckInScreen.kt`
  - `mobile-android/app/src/main/java/com/routrack/mobile/presentation/visits/VisitViewModel.kt`
- **Criterios de Aceptación:**
  1. Check-in captura coordenadas actuales y hora sin bloquear la UI.
  2. Formulario de compromisos comerciales y precios pactados valida montos válidos.
  3. Persistencia local inmediata en Room con estado `PENDING`.
- **Estado:** Pendiente.

### [ ] TASK-019 — Validación espacial de geocerca en Supabase (`ST_DWithin`)
- **Identificador:** `TASK-019`
- **Nombre:** Validación espacial de geocerca en Supabase (`ST_DWithin`)
- **Descripción:** Implementar la función de base de datos en PostgreSQL que al ingresar o sincronizar una visita calcula la distancia física al cliente mediante `ST_Distance` y asigna automáticamente el estado `VERIFIED` (si `ST_DWithin` es verdadero) o `OUT_OF_RANGE`.
- **Dependencias:** `TASK-004`, `TASK-012`.
- **Archivos Involucrados:**
  - `supabase/migrations/20261106000005_visit_validation_function.sql`
- **Criterios de Aceptación:**
  1. Visitas a distancia $\le$ tolerancia se marcan `VERIFIED`.
  2. Visitas a distancia $>$ tolerancia se marcan `OUT_OF_RANGE` con la distancia exacta en metros.
- **Estado:** Pendiente.

### [ ] TASK-020 — Panel web de supervisión y auditoría de visitas comerciales
- **Identificador:** `TASK-020`
- **Nombre:** Panel web de supervisión y auditoría de visitas comerciales
- **Descripción:** Implementar en `web-admin` la vista `/visits` que lista todas las visitas del día con badges semánticos (`VERIFIED` en verde vs `OUT_OF_RANGE` en rojo/ámbar), distancia al local, observaciones y acuerdos pactados.
- **Dependencias:** `TASK-019`, `TASK-006`.
- **Archivos Involucrados:**
  - `web-admin/src/app/(dashboard)/visits/page.tsx`
  - `web-admin/src/components/visits/VisitTable.tsx`
  - `web-admin/src/components/visits/VisitDetailModal.tsx`
- **Criterios de Aceptación:**
  1. Despliegue de los 4 estados obligatorios de interfaz (Cargando con skeleton, Error con reintento, Vacío, Adaptativo).
  2. Clic en visita resalta el cliente y el punto del vendedor en mapa.
- **Estado:** Pendiente.

---

## FASE 7: Slice Vertical de Auditoría, Métricas e Inmutabilidad (Verificación HMAC + Recharts + Exportación)

### [ ] TASK-021 — Módulo web de bitácora inmutable de eventos del sistema
- **Identificador:** `TASK-021`
- **Nombre:** Módulo web de bitácora inmutable de eventos del sistema
- **Descripción:** Desarrollar en `web-admin` la vista `/audit` para inspeccionar la tabla `audit_logs` (eventos de GPS apagado, pérdida de señal, inicios de turno y anomalías de reloj), con visualización del hash HMAC y validador de cadena criptográfica.
- **Dependencias:** `TASK-004`, `TASK-006`.
- **Archivos Involucrados:**
  - `web-admin/src/app/(dashboard)/audit/page.tsx`
  - `web-admin/src/components/audit/AuditLogTable.tsx`
- **Criterios de Aceptación:**
  1. Tabla de eventos con severidad semántica (INFO, WARNING, CRITICAL).
  2. Indicador visual del estado de integridad de la cadena criptográfica.
- **Estado:** Pendiente.

### [ ] TASK-022 — Dashboard de métricas operativas y gráficos con Recharts
- **Identificador:** `TASK-022`
- **Nombre:** Dashboard de métricas operativas y gráficos con Recharts
- **Descripción:** Implementar las tarjetas de métricas (KPIs) y gráficos de resumen diario en `web-admin` utilizando Recharts (cobertura de clientes visitados, kilómetros totales recorridos por vendedor y tasa de visitas verificadas).
- **Dependencias:** `TASK-006`, `TASK-019`.
- **Archivos Involucrados:**
  - `web-admin/src/app/(dashboard)/page.tsx`
  - `web-admin/src/components/dashboard/MetricCards.tsx`
  - `web-admin/src/components/dashboard/PerformanceChart.tsx`
- **Criterios de Aceptación:**
  1. Visualización de métricas en tiempo real con estados de skeleton loader.
  2. Totalizaciones coincidentes con los registros de base de datos.
- **Estado:** Pendiente.

### [ ] TASK-023 — Exportación formal de reportes de jornada a formato CSV
- **Identificador:** `TASK-023`
- **Nombre:** Exportación formal de reportes de jornada a formato CSV
- **Descripción:** Implementar la utilidad de exportación en `web-admin` que genera archivos `.csv` estructurados con codificación UTF-8 con BOM para apertura correcta en Microsoft Excel, conteniendo fecha, vendedor, inicio, fin, kilómetros y desglose de visitas.
- **Dependencias:** `TASK-006`, `TASK-020`.
- **Archivos Involucrados:**
  - `web-admin/src/lib/export/exportCsv.ts`
  - `web-admin/src/app/(dashboard)/reports/page.tsx`
- **Criterios de Aceptación:**
  1. Descarga automática con nombre normalizado (`reporte-jornadas-YYYY-MM-DD.csv`).
  2. Correcta visualización de tildes y caracteres especiales en Excel.
- **Estado:** Pendiente.

---

## FASE 8: Pruebas E2E (Playwright), Auditoría de Seguridad y Despliegue en Producción

### [ ] TASK-024 — Suite de pruebas End-to-End con Playwright en panel web
- **Identificador:** `TASK-024`
- **Nombre:** Suite de pruebas End-to-End con Playwright en panel web
- **Descripción:** Implementar y ejecutar las pruebas E2E automatizadas con Playwright en `web-admin` para los 5 flujos críticos del sistema (login, mapa interactivo, detalle de trayectorias, creación de clientes y exportación).
- **Dependencias:** `TASK-006`, `TASK-015`, `TASK-016`, `TASK-017`, `TASK-023`.
- **Archivos Involucrados:**
  - `web-admin/e2e/auth.spec.ts`
  - `web-admin/e2e/live-map.spec.ts`
  - `web-admin/e2e/reports.spec.ts`
  - `web-admin/playwright.config.ts`
- **Criterios de Aceptación:**
  1. 100% de tests E2E aprobados en navegadores Chromium y Firefox en modo headless.
  2. Cero fallos intermitentes (*flaky tests*).
- **Estado:** Pendiente.

### [ ] TASK-025 — Pruebas de integración Android: Simulación de Modo Avión y estrés de memoria
- **Identificador:** `TASK-025`
- **Nombre:** Pruebas de integración Android: Simulación de Modo Avión y estrés de memoria
- **Descripción:** Ejecutar pruebas de integración automatizadas en `mobile-android` simulando pérdida prolongada de red (modo avión), reinicio de aplicación y verificación de ingesta íntegra sin duplicaciones en Supabase.
- **Dependencias:** `TASK-010`, `TASK-013`.
- **Archivos Involucrados:**
  - `mobile-android/app/src/androidTest/java/com/routrack/mobile/OfflineSyncIntegrationTest.kt`
- **Criterios de Aceptación:**
  1. Cero pérdida de puntos de telemetría tras desconexión forzada.
  2. Sincronización automática completa al restaurar la conectividad.
- **Estado:** Pendiente.

### [ ] TASK-026 — Auditoría de seguridad estricta, verificación RLS y cumplimiento LOPDP
- **Identificador:** `TASK-026`
- **Nombre:** Auditoría de seguridad estricta, verificación RLS y cumplimiento LOPDP
- **Descripción:** Realizar escaneo de secretos y credenciales en el código fuente, pruebas de penetración lógica contra políticas RLS para certificar la imposibilidad de fuga multi-tenant y validación empírica del cese de recolección GPS al cerrar jornada.
- **Dependencias:** Todas las tareas previas.
- **Archivos Involucrados:** Toda la base de código y base de datos.
- **Criterios de Aceptación:**
  1. Comprobación matemática de cero fugas entre organizaciones distintas.
  2. Cero exposición de claves secretas (`service_role_key`).
  3. Cese inmediato y total de telemetría fuera de la jornada laboral formal.
- **Estado:** Pendiente.

### [ ] TASK-027 — Configuración de CI/CD en GitHub Actions
- **Identificador:** `TASK-027`
- **Nombre:** Configuración de CI/CD en GitHub Actions
- **Descripción:** Configurar los flujos de GitHub Actions para ejecución automática de comprobaciones de TypeScript (`tsc --noEmit`), linters, pruebas unitarias de Kotlin y tests de Playwright en cada Pull Request a `main`.
- **Dependencias:** `TASK-024`, `TASK-025`.
- **Archivos Involucrados:**
  - `.github/workflows/ci.yml`
- **Criterios de Aceptación:**
  1. Pipeline de CI verde en GitHub Actions tras pull requests.
- **Estado:** Pendiente.

### [ ] TASK-028 — Despliegue de producción del panel web en Vercel a coste $0 USD
- **Identificador:** `TASK-028`
- **Nombre:** Despliegue de producción del panel web en Vercel a coste $0 USD
- **Descripción:** Vincular el repositorio con Vercel, configurar las variables de entorno de producción seguras y verificar el correcto funcionamiento del panel web en dominio de producción con HTTPS y certificados SSL automáticos.
- **Dependencias:** `TASK-026`, `TASK-027`.
- **Archivos Involucrados:**
  - Configuración de proyecto en Vercel
  - `web-admin/next.config.mjs`
- **Criterios de Aceptación:**
  1. Despliegue activo y accesible públicamente con HTTPS y carga < 2.0s.
  2. Conexión segura contra proyecto Supabase en producción.
- **Estado:** Pendiente.
