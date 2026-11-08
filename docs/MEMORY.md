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

- **Fase Activa:** **FASE 6 — Slice Vertical de Visitas y Acuerdos Comerciales (Por Iniciar).**
- **Progreso de Fase:** 0 de 3 tareas completadas en la Fase 6 (16 de 28 tareas completadas en el proyecto). La Fase 5 ha concluido exitosamente al 100% (3 de 3 tareas completadas: `TASK-014`, `TASK-015` y `TASK-016`). Se desarrolló el visor de histórico de rutas `/routes` con polilínea cronológica continua, cálculo geodésico de distancias y velocidades, detección espacial de segmentos de desvío (> 300m de paradas autorizadas) resaltados en rojo semitransparente con popups de exceso de distancia y duración, geocercas circulares de clientes y tarjetas KPI de la jornada, con 16/16 pruebas unitarias aprobadas (63/63 pruebas totales en `web-admin`). Preparado para continuar con `TASK-017`.

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
- **[x] TASK-006 — Arquitectura Base del Panel Web, Layout de Dashboard y Protección de Rutas RBAC en Next.js:**
  - Layout Unificado y Responsivo (`web-admin/src/app/(dashboard)/layout.tsx`): Estructura adaptativa de escritorio y móvil con barra lateral colapsable (`Sidebar.tsx`) y cabecera persistente (`Header.tsx`).
  - Protección de Rutas con Middleware (`web-admin/src/middleware.ts`): Intercepción de accesos no autenticados hacia `/login` y bloqueo estricto de usuarios con rol `VENDEDOR` redirigiendo con parámetro de error.
  - Hook de Sesión en Cliente (`web-admin/src/hooks/useAuth.ts`, `web-admin/src/types/auth.ts`): Estado reactivo de usuario, badge de rol (`ADMIN`, `SUPERVISOR`), prevención de hydration mismatch y cierre de sesión seguro.
  - Vistas Base de Navegación: Creación y enlazado de módulos operativos para `/` (dashboard), `/live` (monitoreo en vivo), `/routes` (histórico de trayectorias), `/clients` (clientes y geocercas), `/visits` (visitas comerciales), `/audit` (bitácora inmutable) y `/reports` (reportes de jornada), compilando 11/11 rutas estáticas en `next build`.
- **[x] TASK-007 — Procesamiento Geoespacial de Rutas, Distancias y Detección de Desvíos en PostGIS:**
  - Funciones Espaciales PostGIS (`supabase/migrations/20260101000004_postgis_route_processing.sql`): `calcular_trayectoria_jornada` (polilínea agregada `LineString` WGS84 ordenada cronológicamente), `calcular_distancia_total_jornada` (cálculo geodésico exacto sobre esferoide casteando a `geography`), `detectar_desvios_jornada` (identificación de puntos que exceden umbral de 300m respecto al corredor de clientes) y `obtener_resumen_espacial_jornada` con salida GeoJSON y métricas de velocidad.
  - Suite de Pruebas Unitarias SQL (`supabase/tests/postgis_route_processing_test.sql`): Escenario transaccional con datos simulados en Quito (Plaza Foch / El Ejido), inyección de desvío anómalo y validación del 100% de aserciones espaciales.
  - Motor Geodésico Web y Pruebas (`web-admin/src/lib/geo/spatial.ts`, `spatial.test.ts`, `run-spatial-tests.mjs`): Implementación y verificación de fórmulas Haversine, cálculo de distancias acumuladas, detección de desvíos y Bounding Box con 8/8 pruebas aprobadas (16/16 pruebas totales en `npm test`).
- **[x] TASK-008 — Capa de Persistencia Local Avanzada, Repositorio Unificado y Resiliencia Offline en Android:**
  - Repositorios de Dominio Desacoplados (`ShiftRepository`, `ShiftRepositoryImpl`, `TrackingRepository`, `TrackingRepositoryImpl`, `VisitRepository`, `VisitRepositoryImpl` y `RoutrackRepository`): Abstracción completa de Room sobre corrutinas en `Dispatchers.IO` y modelos inmutables, erradicando el acoplamiento directo en `TrackingViewModel` y `LocationForegroundService`.
  - Serialización Atómica y Prevención de Bloqueos: Implementación de `Mutex` en `TrackingRepositoryImpl` para evitar colisiones de base de datos (`SQLiteDatabaseLockedException`) y mantener el encadenamiento HMAC-SHA256 estrictamente secuencial y determinista ante alta concurrencia.
  - Soporte de Visitas Comerciales en Campo (`VisitaEntity.kt`, `VisitaDao.kt`): Entidad local, índices y DAO para persistencia de check-in georreferenciado, verificación de geocercas, acuerdos comerciales y check-out.
  - Búfer de Telemetría Offline y Purga: Soporte para almacenamiento y consulta de más de 10.000 puntos locales sin degradación de memoria heap mediante paginación con límites configurables y consultas de depuración (`purgarSincronizadasAntiguas`).
  - Validación Automatizada: Suite de verificación arquitectónica en `mobile-android/scripts/validate-persistence-architecture.mjs` con 34/34 aserciones aprobadas, y pruebas unitarias de repositorios en `TrackingRepositoryTest.kt` y `ShiftRepositoryTest.kt`.
- **[x] TASK-009 — Generador criptográfico de HMAC encadenado en Android:**
  - Componente Criptográfico Canónico (`HmacChainSigner.kt` en `com.routrack.mobile.security`): Implementación determinista de HMAC-SHA256 ($Hash_n = \text{HMAC}(Payload_n \parallel Hash_{n-1}, K)$) con semilla inicial de turno ($Hash_0 = \text{HMAC}(\text{"ROUTRACK-SHIFT-INIT|"} \parallel ShiftID, K)$), serialización canónica inmutable de puntos GPS (`PointPayload`) y eventos (`EventPayload`), y comparación en tiempo constante contra timing attacks.
  - Integración DRY con la Capa de Datos: `AuditChainManager.kt` actualizado para delegar en el motor criptográfico unificado de `HmacChainSigner`.
  - Suite de Pruebas Unitarias Exhaustiva (`HmacChainSignerTest.kt` y `run-hmac-tests.mjs`): 13/13 pruebas aprobadas verificando reproducibilidad determinista, efecto avalancha ante cambios de 0.000001° en coordenadas, sensibilidad a desfases de 1 ms en timestamps, detección de alteraciones en flag `isMock`, claves inválidas y quiebre de la cadena por reordenamiento o eliminación de eventos.
- **[x] TASK-010 — Android Foreground Service de captura adaptativa con Fused Location y Activity Recognition:**
  - Servicio Foreground Adaptativo (`TrackingForegroundService.kt` en `com.routrack.mobile.services`): Servicio persistente (`foregroundServiceType="location"`) con notificación visual obligatoria transparente en barra de estado bajo la LOPDP ("ROUTRACK: Seguimiento de jornada activo", no descartable, canal de baja prioridad sin alertas sonoras invasivas).
  - Optimización Energética (RNF-01) con Activity Recognition (`ActivityTransitionReceiver.kt`): Conmutación dinámica de frecuencia de muestreo según el estado físico del vendedor: modo `STILL` (90s / 25m) para máximo ahorro de batería, modo `WALKING` (20s / 10m) y modo `IN_VEHICLE` (10s / 15m con alta precisión).
  - Persistencia y Cese Inmediato: Integración con `TrackingRepository` para persistencia en Room con metadatos espaciales y encadenamiento HMAC, desvinculación total de sensores al invocar `stopTracking()` y declaración en `AndroidManifest.xml` con 22/22 aserciones aprobadas.
- **[x] TASK-011 — Detección de Mock Locations y anomalías de tiempo en Android:**
  - Gestor de Seguridad Anti-Tampering (`AntiTamperingManager.kt` en `com.routrack.mobile.security`): Detección nativa de aplicaciones de Fake GPS (`Location.isMock` / `Location.isFromMockProvider`), garantizando que cualquier punto simulado se marque inequívocamente en Room con `is_mock = true` y genere el evento de auditoría `MOCK_LOCATION_DETECTED`.
  - Detección de Desvíos de Reloj (> 60 segundos): Mecanismo de control que compara el reloj del sistema (`System.currentTimeMillis()`) frente a la referencia atómica GPS (`location.time`) y el reloj monotónico no alterable (`SystemClock.elapsedRealtime()`). Desvíos superiores a 60 segundos emiten de inmediato el evento de auditoría de advertencia `TIME_ANOMALY_DETECTED`.
  - Integración en Servicios: Incorporación en `TrackingForegroundService` y `LocationForegroundService` para auditoría continua en tiempo real y suite de pruebas unitarias (`AntiTamperingManagerTest.kt` y `run-antitampering-tests.mjs`) con 14/14 pruebas aprobadas.
- **[x] TASK-012 — Supabase Edge Function `sync-jornada` con validación HMAC e idempotencia:**
  - Endpoint Serverless en Deno (`supabase/functions/sync-jornada/index.ts`): Implementación con `Deno.serve`, manejo de CORS, validación de JWT (`Authorization: Bearer <jwt>`), autenticación en Supabase Auth, verificación de idempotencia previa en `sync_batches` (HTTP 200 inmediato), verificación criptográfica HMAC y persistencia atómica con `upsert` (`ON CONFLICT (id) DO NOTHING`) en `ubicaciones_gps`, `actividades_comerciales`, `bitacora_auditoria` y `sync_batches`.
  - Validador de Esquemas Estricto (`schema.ts`): Validación de contratos JSON sin dependencias externas pesadas (UUIDs RFC 4122, coordenadas WGS84, precisión, nivel de batería, formato hex de hashes HMAC y rechazo de timestamps futuros > 5 min).
  - Verificación Criptográfica Determinista (`verify-hmac.ts`): Recálculo de la cadena HMAC-SHA256 utilizando la Web Cryptography API nativa de Deno (`crypto.subtle`), reconstrucción canónica de payloads idéntica a Android (`HmacChainSigner.kt`), comparación segura en tiempo constante contra timing attacks y detección de adulteraciones con registro de alerta `HMAC_CHAIN_TAMPERED` en `bitacora_auditoria`.
  - Suite de Pruebas Unitarias (`supabase/tests/sync_jornada_edge_test.mjs`): 15/15 pruebas aprobadas empíricamente cubriendo lotes válidos (HTTP 200), detección de manipulación HMAC (HTTP 400), idempotencia por batch duplicado, validación de coordenadas fuera de rango, timestamps futuros y formato de hash.
- **[x] TASK-013 — Worker de sincronización en segundo plano con WorkManager en Android:**
  - Worker de Segundo Plano (`SyncJornadaWorker.kt` en `com.routrack.mobile.workers`): Implementación con `CoroutineWorker`, encolado de lotes de hasta 100 registros locales (`MAX_BATCH_SIZE = 100`) y procesamiento secuencial resiliente.
  - Orquestador y Restricciones (`SyncScheduler.kt`): Configuración inmutable de restricciones de red (`NetworkType.CONNECTED`), reintentos con backoff exponencial (`BackoffPolicy.EXPONENTIAL`, retardo inicial de 30 segundos) y métodos de encolado periódico (15 min) e inmediato bajo demanda.
  - Repositorio y Transporte Desacoplado (`SyncRepository.kt`, `SyncRepositoryImpl.kt`, `HttpTransport.kt`): Mapeo canónico a `SyncBatchPayload` en formato JSON, firmado HMAC de puntos de telemetría y visitas, transmisión vía HTTP POST seguro a `/functions/v1/sync-jornada`, transición atómica a `sincronizado = true` ante HTTP 200 y discriminación de excepciones (`NetworkException`, `ServerException`, `ClientException`).
  - Suite de Pruebas Unitarias y Validación (`SyncJornadaWorkerTest.kt` y `validate-sync-worker.mjs`): 22/22 pruebas aprobadas verificando restricciones de red, backoff exponencial, límite de lote, confirmación HTTP 200 y retención intacta de datos ante fallas de red.
- **[x] TASK-014 — Componente base de visor de mapas interactivo con Leaflet y OpenStreetMap:**
  - Componente Core (`MapView.tsx` en `web-admin/src/components/map`): Implementación interactiva con Leaflet (`use client`), teselas de OpenStreetMap ($0 USD) con fallback y soporte para `NEXT_PUBLIC_MAP_TILE_PROVIDER_URL`, coordenadas por defecto centradas en Quito (`[-0.180653, -78.467834]`), zoom 13, corrección de iconos de marcadores en Webpack y controles táctiles flotantes personalizados (`ZoomIn`, `ZoomOut`, `LocateFixed` / recenter).
  - Contenedor Dinámico (`MapContainerWrapper.tsx`): Carga asíncrona mediante `next/dynamic` con `{ ssr: false }` y skeleton animado (`MapLoadingSkeleton`) para evitar al 100% errores de hidratación SSR en Next.js.
  - Integración en Dashboard: Reemplazo del placeholder de `/live` con el visor de mapas operativo, compilando 11/11 rutas estáticas en `next build`.
  - Suite de Pruebas: 14 pruebas unitarias formales en `web-admin/scripts/run-map-tests.mjs` con 100% de éxito empírico (30/30 pruebas totales en `web-admin test`).
- **[x] TASK-015 — Vista de monitoreo en vivo con marcadores de estados operativos:**
  - Marcadores de Estados Operativos (`SellerMarker.tsx` en `web-admin/src/components/map`): Marcadores vectoriales dinámicos (`L.divIcon`) para los 5 estados según `docs/DESIGN.md`: En Ruta (Azul `#2563EB` con rumbo *bearing* en grados y halo pulsante), Detenido (Ámbar `#D97706`), Visita Validada (Esmeralda `#059669` con check), Desviación (Rojo `#DC2626` con advertencia e indicador de Fake GPS) y Sin Conexión (Gris `#64748B`).
  - Tarjeta Emergente y Tooltip (`SellerPopup.tsx`): Generador HTML y componente reactivo (`SellerPopupCard`) que presenta el nombre del vendedor, velocidad en km/h, porcentaje de batería con código de color, rumbo, última hora de reporte con tiempo relativo y alerta explícita ante `is_mock = true`.
  - Panel de Control en Tiempo Real (`web-admin/src/app/(dashboard)/live/page.tsx`): Integración del mapa interactivo con barra lateral de supervisión, KPIs con conteo en vivo por estado, buscador, selector de auto-refresco (15s), encuadre general (`fitBounds`) y recentrado suave individual (`flyTo`).
  - Suite de Pruebas: 17 pruebas unitarias formales en `web-admin/scripts/run-live-monitoring-tests.mjs` con 100% de éxito empírico (47/47 pruebas totales en `web-admin test`).

- **[x] TASK-016 — Vista de histórico de rutas, polilíneas y detección espacial de desvíos en PostGIS:**
  - Motor de Análisis Espacial y Desvíos (`web-admin/src/lib/geo/deviations.ts`): Implementación estricta de ordenamiento cronológico de telemetría GPS (`sortPointsChronologically`) para prevenir distorsiones cartográficas, cálculo geodésico Haversine de distancia total acumulada en km, detección de desviaciones respecto a paradas comerciales con umbral configurable (`DEFAULT_DEVIATION_THRESHOLD_METERS = 300`), agrupación continua en segmentos de desvío (`DeviationSegment`) con métricas cuantitativas (desviación máxima, promedio y duración temporal), cálculo de velocidades promedio/máxima y delimitación de Bounding Box para encuadre.
  - Componente de Polilíneas y Geocercas (`RoutePolyline.tsx` en `web-admin/src/components/map`): Renderizado modular con Leaflet de la polilínea principal continua en color Azul Tránsito (`#2563EB`, grosor 4px), superposición de segmentos desviados en color rojo semitransparente (`#DC2626`, grosor 6px, opacidad 0.7, dashArray `8, 8`) con popup informativo de exceso de distancia y duración en minutos, marcadores diferenciados de inicio/fin de turno y geocercas circulares de clientes con radio de tolerancia y numeración de secuencia.
  - Vista Interactiva de Auditoría de Rutas (`web-admin/src/app/(dashboard)/routes/page.tsx`): Selector interactivo de asesor y fecha, 6 tarjetas KPI con métricas consolidadas (distancia total recorrida en km, duración de jornada en formato horas/minutos, puntos auditados, velocidad promedio y máxima, y conteo de desvíos), leyenda interactiva con toggle para activar/desactivar desvíos y panel lateral con pestañas para enfocar instantáneamente anomalías o paradas comerciales.
  - Suite de Pruebas: 16 pruebas unitarias formales en `web-admin/scripts/run-routes-tests.mjs` con 100% de éxito empírico (63/63 pruebas totales en `web-admin test`).

### 4.2. Tareas Pendientes Inmediatas
- **[ ] TASK-017 (Fase 6):** Módulo de gestión y georreferenciación de clientes en panel web (`web-admin/src/app/(dashboard)/clients/page.tsx`, `ClientModal.tsx`, `ClientLocationPicker.tsx`). Depende de `TASK-014`, `TASK-004`.

---

## 5. Problemas Conocidos y Bloqueos

- *Ninguno identificado.* Todas las suites de prueba: Histórico de rutas y desvíos (16/16), Monitoreo en vivo y marcadores (17/17), Visor de mapas (14/14), Worker de sincronización (22/22), Edge Function `sync-jornada` (15/15), anti-manipulación Android (14/14), servicio foreground (22/22), motor geoespacial (8/8) y contratos Zod (8/8) pasan con 100% de éxito empírico. El panel web compila sin errores (`tsc --noEmit` y `next build`).

---

## 6. Siguiente Paso Obligatorio

- Proceder con **TASK-017**: Desarrollar el CRUD de clientes comerciales en `web-admin` permitiendo registrar nombre, RUC, dirección, coordenadas exactas (mediante selector interactivo en mapa Leaflet) y radio de tolerancia en metros.
