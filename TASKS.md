# Plan Maestro de Tareas y Desarrollo — ROUTRACK

**Proyecto:** ROUTRACK  
**Documento:** Backlog de Tareas por Fases (Task Plan)  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Metodología:** Desarrollo guiado por IA (Vibe Coding) mediante Vertical Slices  

---

## Resumen del Estado de Tareas

- **Tareas Totales:** 30
- **Tareas Completadas:** 1 (TASK-001)
- **Tareas En Progreso:** 0
- **Tareas Pendientes:** 29

---

## FASE 0: Investigación y Documentación Fundacional

### [x] TASK-001 — Crear documentación fundacional de ROUTRACK y publicarla en GitHub
- **Descripción:** Redactar todos los documentos base del sistema (PRD, Arquitectura, Diseño, Plan de Pruebas, Seguridad, ADRs, Memoria, Tareas, Reglas de Antigravity, README, .env.example y .gitignore) garantizando coherencia técnica total y publicarlos en el repositorio GitHub.
- **Dependencias:** Ninguna.
- **Archivos Involucrados:** `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN.md`, `docs/TEST_PLAN.md`, `docs/SECURITY.md`, `docs/DECISIONS.md`, `docs/MEMORY.md`, `TASKS.md`, `README.md`, `.env.example`, `.gitignore`, `GEMINI.md`, `AGENTS.md`, `.agent/rules/rules.md`.
- **Criterios de Aceptación:**
  1. Todos los documentos existen y contienen los apartados exigidos.
  2. Coherencia estricta en el stack: Supabase, Next.js + TS, Kotlin + Compose, Leaflet, Playwright, Vercel.
  3. No hay contradicciones entre requerimientos y diseño.
  4. Reglas de Antigravity configuradas en las rutas reconocidas.
  5. Commit realizado y cambios publicados exitosamente en la rama `main` del repositorio remoto.
- **Estado:** Completada.

---

## FASE 1: Configuración del Proyecto y Entornos Base

### [ ] TASK-002 — Configuración de la estructura de directorios del monorepo
- **Descripción:** Crear la estructura base de carpetas del proyecto (`apps/web`, `apps/android`, `supabase`), configurando archivos de configuración raíz compartidos y scripts base de conveniencia.
- **Dependencias:** TASK-001.
- **Archivos Involucrados:** Estructura de directorios, `package.json` raíz (workspaces), `.editorconfig`.
- **Criterios de Aceptación:**
  1. Árbol de carpetas coincide con `docs/ARCHITECTURE.md`.
  2. Archivos de configuración limpios sin dependencias rotas.
- **Estado:** Pendiente.

### [ ] TASK-003 — Configuración del entorno Supabase local y migraciones base
- **Descripción:** Inicializar la configuración de Supabase CLI (`supabase init`), configurar Docker para el stack local, activar las extensiones necesarias (PostGIS, uuid-ossp, pgcrypto).
- **Dependencias:** TASK-002.
- **Archivos Involucrados:** `supabase/config.toml`, `supabase/migrations/20261106000000_init_extensions.sql`.
- **Criterios de Aceptación:**
  1. `supabase start` levanta los contenedores locales sin errores.
  2. La extensión PostGIS está activa y operativa (`SELECT PostGIS_Version();` exitoso).
- **Estado:** Pendiente.

### [ ] TASK-004 — Configuración inicial de la aplicación web Next.js con Tailwind CSS
- **Descripción:** Inicializar el proyecto Next.js en `apps/web` con App Router, TypeScript estricto, configuración de Tailwind CSS y utilidades base de diseño.
- **Dependencias:** TASK-002.
- **Archivos Involucrados:** `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/tailwind.config.ts`, `apps/web/src/app/layout.tsx`.
- **Criterios de Aceptación:**
  1. `npm run dev` en `apps/web` inicia sin errores en puerto 3000.
  2. `tsc --noEmit` compila en modo estricto con cero advertencias.
  3. Estilos de Tailwind funcionales según `docs/DESIGN.md`.
- **Estado:** Pendiente.

### [ ] TASK-005 — Configuración inicial del proyecto Android con Kotlin y Jetpack Compose
- **Descripción:** Inicializar el proyecto Gradle de Android en `apps/android` con Kotlin DSL (`build.gradle.kts`), configuración de Compose BOM, Room, Coroutines y soporte mínimo para API 26 (Android 8.0).
- **Dependencias:** TASK-002.
- **Archivos Involucrados:** `apps/android/build.gradle.kts`, `apps/android/app/build.gradle.kts`, `apps/android/app/src/main/AndroidManifest.xml`.
- **Criterios de Aceptación:**
  1. El proyecto compila limpiamente desde línea de comandos con `./gradlew assembleDebug`.
  2. Dependencias de Compose y Room resueltas correctamente.
- **Estado:** Pendiente.

---

## FASE 2: Autenticación, Organizaciones y Usuarios

### [ ] TASK-006 — Esquema SQL de organizaciones, perfiles y políticas RLS iniciales
- **Descripción:** Crear la migración SQL para las tablas `organizations` y `profiles` (vinculada a `auth.users`), junto con los triggers para la creación automática de perfiles y las políticas RLS multi-tenant iniciales.
- **Dependencias:** TASK-003.
- **Archivos Involucrados:** `supabase/migrations/20261106000001_create_orgs_and_profiles.sql`, `supabase/seed.sql`.
- **Criterios de Aceptación:**
  1. Tablas creadas con claves foráneas e integridad referencial.
  2. Trigger `on_auth_user_created` sincroniza datos en `profiles`.
  3. Pruebas de políticas RLS impiden acceso entre diferentes organizaciones.
- **Estado:** Pendiente.

### [ ] TASK-007 — Flujo de autenticación en panel web Next.js
- **Descripción:** Implementar las páginas de inicio de sesión, recuperación de contraseña y middleware de protección de rutas en Next.js usando `@supabase/ssr`.
- **Dependencias:** TASK-004, TASK-006.
- **Archivos Involucrados:** `apps/web/src/app/(auth)/login/page.tsx`, `apps/web/src/middleware.ts`, `apps/web/src/lib/supabase/`.
- **Criterios de Aceptación:**
  1. Formulario de login valida campos con Zod.
  2. Sesión guardada en cookies seguras (`HttpOnly`).
  3. Redirección automática de rutas no autenticadas hacia `/login`.
  4. Redirección de usuarios autenticados hacia el dashboard principal.
- **Estado:** Pendiente.

### [ ] TASK-008 — Flujo de autenticación en Android y almacenamiento seguro de sesión
- **Descripción:** Implementar la pantalla de inicio de sesión en Compose y el servicio de autenticación móvil, almacenando el token de sesión de forma cifrada mediante Android Keystore (EncryptedSharedPreferences).
- **Dependencias:** TASK-005, TASK-006.
- **Archivos Involucrados:** `apps/android/app/src/main/java/com/routrack/app/presentation/auth/`, `apps/android/app/src/main/java/com/routrack/app/security/KeystoreManager.kt`.
- **Criterios de Aceptación:**
  1. Login exitoso contra Supabase Auth mediante API REST.
  2. Token JWT y refresh token almacenados de forma segura con cifrado AES-256-GCM.
  3. La app recuerda la sesión al reiniciarse sin solicitar credenciales nuevamente.
- **Estado:** Pendiente.

---

## FASE 3: Gestión de Clientes y Vendedores

### [ ] TASK-009 — Esquema SQL de clientes con soporte geoespacial PostGIS
- **Descripción:** Crear la migración SQL para la tabla `clients` con columna `location GEOGRAPHY(POINT, 4326)`, índice GiST y políticas RLS por organización.
- **Dependencias:** TASK-006.
- **Archivos Involucrados:** `supabase/migrations/20261106000002_create_clients.sql`.
- **Criterios de Aceptación:**
  1. Tabla `clients` creada con índice `USING GIST (location)`.
  2. Restricción de radio de tolerancia positivo (`tolerance_radius_meters > 0`).
  3. RLS restringe lectura y escritura a la organización activa.
- **Estado:** Pendiente.

### [ ] TASK-010 — Módulo web de administración de clientes y georreferenciación
- **Descripción:** Desarrollar el CRUD de clientes en el panel web de Next.js, permitiendo ingresar coordenadas manualmente o marcando el punto sobre un mapa Leaflet selector.
- **Dependencias:** TASK-007, TASK-009.
- **Archivos Involucrados:** `apps/web/src/app/(dashboard)/clients/`, `apps/web/src/components/clients/`.
- **Criterios de Aceptación:**
  1. Listado paginado de clientes con búsqueda por nombre y RUC.
  2. Modal de creación y edición con validación de coordenadas.
  3. Selector de ubicación en mapa funcional e interactivo.
- **Estado:** Pendiente.

### [ ] TASK-011 — Módulo web de administración de vendedores y asignación
- **Descripción:** Desarrollar la gestión de perfiles de vendedores en el panel web, permitiendo registrar nuevos asesores comerciales y asignarles su rol y supervisor correspondiente.
- **Dependencias:** TASK-007, TASK-009.
- **Archivos Involucrados:** `apps/web/src/app/(dashboard)/sellers/`, `apps/web/src/components/sellers/`.
- **Criterios de Aceptación:**
  1. Listado de vendedores pertenecientes a la organización.
  2. Asignación de credenciales iniciales e invitación de acceso.
  3. Modificación del estado activo/inactivo del vendedor.
- **Estado:** Pendiente.

---

## FASE 4: Jornadas Laborales y Ubicación en Android

### [ ] TASK-012 — Esquema SQL de jornadas y puntos de telemetría GPS
- **Descripción:** Crear migraciones para `work_shifts` y `tracking_points` con índices GiST, validaciones de integridad temporal y políticas RLS restrictivas para vendedores y supervisores.
- **Dependencias:** TASK-006.
- **Archivos Involucrados:** `supabase/migrations/20261106000003_create_shifts_and_tracking.sql`.
- **Criterios de Aceptación:**
  1. Tablas creadas con claves foráneas hacia `organizations` y `profiles`.
  2. Índice espacial en `tracking_points.location`.
  3. RLS garantiza que un vendedor solo puede insertar puntos para su propio usuario y jornada.
- **Estado:** Pendiente.

### [ ] TASK-013 — Base de datos Room local y DAOs para jornadas y telemetría en Android
- **Descripción:** Implementar la base de datos local SQLite con Room (`AppDatabase`), definiendo entidades locales `LocalWorkShiftEntity` y `LocalTrackingPointEntity` con sus respectivos DAOs.
- **Dependencias:** TASK-005, TASK-012.
- **Archivos Involucrados:** `apps/android/app/src/main/java/com/routrack/app/data/local/`.
- **Criterios de Aceptación:**
  1. Pruebas unitarias en memoria validan inserción y recuperación cronológica de puntos.
  2. Estados de sincronización (`pending`, `synced`) manejados limpiamente.
- **Estado:** Pendiente.

### [ ] TASK-014 — Foreground Service de rastreo con Fused Location Provider
- **Descripción:** Implementar el `TrackingForegroundService` en Android que solicita ubicaciones al `FusedLocationProviderClient`, mantiene una notificación visible y persistente en la barra de estado y almacena las coordenadas en Room.
- **Dependencias:** TASK-008, TASK-013.
- **Archivos Involucrados:** `apps/android/app/src/main/java/com/routrack/app/services/TrackingForegroundService.kt`, `apps/android/app/src/main/AndroidManifest.xml`.
- **Criterios de Aceptación:**
  1. Al iniciar jornada se muestra la notificación no descartable con aviso visible.
  2. Puntos GPS capturados a intervalos configurados y persistidos en Room.
  3. Al presionar "Finalizar Jornada", el servicio se destruye por completo y cesa el rastreo.
- **Estado:** Pendiente.

### [ ] TASK-015 — Sincronización en segundo plano con WorkManager
- **Descripción:** Implementar el `SyncWorker` en WorkManager que procesa los puntos y jornadas pendientes en Room, los empaqueta en lotes y los sincroniza hacia Supabase vía HTTPS.
- **Dependencias:** TASK-013, TASK-014.
- **Archivos Involucrados:** `apps/android/app/src/main/java/com/routrack/app/workers/SyncWorker.kt`.
- **Criterios de Aceptación:**
  1. Los puntos guardados en modo offline se transmiten automáticamente al volver a tener red.
  2. Reintentos con política de backoff exponencial ante fallos temporales.
  3. Ningún punto se pierde ni se duplica en el servidor.
- **Estado:** Pendiente.

### [ ] TASK-016 — Detección de Mock Locations y anomalías de hardware
- **Descripción:** Incorporar mecanismos de validación de telemetría en Android para detectar si una coordenada proviene de un proveedor simulado (`Location.isFromMockProvider()` o `Location.isMock()`) y registrar la bandera `is_mock`.
- **Dependencias:** TASK-014.
- **Archivos Involucrados:** `apps/android/app/src/main/java/com/routrack/app/security/MockLocationDetector.kt`.
- **Criterios de Aceptación:**
  1. Coordenadas inyectadas por apps de Fake GPS se marcan inequívocamente con `is_mock = true`.
  2. La bandera se persiste en Room y se transmite a Supabase para auditoría.
- **Estado:** Pendiente.

---

## FASE 5: Rutas y Mapas en Panel Web

### [ ] TASK-017 — Integración del visor de mapa Leaflet configurable en Next.js
- **Descripción:** Implementar el componente base de mapa interactivo con React-Leaflet (`dynamic import` con `ssr: false`), permitiendo configurar la URL del proveedor de tiles mediante variables de entorno.
- **Dependencias:** TASK-004.
- **Archivos Involucrados:** `apps/web/src/components/map/MapView.tsx`, `apps/web/src/components/map/`.
- **Criterios de Aceptación:**
  1. Mapa carga fluidamente sin errores de renderizado en servidor.
  2. Controles de zoom y escala integrados según el sistema de diseño (`docs/DESIGN.md`).
  3. Proveedor de tiles cambia transparentemente según `.env`.
- **Estado:** Pendiente.

### [ ] TASK-018 — Monitoreo en tiempo real de vendedores activos
- **Descripción:** Integrar el mapa con Supabase Realtime para desplegar la última posición conocida de los vendedores con jornada abierta, mostrando marcadores diferenciados con sus metadatos.
- **Dependencias:** TASK-012, TASK-017.
- **Archivos Involucrados:** `apps/web/src/app/(dashboard)/live/page.tsx`, `apps/web/src/components/map/SellerMarker.tsx`.
- **Criterios de Aceptación:**
  1. Marcador azul con orientación de avance para vendedores en movimiento.
  2. Marcador ámbar para vendedores en parada.
  3. Actualización automática de la posición ante nuevos puntos de telemetría.
- **Estado:** Pendiente.

### [ ] TASK-019 — Visualización de histórico de recorridos y polilíneas
- **Descripción:** Implementar el módulo de consulta histórica que permite seleccionar un vendedor y una fecha para renderizar la polilínea completa de la jornada, puntos de inicio/fin y paradas registradas.
- **Dependencias:** TASK-012, TASK-017.
- **Archivos Involucrados:** `apps/web/src/app/(dashboard)/routes/page.tsx`, `apps/web/src/components/map/RoutePolyline.tsx`.
- **Criterios de Aceptación:**
  1. Trazado nítido de la polilínea georreferenciada.
  2. Cálculo de métricas visuales: distancia total recorrida, tiempo en movimiento y paradas.
  3. Filtro por fecha y vendedor sin sobrecargar la memoria del navegador.
- **Estado:** Pendiente.

---

## FASE 6: Visitas Comerciales y Verificación Espacial

### [ ] TASK-020 — Esquema SQL de visitas comerciales y validación espacial
- **Descripción:** Crear la migración para `visit_records` e implementar la función SQL o trigger que utiliza PostGIS `ST_Distance` para contrastar las coordenadas del check-in contra el cliente, asignando el estado `verified` o `out_of_range`.
- **Dependencias:** TASK-009, TASK-012.
- **Archivos Involucrados:** `supabase/migrations/20261106000004_create_visit_records.sql`.
- **Criterios de Aceptación:**
  1. Distancia calculada con precisión esferoidal en metros.
  2. Visitas dentro del radio de tolerancia se clasifican automáticamente como `verified`.
  3. Visitas fuera del radio se etiquetan como `out_of_range`.
- **Estado:** Pendiente.

### [ ] TASK-021 — Módulo móvil Android para check-in y check-out de visitas
- **Descripción:** Desarrollar las pantallas y componentes en Compose para que el vendedor visualice sus clientes asignados y registre su llegada y salida con un solo toque, capturando coordenadas y notas.
- **Dependencias:** TASK-014, TASK-020.
- **Archivos Involucrados:** `apps/android/app/src/main/java/com/routrack/app/presentation/visits/`.
- **Criterios de Aceptación:**
  1. Interfaz intuitiva y rápida para registrar check-in de visita.
  2. Almacenamiento local offline en Room si no hay cobertura de datos.
  3. Captura obligatoria de hora y coordenadas exactas al momento del registro.
- **Estado:** Pendiente.

### [ ] TASK-022 — Carga de evidencias fotográficas opcionales a Supabase Storage
- **Descripción:** Implementar la captura de foto con la cámara del dispositivo móvil, compresión local de imagen y subida hacia Supabase Storage asociada al `visit_record`.
- **Dependencias:** TASK-021.
- **Archivos Involucrados:** `apps/android/app/src/main/java/com/routrack/app/presentation/visits/PhotoCaptureHelper.kt`.
- **Criterios de Aceptación:**
  1. Imagen comprimida a tamaño óptimo (< 500 KB) antes de enviar.
  2. Subida segura hacia el bucket privado de Supabase Storage.
  3. URL de la evidencia guardada en el registro de visita.
- **Estado:** Pendiente.

### [ ] TASK-023 — Módulo web de supervisión y auditoría de visitas realizadas
- **Descripción:** Crear la vista en el panel web donde el supervisor puede auditar la lista de visitas del día, visualizando el estado de proximidad, fotos de evidencia y notas ingresadas por el vendedor.
- **Dependencias:** TASK-007, TASK-020.
- **Archivos Involucrados:** `apps/web/src/app/(dashboard)/visits/page.tsx`, `apps/web/src/components/visits/`.
- **Criterios de Aceptación:**
  1. Badges semánticos (verde: verificada / ámbar: fuera de radio).
  2. Indicador numérico de distancia a la que se registró el check-in (ej. "a 18 metros del local").
  3. Modal con visor de foto de evidencia y notas comerciales.
- **Estado:** Pendiente.

---

## FASE 7: Auditoría y Reportes Operativos

### [ ] TASK-024 — Detección de discrepancias y alertas de auditoría
- **Descripción:** Implementar algoritmos de detección de anomalías (intentos de mock location, visitas con tiempos inferiores a 2 minutos, saltos de ubicación geográficamente imposibles).
- **Dependencias:** TASK-016, TASK-020.
- **Archivos Involucrados:** `apps/web/src/app/(dashboard)/audit/`, `supabase/functions/audit-detector/`.
- **Criterios de Aceptación:**
  1. Panel de alertas operativas con lista de incidentes priorizados.
  2. Resaltado en mapa de los puntos donde se detectó simulación de GPS.
- **Estado:** Pendiente.

### [ ] TASK-025 — Generador y exportador de reportes operativos (CSV / PDF)
- **Descripción:** Desarrollar la funcionalidad de exportación de métricas de cumplimiento de jornadas, visitas y kilometraje en formato CSV estructurado para análisis en Excel u hojas de cálculo.
- **Dependencias:** TASK-007, TASK-019, TASK-023.
- **Archivos Involucrados:** `apps/web/src/app/(dashboard)/reports/page.tsx`, `apps/web/src/lib/reports/exportCsv.ts`.
- **Criterios de Aceptación:**
  1. Descarga de archivo `.csv` con codificación UTF-8 con BOM para correcta apertura en Excel.
  2. Filtros por rango de fechas, supervisor y vendedor.
  3. Cero inconsistencias en sumatorias de distancias y conteo de visitas.
- **Estado:** Pendiente.

### [ ] TASK-026 — Bitácora de auditoría inmutable en `audit_logs`
- **Descripción:** Crear la migración y los triggers SQL para que toda modificación de usuarios, configuraciones o eventos de seguridad se registre de forma inmutable en `audit_logs`.
- **Dependencias:** TASK-006.
- **Archivos Involucrados:** `supabase/migrations/20261106000005_create_audit_logs.sql`.
- **Criterios de Aceptación:**
  1. Tabla `audit_logs` con permisos estrictos de `INSERT ONLY`.
  2. Prohibición absoluta de operaciones `UPDATE` o `DELETE` para cualquier rol.
- **Estado:** Pendiente.

---

## FASE 8: Pruebas Finales, Seguridad y Despliegue a Producción

### [ ] TASK-027 — Suite de pruebas E2E automatizadas con Playwright
- **Descripción:** Implementar y ejecutar la suite completa de pruebas E2E para el panel web cubriendo login, visualización de mapas, gestión de clientes y exportación de reportes.
- **Dependencias:** TASK-010, TASK-018, TASK-025.
- **Archivos Involucrados:** `apps/web/e2e/`.
- **Criterios de Aceptación:**
  1. 100% de las pruebas E2E pasando exitosamente en modo headless y navegadores Chromium/Firefox.
  2. Cero pruebas intermitentes (*flaky tests*).
- **Estado:** Pendiente.

### [ ] TASK-028 — Pruebas de integración de sincronización offline en Android
- **Descripción:** Ejecutar pruebas automatizadas y de campo simulando modo avión prolongado, reinicio del dispositivo en medio de una jornada y sincronización masiva de telemetría.
- **Dependencias:** TASK-014, TASK-015.
- **Archivos Involucrados:** `apps/android/app/src/androidTest/`.
- **Criterios de Aceptación:**
  1. Cero pérdida de puntos de telemetría tras desconexión forzada.
  2. Sincronización exitosa en Supabase al restaurar la conectividad.
- **Estado:** Pendiente.

### [ ] TASK-029 — Auditoría final de seguridad, RLS y verificación LOPDP
- **Descripción:** Realizar pruebas de penetración lógica (pentesting), verificación de políticas RLS para evitar fugas multi-tenant, análisis estático de código para evitar exposición de secretos y revisión de políticas de privacidad.
- **Dependencias:** Todas las tareas previas.
- **Archivos Involucrados:** Toda la base de código y documentación.
- **Criterios de Aceptación:**
  1. Comprobación de que no existen accesos cruzados entre organizaciones.
  2. Cero secretos en repositorios o bundles cliente.
  3. Verificación de que el rastreo GPS es imposible fuera de la jornada activa.
- **Estado:** Pendiente.

### [ ] TASK-030 — Pipeline CI/CD con GitHub Actions y despliegue a producción en Vercel
- **Descripción:** Configurar los flujos de GitHub Actions para ejecución automática de linters, pruebas de TypeScript y tests en cada Pull Request, configurando el despliegue automático del panel web en Vercel.
- **Dependencias:** TASK-027, TASK-029.
- **Archivos Involucrados:** `.github/workflows/ci.yml`, configuración de Vercel.
- **Criterios de Aceptación:**
  1. Workflow de CI ejecuta exitosamente `tsc`, linters y pruebas en GitHub Actions.
  2. Despliegue en producción en Vercel activo con HTTPS y variables de entorno configuradas.
- **Estado:** Pendiente.
