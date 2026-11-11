# Memoria Viva del Proyecto — ROUTRACK

**Última Actualización:** 10 de Noviembre de 2026  
**Documento:** Estado Vivo y Registro Dinámico de Contexto (Project Memory)  
**Versión:** 1.4.0  
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

- **Fase Activa:** **FASE 7 — Slice Vertical de Auditoría, Métricas e Inmutabilidad (En Curso).**
- **Progreso de Fase:** 2 de 3 tareas completadas en la Fase 7 (22 de 28 tareas completadas en el proyecto, 78.6% de avance global). `TASK-022` ha culminado exitosamente con la implementación del dashboard de métricas operativas y gráficos interactivos con Recharts (cobertura de clientes, kilómetros totales por asesor, tasa de visitas verificadas con `ST_DWithin`, distribución horaria y totalización de acuerdos pactados), tarjetas KPI con skeleton loader anatómico y cumplimiento riguroso de los 4 estados de interfaz, superando 21/21 pruebas unitarias específicas y 136/136 pruebas globales en web-admin. Preparado para iniciar `TASK-023`.

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

- **[x] TASK-017 — Módulo de gestión y georreferenciación de clientes en panel web:**
  - Modelo de Dominio y Tipos (`web-admin/src/types/client.ts`): Interfaz `Client`, `ClientFormData`, `ClientPostGISRow`, conversor bidireccional a WKT canónico (`formatToWKTPoint` con orden $X=\text{Longitud}, Y=\text{Latitud}$), parser robusto de EWKT PostGIS (`parseWKTPoint`) con soporte para prefijos `SRID=4326`, y formateador visual de coordenadas sexagesimales.
  - Esquema de Validación Estricto con Zod (`web-admin/src/lib/validation/clientSchema.ts`): Validación en doble capa con mensajes 100% en español: Razón Social (mínimo 3 caracteres), RUC ecuatoriano de 13 dígitos terminado en `001` o Cédula de 10 dígitos, dirección física (mínimo 5 caracteres), formato telefónico, rangos de coordenadas WGS84 $[-90, 90]$ y $[-180, 180]$, y radio de geocerca entero entre 10 y 1000 metros (por defecto 50m).
  - Selector Cartográfico Interactivo (`ClientLocationPicker.tsx` en `web-admin/src/components/clients`): Renderizado exclusivo en cliente sobre OpenStreetMap ($0 USD) con pin arrastrable (*draggable marker*), captura instantánea de clics en el mapa, geolocalización de navegador satelital, geocerca circular (`L.circle`) que redimensiona su radio en tiempo real, e inputs sincronizados de precisión decimal.
  - Formulario Modal Accesible (`ClientModal.tsx`): Creación y edición con accesibilidad (tecla Escape, backdrop), presets rápidos de radio de geocerca (25m, 50m, 100m, 200m) y feedback visual de validación en tiempo real.
  - Catálogo Web de Clientes (`web-admin/src/app/(dashboard)/clients/page.tsx`): 4 Tarjetas KPI analíticas (Total de clientes, Habilitados, Pausados, Geocerca promedio), buscador reactivo por RUC / nombre / dirección, filtro por estado activo/inactivo, tabla con coordenadas clickeables, modal de vista previa en mapa y sincronización con Supabase PostGIS.
  - Suite de Pruebas: 18 pruebas unitarias formales en `web-admin/scripts/run-client-tests.mjs` con 100% de éxito empírico (81/81 pruebas totales en `web-admin test`).

- **[x] TASK-018 — Pantalla y flujo móvil de registro de visita comercial en Android:**
  - ViewModel de Visitas Comerciales (`VisitViewModel.kt` en `com.routrack.mobile.presentation.visits`): Orquestación del ciclo de vida de la visita comercial con `StateFlow` inmutable, captura asíncrona no bloqueante de coordenadas GPS mediante `HighAccuracyLocationProvider`, cálculo geodésico Haversine de distancia al cliente, evaluación determinista de geocercas (`VERIFIED` vs `OUT_OF_RANGE`), cronómetro en tiempo real de permanencia en tienda, y serialización estructurada de acuerdos comerciales en formato JSON (`buildAgreementsJson`).
  - Validación Rigurosa de Precios Pactados (Criterio 2): `validateCommercialAgreement` valida que los productos contengan al menos 2 caracteres, cantidades enteras > 0, precios unitarios pactados estrictamente > $0.00 y descuentos porcentuales entre 0% y 100%, con cálculo dinámico de subtotales y monto total acumulado.
  - Persistencia Local Inmediata en Room (Criterio 3): Registro instantáneo de check-in y actualización de check-out en la tabla SQLite `visitas_comerciales` mediante `VisitRepository`, garantizando que el registro ingrese y permanezca en `sincronizado = false` (`PENDING`) listo para el encolamiento y despacho automático por `SyncJornadaWorker`.
  - Interfaz Declarativa Jetpack Compose (`VisitCheckInScreen.kt`): Implementación con Material 3 (`Scaffold`, `Card`, `Button`, `FilterChip`), lista de clientes asignados con buscador reactivo y filtro de pendientes, tarjeta cabecera de visita activa con cronómetro y badge de geocerca, panel de acuerdos pactados con resumen financiero, campos de observaciones, compromisos y fecha prometida de entrega, y pantalla de resumen final tras check-out exitoso.
  - Suites de Pruebas: Suite unitaria JUnit en `VisitViewModelTest.kt` y suite automatizada en `validate-visit-workflow.mjs` con 22/22 pruebas aprobadas (100% PASS).

- **[x] TASK-019 — Validación espacial de geocerca en Supabase (`ST_DWithin`):**
  - Función Espacial PostGIS (`calcular_distancia_geocerca_cliente` en `supabase/migrations/20261106000005_visit_validation_function.sql`): Cálculo geodésico exacto en metros sobre el esferoide WGS84 mediante `ST_Distance(cliente.ubicacion::geography, checkin.ubicacion::geography)` y evaluación booleana indexada por GiST con `ST_DWithin`. Visitas con distancia física $\le$ tolerancia del cliente se marcan categóricamente como `VERIFIED`; visitas con distancia $>$ tolerancia se clasifican como `OUT_OF_RANGE`.
  - Función RPC Pública (`evaluar_geocerca_visita`): Interfaz serverless para clientes y Edge Functions que recibe cliente ID y coordenadas (lat, lng), valida límites WGS84 $[-90, 90]$ y $[-180, 180]$ y retorna un objeto `JSONB` estructurado con distancia calculada, tolerancia, estado y nombre de cliente.
  - Trigger Inmutable Anti-Tampering (`trg_validar_geocerca_visita`): Disparador `BEFORE INSERT OR UPDATE` sobre `public.actividades_comerciales` que recalcula en el motor de base de datos la distancia geodésica fehaciente y sobrescribe de forma forzada cualquier intento de manipular el estado a `VERIFIED` cuando la distancia real excede el radio de geocerca del cliente.
  - Integración en Edge Function `sync-jornada`: Despacho de visitas comerciales en `sync-jornada/index.ts` articulado con el RPC y trigger espacial, reportando en `visits_evaluation` los valores cuantitativos de distancia y estado verificados por PostGIS.
  - Suite de Pruebas: 16 pruebas unitarias formales en `supabase/tests/visit_validation_function_test.mjs` con 100% de éxito empírico (16/16 PASS).

- **[x] TASK-020 — Panel web de supervisión y auditoría de visitas comerciales:**
  - Modelo de Dominio y Tipos (`web-admin/src/types/visit.ts`): Definición estricta de interfaces TypeScript (`VisitRecord`, `AgreementItem`, `VisitAgreementsPayload`, `VisitStatus` con `VERIFIED`, `OUT_OF_RANGE`, `CANCELLED`, `VisitFilters`, `VisitKpis`) y funciones de formateo temporal (`formatVisitDuration` para duración precisa en minutos/segundos y `formatTimeDisplay`).
  - Componente de Tabla y Filtros de Auditoría (`web-admin/src/components/visits/VisitTable.tsx`): Tabla interactiva con badges semánticos (`VERIFIED` en verde esmeralda con check vs `OUT_OF_RANGE` en rojo con advertencia), distancia exacta calculada por PostGIS, resumen financiero de precios pactados, tiempo de permanencia, filtros dinámicos por asesor, estado de geocerca y fecha, buscador predictivo y estado vacío educativo.
  - Modal Detallado con Visor Cartográfico Leaflet (`web-admin/src/components/visits/VisitDetailModal.tsx`): Cumplimiento de Criterio 2 al renderizar mapa interactivo sobre OpenStreetMap con geocerca circular del cliente (`L.circle` con radio de tolerancia), marcadores diferenciados de cliente y check-in del asesor, línea geodésica discontinua indicando la distancia exacta en metros, auto-encuadre espacial (`map.fitBounds`), desglose de precios pactados (SKU, cantidades, descuentos y subtotales), notas de inventario, fecha comprometida de entrega y bloque de auditoría criptográfica HMAC-SHA256 con copiado directo.
  - Vista Principal con los 4 Estados Obligatorios de Interfaz (`web-admin/src/app/(dashboard)/visits/page.tsx`): Cumplimiento de Criterio 1 y `docs/DESIGN.md`: Skeleton Loader anatómico con `animate-pulse` para carga, pantalla de error con mensaje claro en español y botón explícito de reintento, estado vacío accesible y diseño completamente responsivo y adaptativo. Dispone de 4 tarjetas KPI con métricas cuantitativas consolidadas (Total visitas, Verificadas con % de efectividad, Alertas fuera de rango y Monto total acordado).
  - Verificación y Suites de Pruebas: 16 pruebas unitarias formales en `web-admin/scripts/run-visit-tests.mjs` con 100% de éxito empírico (16/16 PASS), 97/97 pruebas totales aprobadas en `web-admin test`, 0 errores en chequeo estricto de tipos (`tsc --noEmit`) y empaquetado de producción exitoso (`next build`).

- **[x] TASK-021 — Módulo web de bitácora inmutable de eventos del sistema:**
  - Modelo de Dominio y Tipos (`web-admin/src/types/audit.ts`): Interfaces estrictas de TypeScript (`AuditLogRecord`, `AuditSeverity` con `INFO`, `WARNING`, `CRITICAL`, `AuditEventType`, `AuditFilters`, `AuditIntegritySummary`), truncado seguro de hashes de 64 caracteres (`truncateHash`), formateador de timestamps locales y función evaluadora de continuidad matemática `verifyChainContinuity`.
  - Componente de Tabla y Filtros Forenses (`web-admin/src/components/audit/AuditLogTable.tsx`): Tabla interactiva con badges de severidad semántica oficial (`INFO` en azul, `WARNING` en ámbar y `CRITICAL` en rojo según `docs/DESIGN.md`), buscador predictivo en tiempo real, filtros por asesor, severidad, tipo de evento y fecha, metadatos estructurados en snippets legibles, indicador individual por fila del estado de eslabón criptográfico (icono de enlace íntegro vs ruptura) y copiado rápido de hashes HMAC al portapapeles.
  - Modal Detallado de Inspección Criptográfica (`web-admin/src/components/audit/AuditDetailModal.tsx`): Modal flotante accesible con diagnóstico forense, desglose comparativo entre `previous_hash` y `hmac_hash` de 64 caracteres con copiado directo, coordenadas GPS del incidente y formateador visual de metadatos JSON completos.
  - Vista Principal con los 4 Estados Obligatorios de Interfaz (`web-admin/src/app/(dashboard)/audit/page.tsx`): 4 Tarjetas KPI cuantitativas (Total Eventos, Alertas Críticas, Advertencias Operativas, Estado de Custodia Criptográfica), indicador visual global de integridad en cabecera con `ShieldCheck` y `ShieldAlert`, botón de auditoría matemática interactiva, simulador forense de adulteración deliberada para verificación de respuesta, y cumplimiento estricto de los 4 estados: `AuditSkeletonLoader` (Cargando con `animate-pulse`), `AuditErrorState` (Error con botón "Reintentar Conexión"), Estado Vacío educativo y diseño Adaptativo responsive.
  - Verificación y Suites de Pruebas: 18 pruebas unitarias formales en `web-admin/scripts/run-audit-tests.mjs` con 100% de éxito empírico (18/18 PASS), 115/115 pruebas totales aprobadas en `web-admin test`, 0 errores en chequeo estricto de tipos (`tsc --noEmit`) y compilación exitosa de producción (`next build`).

- **[x] TASK-022 — Dashboard de métricas operativas y gráficos con Recharts:**
  - Modelo de Dominio y Tipos (`web-admin/src/types/dashboard.ts`): Interfaces estrictas de TypeScript (`DashboardKpis`, `SellerPerformanceMetric`, `HourlyDistributionMetric`, `WeeklyTrendMetric`) y función matemática pura de totalización `calculateDashboardKpis` (cobertura %, kilómetros acumulados, tasa de efectividad en geocerca, total de visitas y montos acordados en USD).
  - Componente de Tarjetas de Métricas (`web-admin/src/components/dashboard/MetricCards.tsx`): 4 Tarjetas KPI modulares según `docs/DESIGN.md` § 4.2 (Cobertura de clientes, Kilómetros totales recorridos, Tasa de visitas verificadas con `ST_DWithin` y Fuerza comercial activa con compromisos pactados) con soporte para skeleton loader anatómico (`MetricCardsSkeleton`) con `animate-pulse`.
  - Componente de Gráficos de Desempeño (`web-admin/src/components/dashboard/PerformanceChart.tsx`): Integración modular de la librería Recharts (`ResponsiveContainer`, `BarChart`, `Bar`, `AreaChart`, `Area`, `Tooltip`, `Legend`) con alternancia interactiva entre "Desempeño por Asesor" (comparativa de kilómetros, visitas verificadas y fuera de rango) y "Curva Horaria" (ritmo de actividad comercial entre 08:00 y 18:00), paleta semántica oficial y skeleton loader (`PerformanceChartSkeleton`).
  - Vista Principal del Dashboard (`web-admin/src/app/(dashboard)/page.tsx`): Selector interactivo de fecha de jornada (`YYYY-MM-DD`), botón de actualización en tiempo real, integración reactiva con cliente Supabase (`jornadas_laborales`, `actividades_comerciales`, `clientes`) y cumplimiento riguroso de los 4 estados obligatorios: Cargando con skeleton loader dual, Error con botón explícito "Reintentar Conexión", Vacío pedagógico cuando no hay jornadas en la fecha y Adaptativo responsive para móviles, tabletas y monitores panorámicos.
  - Verificación y Suites de Pruebas: 21 pruebas unitarias formales en `web-admin/scripts/run-dashboard-tests.mjs` con 100% de éxito empírico (21/21 PASS), 136/136 pruebas totales aprobadas en `web-admin test`, 0 errores en chequeo estricto de tipos (`tsc --noEmit`) y compilación exitosa de producción (`next build`).

### 4.2. Tareas Pendientes Inmediatas
- **[ ] TASK-023 (Fase 7):** Exportación formal de reportes de jornada a formato CSV (`web-admin/src/lib/export/exportCsv.ts`, `web-admin/src/app/(dashboard)/reports/page.tsx`). Depende de `TASK-006`, `TASK-020`.

---

## 5. Problemas Conocidos y Bloqueos

- *Ninguno identificado.* Todas las suites de prueba: Dashboard y métricas Recharts (21/21), Bitácora de auditoría forense (18/18), Auditoría de visitas comerciales (16/16), Validación de geocercas PostGIS (16/16), Flujo de visitas Android (22/22), Gestión de clientes y PostGIS (18/18), Histórico de rutas y desvíos (16/16), Monitoreo en vivo y marcadores (17/17), Visor de mapas (14/14), Worker de sincronización (22/22), Edge Function `sync-jornada` (15/15), anti-manipulación Android (14/14), servicio foreground (22/22), motor geoespacial (8/8) y contratos Zod (8/8) pasan con 100% de éxito empírico (136 pruebas totales en panel web). El panel web compila sin errores (`tsc --noEmit` y `next build`).

---

## 6. Siguiente Paso Obligatorio

- Proceder con **TASK-023**: Implementar la utilidad de exportación en `web-admin` que genera archivos `.csv` estructurados con codificación UTF-8 con BOM para apertura correcta en Microsoft Excel, conteniendo fecha, vendedor, inicio, fin, kilómetros y desglose de visitas.
