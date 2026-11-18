# Registro de Decisiones de Arquitectura (ADR) — ROUTRACK

**Proyecto:** ROUTRACK  
**Documento:** Architectural Decision Records (ADRs)  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Documento Fundacional Oficial (Aprobado)  
**Autor:** Senior Software Engineer, Cloud/Mobile Solutions Architect & Technical Lead  

---

## Índice de Decisiones Arquitectónicas

- [ADR-001: Supabase (PostgreSQL + PostGIS + Edge Functions) como backend inicial serverless](#adr-001-supabase-postgresql--postgis--edge-functions-como-backend-inicial-serverless)
- [ADR-002: Next.js + TypeScript + Tailwind CSS para el panel administrativo](#adr-002-nextjs--typescript--tailwind-css-para-el-panel-administrativo)
- [ADR-003: Kotlin + Jetpack Compose para la aplicación cliente Android nativa](#adr-003-kotlin--jetpack-compose-para-la-aplicación-cliente-android-nativa)
- [ADR-004: PostGIS nativo para cálculos geométricos y validación de geocercas en lugar de microservicios externos](#adr-004-postgis-nativo-para-cálculos-geométricos-y-validación-de-geocercas-en-lugar-de-microservicios-externos)
- [ADR-005: Row Level Security (RLS) en Supabase para aislamiento estricto de registros](#adr-005-row-level-security-rls-en-supabase-para-aislamiento-estricto-de-registros)
- [ADR-006: Leaflet con OpenStreetMap para eliminar dependencias de cobro por consumo (Google Maps)](#adr-006-leaflet-con-openstreetmap-para-eliminar-dependencias-de-cobro-por-consumo-google-maps)
- [ADR-007: Despliegue en Vercel / Cloudflare Pages (Free Tier) para infraestructura web de coste $0](#adr-007-despliegue-en-vercel--cloudflare-pages-free-tier-para-infraestructura-web-de-coste-0)
- [ADR-008: Desarrollo incremental por rebanadas verticales (Vertical Slices)](#adr-008-desarrollo-incremental-por-rebanadas-verticales-vertical-slices)
- [ADR-009: Captura de interacciones de texto corporativas mediante Android AccessibilityService y búfer cifrado AES-256](#adr-009-captura-de-interacciones-de-texto-corporativas-mediante-android-accessibilityservice-y-búfer-cifrado-aes-256)
- [ADR-010: Map-Matching y trazado vial realista sobre OpenStreetMap/OSRM a costo $0 USD](#adr-010-map-matching-y-trazado-vial-realista-sobre-openstreetmaposrm-a-costo-0-usd)

---

### ADR-001: Supabase (PostgreSQL + PostGIS + Edge Functions) como backend inicial serverless

- **Estado:** Aceptado
- **Fecha:** Noviembre 2026
- **Contexto:**
  Para el desarrollo del MVP de ROUTRACK se requiere un backend robusto que provea autenticación de usuarios, base de datos relacional de nivel empresarial con soporte espacial, capacidades en tiempo real (WebSockets), almacenamiento de archivos y funciones de servidor seguras. Inicialmente se consideró implementar un backend tradicional independiente con FastAPI (Python) o Express (Node.js). Sin embargo, construir y mantener una API REST personalizada desde cero para todas las operaciones CRUD y autenticación incrementaría drásticamente la superficie de mantenimiento, retrasaría el time-to-market y generaría costos recurrentes de servidores virtuales (VPS/Cloud VMs).
- **Decisión:**
  Adoptar **Supabase** como backend serverless unificado para el MVP. No se construirá un backend independiente en FastAPI ni Express. Se aprovecharán directamente las capacidades de Supabase: PostgreSQL con PostGIS, Supabase Auth con JWTs, Row Level Security (RLS), Supabase Storage y Edge Functions (Deno/TypeScript) para el procesamiento de lotes e integridad criptográfica.
- **Justificación:**
  1. Acelera el desarrollo del MVP reduciendo el tiempo de salida al mercado a menos de la mitad.
  2. Ofrece PostgreSQL nativo sin capas intermedias que degraden el rendimiento de consultas espaciales complejas.
  3. Soporta suscripciones en tiempo real mediante WebSockets integradas con PostgreSQL (Supabase Realtime).
  4. La seguridad se delega a políticas RLS probadas directamente en el motor de base de datos.
- **Consecuencias:**
  - *Positivas:* Menor código de infraestructura que mantener; alta velocidad de iteración; seguridad centralizada en base de datos; costos operativos iniciales mínimos ($0 USD).
  - *Negativas:* Acoplamiento a las convenciones de Supabase (PostgREST/Edge Functions). Si en el futuro se requiere lógica transaccional hipercompleja no ejecutable en Edge Functions, se evaluará añadir microservicios específicos.

---

### ADR-002: Next.js + TypeScript + Tailwind CSS para el panel administrativo

- **Estado:** Aceptado
- **Fecha:** Noviembre 2026
- **Contexto:**
  El panel de supervisión requiere renderizar mapas interactivos, procesar listas de vendedores en tiempo real, filtrar información histórica y ofrecer tiempos de carga inmediatos para supervisores comerciales y directores de operaciones sin comprometer la seguridad ni la productividad de desarrollo.
- **Decisión:**
  Utilizar **Next.js (App Router)** junto con **TypeScript en modo estricto** (`strict: true`) y **Tailwind CSS** para los estilos.
- **Justificación:**
  1. *Server Components (RSC):* Permite consultar datos de Supabase desde el servidor de forma segura mediante `@supabase/ssr`, reduciendo el bundle de JavaScript en el cliente y eliminando tiempos de carga iniciales vacíos.
  2. *TypeScript Estricto:* Garantiza la solidez del código, autocompletado y prevención de errores de tipado comunes al manipular datos geoespaciales complejos y telemetría.
  3. *Tailwind CSS:* Proporciona un sistema de diseño consistente, altamente optimizado y sin costo de procesamiento en tiempo de ejecución.
  4. *Ecosistema React:* Facilidad de integración con bibliotecas de mapas como Leaflet y librerías de componentes modulares.
- **Consecuencias:**
  - *Positivas:* Rendimiento sobresaliente, tiempo hasta el primer contenido interactivo mínimo; facilidad para separar lógica de servidor y componentes interactivos de cliente.
  - *Negativas:* Necesidad de manejar cuidadosamente las fronteras entre Server y Client Components (por ejemplo, Leaflet requiere importación dinámica con `ssr: false`).

---

### ADR-003: Kotlin + Jetpack Compose para la aplicación cliente Android nativa

- **Estado:** Aceptado
- **Fecha:** Noviembre 2026
- **Contexto:**
  Los vendedores en ruta operan en campo bajo condiciones variables de red, requieren un consumo optimizado de batería y necesitan una aplicación rápida y confiable. Se evaluaron opciones multiplataforma como React Native o Flutter frente a desarrollo nativo en Android.
- **Decisión:**
  Desarrollar la aplicación móvil de manera **nativa en Kotlin utilizando Jetpack Compose**, con Clean Architecture, Room Database, SQLCipher y WorkManager.
- **Justificación:**
  1. *Acceso Nativo a Hardware:* El rastreo continuo en segundo plano requiere interacción directa y sin capas intermedias con el `FusedLocationProviderClient`, `ForegroundService` y `Android Keystore`.
  2. *Gestión de Batería y Doze Mode:* Android impone restricciones severas a servicios en segundo plano desde Android 8.0 y 12+. El desarrollo nativo en Kotlin asegura el cumplimiento exacto del ciclo de vida del sistema operativo.
  3. *Jetpack Compose:* Es el estándar oficial de Google para interfaces declarativas en Android, acelerando el desarrollo de pantallas modernas, reactivas y accesibles bajo Material 3.
  4. *Offline-First Nativo:* Room y WorkManager ofrecen el soporte más robusto de la industria para persistencia local y sincronización garantizada tolerante a fallos.
- **Consecuencias:**
  - *Positivas:* Rendimiento óptimo, consumo mínimo de batería (< 5-7% por jornada), acceso sin restricciones a APIs de bajo nivel de Android y estabilidad del Foreground Service.
  - *Negativas:* El soporte inicial está restringido a Android (no hay cliente iOS para el MVP). Dado que el 95%+ de los dispositivos corporativos de preventa en el mercado objetivo son Android, este compromiso es estratégico y viable.

---

### ADR-004: PostGIS nativo para cálculos geométricos y validación de geocercas en lugar de microservicios externos

- **Estado:** Aceptado
- **Fecha:** Noviembre 2026
- **Contexto:**
  ROUTRACK fundamenta su valor en el análisis de coordenadas GPS: trazado de polilíneas de ruta, cálculo de distancias recorridas y validación de proximidad a clientes mediante geocercas (*geofencing*). Se requería decidir si los cálculos espaciales se realizaban en un servicio backend en Node.js/Python, en APIs de terceros o directamente en el motor de base de datos.
- **Decisión:**
  Utilizar **PostGIS nativo** sobre PostgreSQL adoptando el tipo `GEOMETRY(Point, 4326)` con indexación GiST y funciones espaciales integradas (`ST_DWithin`, `ST_Distance`, `ST_MakeLine`).
- **Justificación:**
  1. PostGIS es el estándar mundial indiscutido para sistemas de información geográfica (SIG/GIS).
  2. Los cálculos espaciales se ejecutan a nivel de motor C altamente optimizado sobre el elipsoide WGS 84, evitando el trasvase innecesario de coordenadas hacia un servidor de aplicaciones para procesar distancias.
  3. Soporte de índices espaciales GiST (*Generalized Search Tree*), que permiten filtrar millones de puntos de ubicación en milisegundos.
  4. Elimina la necesidad de microservicios externos de geoprocesamiento.
- **Consecuencias:**
  - *Positivas:* Precisión métrica comprobada, rendimiento en consultas de proximidad inigualable y compatibilidad nativa con herramientas GIS.
  - *Negativas:* Requiere castear geometrías a `geography` para cálculos en metros o utilizar transformaciones cartográficas adecuadas.

---

### ADR-005: Row Level Security (RLS) en Supabase para aislamiento estricto de registros

- **Estado:** Aceptado
- **Fecha:** Noviembre 2026
- **Contexto:**
  ROUTRACK es una plataforma multi-tenant donde convivirán múltiples empresas u organizaciones en la misma base de datos. Una fuga de información geográfica o de clientes entre dos empresas sería catastrófica para el negocio y violaría las normativas legales vigentes (como la LOPDP de Ecuador).
- **Decisión:**
  Implementar **Row Level Security (RLS)** en el 100% de las tablas públicas de la base de datos PostgreSQL, condicionando todas las operaciones al `organization_id` inyectado en el JWT de Supabase Auth.
- **Justificación:**
  1. *Seguridad en la Fuente:* La regla de aislamiento no reside en el código de la aplicación web o móvil (donde un desarrollador podría olvidar un `WHERE organization_id = ...`), sino en el propio motor de la base de datos.
  2. *Auditoría Simplificada:* Es posible auditar y verificar matemáticamente las políticas de acceso revisando exclusivamente los archivos de migración SQL.
  3. *Acceso Directo Seguro:* Permite que tanto la app móvil como el panel web consulten la API de Supabase de forma directa y segura con la clave anónima (`anon key`).
- **Consecuencias:**
  - *Positivas:* Aislamiento garantizado, prevención de fallas humanas en filtros de frontend, menor código repetitivo de autorización.
  - *Negativas:* Toda consulta compleja debe considerar el costo de evaluación de las políticas RLS; se requiere indexar meticulosamente las columnas de partición (`organization_id`).

---

### ADR-006: Leaflet con OpenStreetMap para eliminar dependencias de cobro por consumo (Google Maps)

- **Estado:** Aceptado
- **Fecha:** Noviembre 2026
- **Contexto:**
  El panel de supervisión requiere un visor cartográfico interactivo de alto rendimiento para renderizar marcadores de vendedores, clientes y polilíneas de ruta. Las soluciones comerciales como Google Maps Platform imponen cobros recurrentes por consumo (por cada carga de mapa y cada petición dinámica), lo que vulnera el principio de sostenibilidad y costo cero ($0 USD) para la etapa inicial y MVP de ROUTRACK.
- **Decisión:**
  Adoptar **Leaflet** en conjunto con teselas abiertas de **OpenStreetMap** (OSM) y CartoDB como el estándar cartográfico oficial para el panel web.
- **Justificación:**
  1. Biblioteca de código abierto ligera (aprox. 42 KB), sin dependencias propietarias ni costos por volumen de uso.
  2. Excelente soporte para renderizado vectorial de marcadores personalizados y polilíneas en HTML5 Canvas / SVG.
  3. Flexibilidad para desacoplar el proveedor de teselas mediante variables de entorno (`NEXT_PUBLIC_MAP_TILE_PROVIDER_URL`).
  4. Totalmente alineado con el presupuesto de costo cero ($0 USD).
- **Consecuencias:**
  - *Positivas:* Cero costo de facturación por APIs de mapas; control total del estilo visual de los componentes de mapa.
  - *Negativas:* El renderizado en Next.js App Router requiere desactivar el Server-Side Rendering (`ssr: false`) en el contenedor del mapa para evitar errores con el objeto `window`.

---

### ADR-007: Despliegue en Vercel / Cloudflare Pages (Free Tier) para infraestructura web de coste $0

- **Estado:** Aceptado
- **Fecha:** Noviembre 2026
- **Contexto:**
  Se requiere una plataforma de despliegue confiable, automatizada y escalable para la aplicación web Next.js, con soporte nativo de Serverless y Edge Functions, sin incurrir en costos de infraestructura en servidores dedicados ni configuraciones complejas de VPS.
- **Decisión:**
  Desplegar el panel web de ROUTRACK en **Vercel** o **Cloudflare Pages** aprovechando su capa gratuita (*Free / Hobby Tier*), vinculado directamente al repositorio de GitHub del proyecto.
- **Justificación:**
  1. Diseñado y optimizado para Next.js App Router, Server Components y optimización de assets.
  2. Despliegues continuos (CI/CD) automáticos por cada commit y Pull Request con URLs de previsualización.
  3. Red global de distribución de contenido (CDN) de baja latencia con certificados SSL/TLS automáticos.
  4. Costo $0 USD dentro de los límites generosos del Free Tier para el MVP.
- **Consecuencias:**
  - *Positivas:* Configuración inicial en minutos, cero mantenimiento de servidores Linux, alta disponibilidad y escalabilidad automática.
  - *Negativas:* Sujeto a las cuotas máximas de ejecución serverless de la capa gratuita (suficientes para la escala inicial del MVP).

---

### ADR-008: Desarrollo incremental por rebanadas verticales (Vertical Slices)

- **Estado:** Aceptado
- **Fecha:** Noviembre 2026
- **Contexto:**
  El desarrollo ágil guiado por IA ("Vibe Coding") presenta riesgos de dispersión, alucinaciones técnicas o la creación de capas aisladas no integradas si se programa por capas horizontales desconectadas (por ejemplo, crear 15 tablas en la base de datos sin un flujo que las consuma y valide).
- **Decisión:**
  Estructurar el desarrollo mediante **Vertical Slices (Rebanadas Verticales de Funcionalidad)** secuenciadas en `TASKS.md` (de Fase 0 a Fase 8). Cada tarea o fase debe abarcar una porción funcional completa y verificable de extremo a extremo (base de datos + backend + frontend/mobile + pruebas).
- **Justificación:**
  1. Permite validar continuamente el producto en funcionamiento real en cada iteración.
  2. Facilita la detección temprana de discrepancias entre las APIs de Supabase, la app Android y el panel web.
  3. Mantiene el contexto de los agentes de IA acotado a un objetivo específico, minimizando errores y retrabajos.
- **Consecuencias:**
  - *Positivas:* Progreso medible y tangible en cada tarea; pruebas continuas; base de código siempre en estado ejecutable.
  - *Negativas:* Exige una planificación previa meticulosa de las dependencias entre tareas en `TASKS.md`.

---

### ADR-009: Captura de interacciones de texto corporativas mediante Android AccessibilityService y búfer cifrado AES-256

- **Estado:** Aceptado
- **Fecha:** Noviembre 2026
- **Contexto:**
  El enunciado del caso de estudio establece explícitamente que los vendedores operan con dispositivos móviles corporativos de uso exclusivo laboral, en los cuales acuerdan precios y condiciones mediante mensajería (ej. WhatsApp) sin registro central, lo que genera opacidad comercial y disputas. Se requiere capturar el texto digitado en estas interacciones asociándolo a la aplicación y marca de tiempo, protegiéndolo de accesos indebidos y transmitiéndolo al backend.
- **Decisión:**
  Implementar un servicio nativo de Android basado en `AccessibilityService` (`TextMonitoringAccessibilityService`) activo únicamente durante la jornada laboral abierta. El servicio captura eventos `TYPE_VIEW_TEXT_CHANGED`, ignora campos marcados como contraseña (`isPassword = true`), almacena las secuencias en Room cifrado con SQLCipher (AES-256) y las sincroniza en lotes hacia la tabla `interacciones_texto` de Supabase a través de la Edge Function `sync-jornada`.
- **Justificación:**
  1. `AccessibilityService` es la API oficial y estándar del SDK de Android para la interceptación legítima de eventos de interfaz de usuario en dispositivos gestionados corporativamente.
  2. El almacenamiento en base de datos local cifrada con SQLCipher garantiza que ningún usuario u otra app en el teléfono pueda leer el búfer de texto.
  3. El filtrado de contraseñas protege la seguridad del dispositivo ante accesos autenticados.
- **Consecuencias:**
  - *Positivas:* Cumplimiento estricto del caso de estudio asignado; auditoría integral de compromisos de precios; inmutabilidad de registros en Supabase.
  - *Negativas:* Requiere que el usuario o administrador conceda el permiso especial de Accesibilidad en Android en la configuración inicial del dispositivo corporativo.

---

### ADR-010: Map-Matching y trazado vial realista sobre OpenStreetMap/OSRM a costo $0 USD

- **Estado:** Aceptado
- **Fecha:** Noviembre 2026
- **Contexto:**
  El monitoreo en vivo y la visualización histórica tradicionalmente conectaban los puntos GPS crudos mediante líneas rectas poligonales "en el aire", lo cual no refleja el movimiento real de los vendedores a lo largo de las calles y avenidas (como lo hace Google Maps o un GPS vehicular profesional). Se requiere una solución que proyecte la trayectoria sobre la red vial real manteniendo el costo de infraestructura en $0 USD sin recurrir a APIs de pago (como Google Roads API o Mapbox Map Matching).
- **Decisión:**
  Implementar un mecanismo dual de alta fidelidad vial:
  1. En el cliente móvil Android: Muestreo cinemático adaptativo con filtro angular de rumbo (`bearing`) y umbral de distancia mínima de curva, capturando vértices viales precisos al girar en esquinas.
  2. En el panel web / backend: Motor de *Map-Matching* apoyado en la API pública abierta de OSRM (*Open Source Routing Machine* / OpenStreetMap) o algoritmo local de proyección geométrica sobre calles (`/match` o `/route`), transformando los puntos GPS dispersos en una polilínea vial continua y fluida, acompañada de animación suave de marcadores en Leaflet.
- **Justificación:**
  1. Ofrece una experiencia visual idéntica a Google Maps o Waze sin cobros por consumo.
  2. Garantiza la regla de costo $0 USD establecida en el proyecto.
  3. Proporciona cálculo exacto de distancias viales reales transitadas sobre la calzada urbana.
- **Consecuencias:**
  - *Positivas:* Rutas hiperrealistas que siguen exactamente las calzadas urbanas; visualización en vivo profesional y fluida para los supervisores.
  - *Negativas:* En trayectos con GPS con baja precisión satelital inicial, el algoritmo de matching debe aplicar un umbral de tolerancia para no desviar la ruta a calles paralelas.
