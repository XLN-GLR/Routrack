# Registro de Decisiones de Arquitectura (ADR) — ROUTRACK

**Proyecto:** ROUTRACK  
**Documento:** Architectural Decision Records (ADRs)  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Base Oficial  

---

## Índice de Decisiones

- [ADR-001: Supabase como backend inicial](#adr-001-supabase-como-backend-inicial)
- [ADR-002: Next.js + TypeScript para el panel web](#adr-002-nextjs--typescript-para-el-panel-web)
- [ADR-003: Kotlin + Jetpack Compose para Android](#adr-003-kotlin--jetpack-compose-para-android)
- [ADR-004: PostgreSQL + PostGIS para datos geográficos](#adr-004-postgresql--postgis-para-datos-geográficos)
- [ADR-005: Row Level Security (RLS) para el aislamiento de datos](#adr-005-row-level-security-rls-para-el-aislamiento-de-datos)
- [ADR-006: Vercel para el despliegue del panel web](#adr-006-vercel-para-el-despliegue-del-panel-web)
- [ADR-007: GitHub como sistema de control de versiones](#adr-007-github-como-sistema-de-control-de-versiones)
- [ADR-008: Desarrollo incremental mediante vertical slices](#adr-008-desarrollo-incremental-mediante-vertical-slices)

---

### ADR-001: Supabase como backend inicial

- **Estado:** Aceptado
- **Fecha:** Noviembre 2026
- **Contexto:**
  Para el desarrollo del MVP de ROUTRACK se requiere una infraestructura backend que ofrezca autenticación robusta, base de datos relacional de nivel empresarial con soporte espacial, capacidades en tiempo real y almacenamiento de archivos. Inicialmente se consideró construir una API independiente utilizando FastAPI (Python) o Express (Node.js). Sin embargo, desarrollar y mantener una API REST personalizada desde cero para todas las operaciones CRUD y autenticación incrementaría drásticamente los tiempos de desarrollo, la complejidad operativa y los costos de infraestructura en la fase inicial.
- **Decisión:**
  Adoptar **Supabase** como backend unificado para el MVP. No se construirá un backend independiente en FastAPI ni Express. Se aprovecharán directamente las capacidades nativas de Supabase: PostgreSQL con PostGIS, Supabase Auth, Row Level Security (RLS), Supabase Storage y Edge Functions (Deno/TypeScript) para casos de procesamiento específico.
- **Justificación:**
  1. Reduce el tiempo de salida al mercado (time-to-market) a menos de la mitad para el MVP.
  2. Ofrece PostgreSQL nativo sin capas intermedias que degraden el rendimiento de consultas espaciales.
  3. Soporta suscripciones en tiempo real mediante WebSockets integradas con PostgreSQL.
  4. La seguridad se delega a políticas RLS probadas directamente en el motor de base de datos.
- **Consecuencias:**
  - *Positivas:* Menor código de infraestructura que mantener; alta velocidad de iteración; seguridad centralizada en base de datos; costos operativos iniciales mínimos.
  - *Negativas:* Acoplamiento a las APIs y convenciones de Supabase (PostgREST). Si en el futuro se requiere lógica transaccional hipercompleja no ejecutable en Edge Functions o triggers SQL, se evaluará añadir microservicios específicos.

---

### ADR-002: Next.js + TypeScript para el panel web

- **Estado:** Aceptado
- **Fecha:** Noviembre 2026
- **Contexto:**
  El panel de supervisión requiere renderizar mapas interactivos, procesar listas de vendedores en tiempo real, filtrar información histórica y ofrecer tiempos de carga inmediatos para supervisores comerciales y directores de operaciones.
- **Decisión:**
  Utilizar **Next.js (App Router)** junto con **TypeScript en modo estricto** (`strict: true`) y **Tailwind CSS** para los estilos.
- **Justificación:**
  1. *Server Components (RSC):* Permite consultar datos de Supabase desde el servidor de forma segura, reduciendo el bundle de JavaScript en el cliente y eliminando tiempos de carga iniciales vacíos.
  2. *TypeScript Estricto:* Garantiza la solidez del código, autocompletado y prevención de errores de tipado comunes al manipular datos geoespaciales complejos y telemetría.
  3. *Tailwind CSS:* Proporciona un sistema de diseño consistente, altamente optimizado y sin costo de procesamiento en tiempo de ejecución.
  4. *Ecosistema React:* Facilidad de integración con bibliotecas de mapas como Leaflet y librerías de componentes accesibles (Radix UI / Shadcn).
- **Consecuencias:**
  - *Positivas:* Rendimiento sobresaliente, SEO y tiempo hasta el primer contenido interactivo mínimo; facilidad para separar lógica de servidor y componentes interactivos de cliente.
  - *Negativas:* Curva de aprendizaje del modelo mental de Server Components / Client Components en Next.js.

---

### ADR-003: Kotlin + Jetpack Compose para Android

- **Estado:** Aceptado
- **Fecha:** Noviembre 2026
- **Contexto:**
  Los vendedores en ruta operan en campo bajo condiciones variables de red, requieren un consumo optimizado de batería y necesitan una aplicación rápida y confiable. Se evaluaron opciones multiplataforma como React Native o Flutter frente a desarrollo nativo en Android.
- **Decisión:**
  Desarrollar la aplicación móvil de manera **nativa en Kotlin utilizando Jetpack Compose**, con arquitectura Clean Architecture + MVVM, Room Database y WorkManager.
- **Justificación:**
  1. *Acceso Nativo a Hardware:* El rastreo continuo en segundo plano requiere interacción directa y sin capas intermedias con el `FusedLocationProviderClient`, `ForegroundService` y `Android Keystore`.
  2. *Gestión de Batería y Memoria:* Android impone restricciones severas a servicios en segundo plano desde Android 8.0 y 12+. El desarrollo nativo en Kotlin asegura el cumplimiento exacto del ciclo de vida del sistema operativo.
  3. *Jetpack Compose:* Es el estándar oficial de Google para interfaces declarativas en Android, acelerando el desarrollo de pantallas modernas, reactivas y fáciles de probar.
  4. *Offline-First Nativo:* Room y WorkManager ofrecen el soporte más robusto de la industria para persistencia local y sincronización garantizada tolerante a fallos.
- **Consecuencias:**
  - *Positivas:* Rendimiento óptimo, consumo mínimo de batería, acceso sin restricciones a APIs de bajo nivel de Android y estabilidad del Foreground Service.
  - *Negativas:* El soporte inicial está restringido a Android (no hay cliente iOS para el MVP). Dado que el 95%+ de los dispositivos corporativos de preventa en el mercado objetivo son Android, este compromiso es estratégico y viable.

---

### ADR-004: PostgreSQL + PostGIS para datos geográficos

- **Estado:** Aceptado
- **Fecha:** Noviembre 2026
- **Contexto:**
  ROUTRACK fundamenta su valor en el análisis de coordenadas GPS: trazado de polilíneas de ruta, cálculo de distancias recorridas y validación de proximidad a clientes mediante geocercas (*geofencing*). Se requería una solución de persistencia con soporte espacial de primer nivel.
- **Decisión:**
  Utilizar **PostgreSQL con la extensión espacial PostGIS** como estándar único de almacenamiento geográfico, adoptando el tipo `geography(Point, 4326)`.
- **Justificación:**
  1. PostGIS es el estándar mundial indiscutido para sistemas de información geográfica (SIG/GIS).
  2. Cálculos espaciales exactos sobre la curvatura de la Tierra (elipsoide WGS 84 / EPSG 4326) mediante funciones nativas altamente optimizadas (`ST_Distance`, `ST_DWithin`, `ST_MakeLine`).
  3. Soporte de índices espaciales GiST (*Generalized Search Tree*), que permiten filtrar millones de puntos de ubicación en milisegundos.
  4. Evita realizar cálculos pesados de trigonometría en el servidor de aplicaciones o en clientes de bajos recursos.
- **Consecuencias:**
  - *Positivas:* Precisión métrica comprobada, rendimiento en consultas de proximidad inigualable y compatibilidad nativa con herramientas GIS.
  - *Negativas:* Requiere que el equipo comprenda la diferencia entre geometrías planas (`geometry`) y esferoidales (`geography`), así como el uso adecuado de índices espaciales GiST.

---

### ADR-005: Row Level Security (RLS) para el aislamiento de datos

- **Estado:** Aceptado
- **Fecha:** Noviembre 2026
- **Contexto:**
  ROUTRACK es una plataforma multi-tenant donde convivirán múltiples empresas u organizaciones competidoras en la misma base de datos. Una fuga de información geográfica o de clientes entre dos empresas sería catastrófica para el negocio y violaría las normativas legales vigentes.
- **Decisión:**
  Implementar **Row Level Security (RLS)** en el 100% de las tablas públicas de la base de datos PostgreSQL, condicionando todas las operaciones al `organization_id` inyectado en el JWT de Supabase Auth.
- **Justificación:**
  1. *Seguridad en la Fuente:* La regla de aislamiento no reside en el código de la aplicación web o móvil (donde un desarrollador podría olvidar un `WHERE organization_id = ...`), sino en el motor de la base de datos.
  2. *Auditoría Simplificada:* Es posible auditar y verificar matemáticamente las políticas de acceso revisando exclusivamente los archivos de migración SQL.
  3. *Acceso Directo Seguro:* Permite que tanto la app móvil como el panel web consulten la API de Supabase de forma directa y segura con la clave anónima (`anon key`).
- **Consecuencias:**
  - *Positivas:* Aislamiento garantizado, prevención de fallas humanas en filtros de frontend, menor código repetitivo de autorización.
  - *Negativas:* Toda consulta compleja debe considerar el costo de evaluación de las políticas RLS; se requiere indexar meticulosamente las columnas de partición (`organization_id`).

---

### ADR-006: Vercel para el despliegue del panel web

- **Estado:** Aceptado
- **Fecha:** Noviembre 2026
- **Contexto:**
  Se necesita una plataforma de despliegue confiable, automatizada y escalable para la aplicación web Next.js, con soporte nativo de Serverless y Edge Functions, sin requerir la configuración de servidores virtuales manuales (VPS) en esta etapa.
- **Decisión:**
  Desplegar el panel web de ROUTRACK en **Vercel**, vinculado directamente al repositorio de GitHub del proyecto.
- **Justificación:**
  1. Creadores y mantenedores de Next.js, garantizando compatibilidad 100% sin fricciones con App Router, Server Components y optimización de imágenes.
  2. Despliegues continuos (CI/CD) automáticos por cada rama y pull request con URLs de vista previa (*Preview Deployments*).
  3. Red global de distribución de contenido (CDN) de baja latencia con certificados SSL/TLS automáticos.
- **Consecuencias:**
  - *Positivas:* Configuración inicial en minutos, cero mantenimiento de servidores Linux, alta disponibilidad y escalabilidad automática.
  - *Negativas:* Acoplamiento al ecosistema de hosting de Vercel. Si en el futuro se requiere auto-hospedaje (*self-hosting*), Next.js puede empaquetarse en un contenedor Docker estándar (Standalone Output).

---

### ADR-007: GitHub como repositorio y control de versiones

- **Estado:** Aceptado
- **Fecha:** Noviembre 2026
- **Contexto:**
  El equipo requiere una plataforma colaborativa para el versionamiento seguro del código fuente, revisión de documentación, integración continua y trazabilidad de cambios.
- **Decisión:**
  Utilizar **GitHub** como repositorio central privado (`XLN-GLR/Routrack`), empleando la rama `main` como rama principal protegida.
- **Justificación:**
  1. Estándar de la industria para desarrollo de software moderno con amplia integración con Google Antigravity, Vercel y herramientas de análisis estático.
  2. Soporte nativo para flujos de trabajo basados en tareas e incidencias (Issues, Pull Requests, GitHub Actions).
  3. Historial de commits inmutable y trazable.
- **Consecuencias:**
  - *Positivas:* Integración transparente con todo el stack técnico, gestión de ramas estandarizada y respaldo seguro del código.
  - *Negativas:* Dependencia del servicio en la nube de GitHub.

---

### ADR-008: Desarrollo incremental mediante vertical slices

- **Estado:** Aceptado
- **Fecha:** Noviembre 2026
- **Contexto:**
  El desarrollo con agentes de IA requiere metodologías disciplinadas para evitar la dispersión de esfuerzos, alucinaciones o la creación de capas técnicas desconectadas (por ejemplo, crear 15 tablas en la base de datos sin tener cómo probarlas en la app móvil o el panel web).
- **Decisión:**
  Organizar el desarrollo mediante **Vertical Slices (rebanadas verticales de funcionalidad)** estructuradas en tareas atómicas (`TASK-xxx`). Cada tarea debe abarcar la funcionalidad mínima verificable de extremo a extremo, acompañada de sus respectivas pruebas y documentación.
- **Justificación:**
  1. Permite validar continuamente el producto en funcionamiento real en cada etapa.
  2. Facilita la detección temprana de discrepancias entre las APIs de Supabase, la app Android y el panel web.
  3. Mantiene el contexto de los agentes de IA enfocado y acotado, minimizando errores y retrabajos.
- **Consecuencias:**
  - *Positivas:* Progreso medible y tangible en cada tarea; pruebas continuas; código siempre en estado funcional.
  - *Negativas:* Requiere una planificación inicial exhaustiva (documentada en `TASKS.md`) para secuenciar correctamente las dependencias.
