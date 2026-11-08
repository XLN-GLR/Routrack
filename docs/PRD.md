# Product Requirement Document (PRD) — ROUTRACK

**Proyecto:** ROUTRACK  
**Tipo de Producto:** Plataforma B2B SaaS de Rastreo Geográfico, Supervisión Operativa y Auditoría Inmutable para Fuerzas de Venta en Ruta  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Documento Fundacional Oficial (Aprobado)  
**Autor:** Senior Software Engineer, Cloud/Mobile Solutions Architect & Technical Lead  

---

## 1. Las 5 Preguntas Clave del Producto

### 1.1. ¿Qué problema resuelve?
Las organizaciones comerciales y de distribución masiva que gestionan flotas de asesores de ventas, preventistas y personal técnico en campo experimentan pérdidas económicas significativas y fricción operativa debido a cinco problemas críticos:

1. **Opacidad operativa y falta de visibilidad en tiempo real:** Los supervisores carecen de telemetría certera sobre la posición geográfica de sus equipos, desconocen si se están respetando las rutas planificadas, los tiempos reales de traslado o los lapsos de detención improductiva en el transcurso del día.
2. **Fraude en visitas comerciales ("visitas fantasma"):** Es recurrente que el personal reporte haber visitado clientes o levantado pedidos sin haberse personado físicamente en las instalaciones del cliente, o registrando check-ins desde puntos remotos para falsear el cumplimiento de metas comerciales.
3. **Pérdida de datos e inoperatividad por falta de conectividad:** Gran parte de las rutas comerciales en América Latina (especialmente en sectores rurales y suburbanos de Ecuador) transcurren por zonas con señal celular intermitente o inexistente. Las herramientas web móviles tradicionales fallan, pierden registros de ventas o bloquean el flujo de trabajo del asesor cuando no hay acceso a Internet.
4. **Vulnerabilidad legal y fricción laboral por monitoreo invasivo:** La implementación de software de control tipo "spyware" (keyloggers, acceso a chats personales, activación no autorizada de micrófonos o rastreo 24/7) vulnera los derechos laborales y normativas de privacidad como la **Ley Orgánica de Protección de Datos Personales (LOPDP)** de Ecuador, generando multas severas, rechazo de sindicatos y baja adopción por parte de los trabajadores.
5. **Falta de inmutabilidad y cadena de custodia en auditorías:** Ante disputas laborales, auditorías de inventario o validación de acuerdos de precios, las empresas no poseen bitácoras inalterables que certifiquen el momento, lugar exacto, estado del dispositivo y autoría de cada transacción operativa.

### 1.2. ¿Quién es el usuario objetivo?
La plataforma está diseñada específicamente para tres perfiles de usuario corporativo claramente segregados:

| Perfil de Usuario | Entorno de Interacción | Responsabilidades y Necesidades Principales |
| :--- | :--- | :--- |
| **Vendedor / Preventista de Campo** | Aplicación Móvil Android nativa | Asesor comercial que realiza visitas diarias puerta a puerta a clientes minoristas y mayoristas. Necesita una herramienta ágil y fluida para marcar su inicio y cierre de jornada, consultar su lista de clientes asignados, validar check-ins en tienda, registrar compromisos comerciales y acuerdos de precios, garantizando que su trabajo se guarde de forma autónoma aun en áreas sin cobertura celular y sin agotar la batería de su dispositivo personal o corporativo. |
| **Supervisor de Ruta / Jefe de Ventas** | Panel Web Administrativo (Escritorio / Tablet) | Responsable del control de 5 a 30 asesores en calle. Requiere supervisar en un mapa interactivo la posición en vivo y última hora de reporte de sus vendedores, analizar polilíneas de recorridos históricos, validar si las visitas se ejecutaron dentro del radio permitido (geocerca) y detectar desvíos significativos de la ruta planificada en tiempo real. |
| **Administrador General / Director de Operaciones** | Panel Web Administrativo (Escritorio) | Máxima autoridad operativa y directiva de la empresa. Precisa configurar las carteras de clientes, parametrizar tolerancias de geocercas, administrar usuarios y roles, auditar la bitácora inmutable de eventos del sistema (incidentes de seguridad, apagados de GPS, falsificaciones de ubicación) y exportar reportes de jornada y rendimiento comercial a nivel consolidado. |

### 1.3. ¿Cuál es el resultado principal?
El resultado principal de ROUTRACK es **garantizar una trazabilidad operativa fehaciente, transparente y con validez de auditoría sobre el 100% de la fuerza de ventas en ruta**, transformando la supervisión comercial mediante:
- **Cero visitas simuladas:** Toda visita requiere presencia física validada en motor geoespacial (PostGIS) a través de coordenadas de alta precisión.
- **Operación continua 100% Offline-First:** Los asesores completan su jornada íntegra sin interrupciones técnicas independientemente del estado de la red celular.
- **Transparencia ética y regulatoria:** Se establece una estricta delimitación del rastreo geográfico, confinado única y exclusivamente a los límites de la jornada laboral formal autorizada por el empleado, protegiendo tanto la integridad jurídica de la compañía como la intimidad del trabajador.
- **Coste de infraestructura $0 USD en fase inicial:** Aprovechamiento óptimo de las capas gratuitas (Free Tier) de Supabase, Vercel y OpenStreetMap/Leaflet sin tarifas por consumo de APIs de mapas comerciales.

### 1.4. ¿Cuál es el alcance del MVP (Minimum Viable Product)?
El MVP abarca un sistema verticalmente integrado, funcional de extremo a extremo, que comprende:
1. **Infraestructura Backend Serverless en Supabase:**
   - Base de datos relacional PostgreSQL 15+ con extensión espacial PostGIS activada.
   - Aislamiento multi-inquilino (*multi-tenant*) forzado en el 100% de tablas mediante Row Level Security (RLS) dependiente del `organization_id` en el JWT.
   - Edge Function `sync-jornada` para recepción por lotes, verificación de firmas de integridad y persistencia idempotente.
   - Supabase Auth gestionando credenciales y emisión de tokens JWT con claims de rol y organización.
2. **Aplicación Móvil Android Nativa (Kotlin + Jetpack Compose):**
   - Interfaz de usuario declarativa reactiva implementando Material 3.
   - Autenticación con persistencia segura de tokens en Android Keystore (AES-256-GCM).
   - Control explícito de inicio y fin de jornada laboral activando un Android Foreground Service con notificación permanente no descartable.
   - Captura GPS adaptativa con Fused Location Provider, optimizada para mitigar consumo de batería mediante Activity Recognition y mitigación de Doze Mode.
   - Base de datos local SQLite mediante Room cifrada con SQLCipher.
   - Motor de sincronización en segundo plano con WorkManager, encolado de lotes, reintentos con backoff exponencial e idempotencia.
   - Registro de visitas presenciales con check-in georreferenciado, captura de observaciones, acuerdos de precios pactados y compromisos.
   - Detección nativa de aplicaciones de ubicación simulada (*Mock Location Providers*) y discrepancias temporales de reloj.
3. **Panel Web Administrativo (Next.js App Router + TypeScript + Tailwind CSS):**
   - Autenticación segura mediante `@supabase/ssr` con cookies HttpOnly y protección de rutas por roles (ADMIN, SUPERVISOR).
   - Módulo de visualización geográfica con Leaflet y OpenStreetMap (marcador de vendedor en movimiento, detenido, visitas verificadas y fuera de radio).
   - Vista de histórico de jornada con trazado de polilínea y cálculo visual de desvíos respecto a los clientes visitados.
   - Catálogo de clientes con georreferenciación (latitud, longitud y radio de tolerancia en metros).
   - Tablas de auditoría inmutable con visualización de eventos de sistema y exportación de reportes de jornada a formato CSV con codificación UTF-8 BOM.

### 1.5. ¿Qué queda estrictamente fuera de alcance (Out of Scope)?
Para preservar el foco del MVP, la arquitectura ágil y la meta de costo cero, quedan formalmente excluidas las siguientes funcionalidades:
- **No soporte para dispositivos Apple iOS:** La aplicación móvil está construida exclusivamente para Android nativo (API 26+). No se desarrollará cliente iOS en el MVP.
- **No pasarelas de pago ni cobranzas electrónicas:** No se procesarán transacciones monetarias con tarjetas de crédito, débito, transferencias bancarias directas ni emisión de comprobantes fiscales tributarios electrónicos (facturación electrónica SRI).
- **No chat en vivo ni mensajería instantánea interna:** Las comunicaciones interpersonales continúan gestionándose por los canales corporativos existentes; no se construirá un cliente de chat dentro de la app móvil ni en la web.
- **No optimización de rutas predictiva por IA / TSP dinámico:** No se implementarán algoritmos predictivos de ruteo basados en aprendizaje automático ni cálculo del problema del viajante de comercio (Traveling Salesperson Problem) en tiempo real con tráfico en vivo.
- **No APIs comerciales de mapas de pago:** Queda estrictamente prohibido el uso de APIs de pago como Google Maps Platform (Maps SDK, Geocoding API, Places API, Directions API) o Mapbox Paid Tiers. Se empleará exclusivamente Leaflet con teselas de OpenStreetMap y cálculos geoespaciales nativos en PostGIS.

---

## 2. Requerimientos Funcionales (RF)

### RF-01: Captura y transmisión GPS adaptativa con trazado histórico
- **Descripción:** El sistema móvil debe capturar la posición geográfica del vendedor de manera periódica y adaptativa mientras la jornada laboral esté formalmente abierta.
- **Mecanismo:** Empleo del `FusedLocationProviderClient` de Google Play Services, configurando intervalos de captura de entre 180 y 300 segundos en condiciones estándar, o ante un desplazamiento espacial superior a 50 metros.
- **Adaptabilidad:** Si el sensor de acelerometría y reconocimiento de actividad física (`ActivityRecognitionClient`) determina que el vendedor está estático (ej. en reunión o estacionado), el intervalo de muestreo GPS debe espaciarse para mitigar consumo de batería; si se detecta velocidad de tránsito vehicular, el muestreo se intensifica.
- **Trazado Histórico:** Cada punto capturado debe registrar latitud, longitud, altitud, precisión horizontal (en metros), velocidad, orientación (bearing), nivel de batería, estado de simulación (is_mock) y marca de tiempo UTC. En el backend, las secuencias de puntos se consolidan en polilíneas geométricas vinculadas al identificador único de jornada (`shift_id`).

### RF-02: Registro explícito de actividades comerciales
- **Descripción:** El vendedor en campo debe disponer de un flujo ágil e intuitivo para documentar formalmente cada gestión comercial presencial realizada en el establecimiento de un cliente.
- **Componentes del Registro:**
  1. **Check-in / Check-out presencial:** Captura obligatoria de coordenadas GPS en alta precisión al ingresar y egresar del punto de venta.
  2. **Validación de Geocerca:** Cálculo geodésico inmediato de la distancia física entre el vendedor y las coordenadas del cliente (`ST_DWithin` en PostGIS). Si la distancia es menor o igual al radio de tolerancia (por defecto 50 metros), la visita se clasifica de forma automática como `VERIFIED`; en caso contrario se clasifica como `OUT_OF_RANGE`.
  3. **Notas y Observaciones de Campo:** Campo de texto libre para detallar acuerdos verbales, stock encontrado o incidencias.
  4. **Precios Pactados y Compromisos:** Registro estructurado de condiciones pactadas (montos acordados, descuentos convenidos, fechas de reposición de producto o promesas de pedido).

### RF-03: Consolidación de reportes diarios de jornada y cálculo de desvíos
- **Descripción:** La plataforma debe totalizar y procesar los indicadores operativos de cada vendedor al concluir su jornada laboral.
- **Métricas Consolidadas:**
  - Hora real de inicio, hora real de fin y tiempo total efectivo de servicio.
  - Distancia total recorrida acumulada en kilómetros (calculada a lo largo de la polilínea espacial en PostGIS).
  - Conteo total de clientes asignados vs. clientes visitados efectivamente (tasa de cobertura comercial).
  - Desglose de visitas: porcentaje de visitas verificadas en rango vs. visitas fuera de geocerca.
- **Cálculo de Desvíos:** Identificación algorítmica de puntos de trayectoria y paradas no autorizadas que se aparten del corredor geográfico de los clientes de la ruta diaria, permitiendo al supervisor inspeccionar desviaciones en el panel web.

### RF-04: Bitácora inmutable de eventos del sistema
- **Descripción:** El sistema debe registrar un historial de auditoría de solo inserción (*append-only*), criptográficamente protegido, que certifique los eventos operativos y anomalías de seguridad ocurridas durante la jornada.
- **Eventos Obligatorios a Auditar:**
  - Inicio de turno laboral y cierre de turno laboral (con nivel de batería y posición geográfica).
  - Evento de apagado voluntario del sensor GPS o revocación de permisos de ubicación por parte del usuario.
  - Evento de pérdida prolongada de señal satelital o imposibilidad de obtención de fix GPS.
  - Detección de activación de proveedores de ubicación simulada (*Mock Location Provider*).
  - Discrepancias temporales detectadas (manipulación manual del reloj del sistema del teléfono frente al tiempo de red).
  - Intentos de sincronización y respuestas de la Edge Function.

---

## 3. Requerimientos No Funcionales (RNF)

### RNF-01: Optimización de batería y ejecución en segundo plano
- **Impacto Energético:** El impacto de la aplicación móvil sobre la batería del dispositivo no debe superar el 5% al 7% de la capacidad de la batería en una jornada laboral estándar continua de 8 horas.
- **Mitigación de Doze Mode y App Standby:** En versiones modernas de Android (Android 9.0 a 14+), el sistema operativo suspende procesos en segundo plano para ahorrar energía. ROUTRACK debe utilizar un **Foreground Service debidamente tipificado** (`foregroundServiceType="location"`), complementado con `ActivityRecognitionClient` para pausar llamadas innecesarias al GPS durante paradas prolongadas, y encolar las sincronizaciones de red mediante WorkManager sujeto a restricciones de conectividad y batería suficiente.

### RNF-02: Transmisión segura TLS 1.3, cifrado local AES-256 y cadena de custodia criptográfica
- **Cifrado en Tránsito:** Toda transmisión de datos entre la aplicación móvil, el panel web y el backend de Supabase debe ejecutarse obligatoriamente bajo HTTPS con TLS 1.3 forzado.
- **Cifrado en Reposo Móvil:** La base de datos local SQLite (Room) en el dispositivo Android debe residir cifrada en reposo mediante **SQLCipher**, cuya clave maestra de 256 bits se genera y custodia en el hardware seguro del dispositivo (**Android Keystore System**) utilizando `AES/GCM/NoPadding`.
- **Cadena de Custodia Criptográfica (Hash Chaining):** Cada registro de auditoría y punto de telemetría emitido por el cliente móvil debe incorporar un hash encadenado HMAC-SHA256 calculado sobre la carga útil y el hash del registro inmediato anterior ($Hash_n = \text{HMAC}(Payload_n + Hash_{n-1}, K)$), asegurando que ninguna fila pueda ser alterada, borrada o inyectada a posteriori sin romper la integridad matemática de la cadena.

### RNF-03: Compatibilidad nativa con Android (Foreground Services)
- **Compatibilidad del Sistema Operativo:** Soporte completo y nativo a partir de Android 8.0 (API nivel 26 - Oreo) hasta Android 14+ (API nivel 34).
- **Foreground Service Obligatorio:** Durante todo el tiempo en que la jornada esté abierta, la aplicación debe mantener un servicio en primer plano vinculado a una notificación persistente, de baja prioridad sonora pero visualmente visible en la barra de estado del sistema, con título claro y canal de notificación dedicado (`NotificationChannel`), impidiendo que el motor de gestión de memoria del fabricante (OEM killers como MIUI o EMUI) termine el proceso del sistema.

---

## 4. Criterios Generales de Aceptación del Producto

Para considerar que la plataforma ROUTRACK satisface los estándares de producción de su MVP, deben verificarse satisfactoriamente los siguientes criterios:

1. **Garantía Estricta de Privacidad Laboral:** El rastreo satelital inicia únicamente tras la acción consciente del vendedor al presionar "Iniciar Jornada". Al presionar "Finalizar Jornada", el servicio se destruye en memoria de inmediato y se garantiza el cese total de recolección de ubicaciones.
2. **Resiliencia Total Offline-First:** Si un vendedor opera en modo desconectado (Modo Avión activado) durante 8 horas continuas registrando decenas de puntos y visitas, toda la información debe preservarse íntegra en la base de datos Room cifrada local, y transmitirse de forma idempotente sin duplicaciones ni pérdidas al reconectarse a Internet.
3. **Aislamiento Multi-Inquilino Absoluto:** Bajo ninguna condición una consulta web o móvil de la Empresa A puede devolver, actualizar o eliminar registros pertenecientes a la Empresa B. La barrera de aislamiento se valida a nivel de motor PostgreSQL mediante Row Level Security (RLS).
4. **Verificación Geoespacial Certificada:** La categorización de visitas en `VERIFIED` o `OUT_OF_RANGE` calculada en Supabase debe basarse en funciones geodésicas en metros (`ST_DWithin` sobre elipsoide WGS 84 / SRID 4326), con un margen de tolerancia exacto y auditable.
5. **Cero Dependencia de Servicios de Pago:** La arquitectura debe operar enteramente sobre infraestructura de costo cero en su fase inicial (Leaflet con OpenStreetMap, Supabase Free Tier, Vercel Hobby Tier).
