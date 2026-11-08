# Product Requirement Document (PRD) — ROUTRACK

**Proyecto:** ROUTRACK  
**Tipo:** Plataforma B2B de Seguimiento GPS, Supervisión Operativa y Auditoría de Vendedores en Ruta  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Aprobado para Fase de Documentación  

---

## 1. Descripción del Producto

**ROUTRACK** es una plataforma integral B2B diseñada para empresas que operan con equipos comerciales y de distribución en campo (preventistas, personal de autoventa, asesores comerciales y técnicos en ruta). 

La plataforma proporciona un ecosistema compuesto por:
1. Una **aplicación móvil para Android** enfocada en el vendedor, que opera de manera transparente bajo una arquitectura *offline-first*, registrando de forma fidedigna y autorizada la jornada laboral, la telemetría GPS y el cumplimiento de visitas a clientes.
2. Un **panel web centralizado para supervisores y directores de operaciones**, que permite la visualización en tiempo real de los vendedores en ruta sobre mapas interactivos, el análisis de rutas históricas, la verificación georreferenciada de visitas y la generación de reportes de auditoría y rendimiento operativo.
3. Un **backend unificado sobre Supabase** (PostgreSQL + PostGIS) que garantiza un aislamiento estricto de datos por organización mediante políticas de seguridad a nivel de fila (*Row Level Security* - RLS) y una sincronización de datos altamente resiliente.

---

## 2. Problema que Resuelve

Las empresas que gestionan vendedores y personal en terreno enfrentan desafíos operativos y financieros críticos:

1. **Falta de visibilidad operativa en tiempo real:** Los supervisores desconocen la ubicación real del equipo, los tiempos reales de traslado y si las rutas asignadas se están ejecutando según lo programado.
2. **Fraude en visitas comerciales (visitas fantasma):** Prácticas en las que vendedores reportan haber visitado clientes sin haber estado físicamente en el punto de venta o permaneciendo lapsos insuficientes para una gestión efectiva.
3. **Pérdida de datos por falta de conectividad:** Las rutas comerciales en muchas zonas de América Latina (como Ecuador) atraviesan áreas sin cobertura celular continua. Las herramientas tradicionales fallan o pierden información crítica cuando no hay conexión a Internet.
4. **Fricción laboral y desconfianza:** La implementación de herramientas de monitoreo invasivas o no transparentes genera rechazo sindical y laboral. Se requiere un modelo claro, transparente y limitado estrictamente a la jornada de trabajo formal.
5. **Dificultad de auditoría y análisis de dispersión:** Imposibilidad de justificar gastos de combustible, kilometraje recorrido, paradas imprevistas o desviaciones significativas en las rutas planificadas.

---

## 3. Usuarios Objetivo (Personas)

| Rol | Descripción | Necesidad Principal |
| :--- | :--- | :--- |
| **Vendedor / Preventista en Ruta** *(Usuario Móvil)* | Asesor comercial que visita clientes en un área geográfica asignada. Utiliza un dispositivo Android provisto por la empresa o personal. | Interfaz rápida y sencilla para iniciar/cerrar jornada, ver su lista de clientes del día, registrar visitas sin fricción y trabajar sin preocuparse por la cobertura de datos. |
| **Supervisor de Ruta / Jefe de Ventas** *(Usuario Web)* | Responsable directo de coordinar a un equipo de 5 a 25 vendedores, optimizar tiempos de visita y velar por el cumplimiento de las metas comerciales. | Panel interactivo con mapa en tiempo real, alertas de desvíos, confirmación de visitas válidas y seguimiento del avance de la jornada. |
| **Super Administrador / Director de Operaciones** *(Usuario Web)* | Máxima autoridad operativa de la empresa. Gestiona la configuración global, las carteras de clientes, los usuarios y los parámetros organizacionales. | Visión macro del rendimiento de rutas, métricas globales de cumplimiento, control multi-sucursal y gestión de accesos. |
| **Auditor Operativo / Analista de Control Interno** *(Usuario Web)* | Encargado del control de calidad, prevención de fraudes y validación de tiempos y traslados reportados. | Informes detallados de discrepancias geográficas (mock locations, visitas registradas fuera de radio, tiempos muertos atípicos). |

---

## 4. Objetivos del Sistema

1. **Trazabilidad Continua y Confiable:** Capturar coordenadas GPS con intervalos regulares y precisión adecuada durante la jornada laboral activa, minimizando el consumo de batería en el dispositivo móvil (< 5% por jornada de 8 horas).
2. **Validación Georreferenciada de Visitas:** Verificar automáticamente mediante algoritmos espaciales (*geofencing* y distancia euclidiana/geodésica con PostGIS) si el vendedor se encontraba dentro del radio de tolerancia del cliente al momento de registrar la visita.
3. **Arquitectura Offline-First:** Garantizar que la app Android funcione de manera autónoma sin conexión a Internet, almacenando localmente jornadas, puntos de ruta y visitas, sincronizándolos automáticamente tan pronto se restablezca la conectividad.
4. **Transparencia y Privacidad Laboral:** Asegurar que el rastreo sea explícito, autorizado por el usuario y restringido estrictamente al lapso entre el inicio y el fin de la jornada de trabajo, con notificación permanente en el dispositivo móvil en cumplimiento con la normativa ecuatoriana (LOPDP).
5. **Experiencia de Usuario Fluida y Moderna:** Proveer un panel web rápido, reactivo y limpio que permita consultar mapas, reportes y listas sin recargas pesadas ni dependencias propietarias costosas.

---

## 5. Funcionalidades Principales

### 5.1. Módulo de Autenticación y Gestión de Organizaciones (Multi-Tenancy)
- Autenticación segura mediante correo electrónico y contraseña gestionada por Supabase Auth.
- Control de acceso basado en roles (RBAC): Super Administrador, Supervisor, Vendedor, Auditor.
- Aislamiento riguroso de datos por organización (`organization_id`) garantizado por políticas RLS en PostgreSQL.

### 5.2. Módulo de Clientes y Puntos de Venta
- Registro y mantenimiento de clientes: Razón social, identificación fiscal, dirección, teléfono, coordenadas geográficas exactas (latitud/longitud) y radio de tolerancia de visita (por defecto 50 metros).
- Visualización de clientes en mapa con filtros por zona o supervisor asignado.

### 5.3. Módulo Móvil de Jornadas Laborales (Android)
- **Check-in / Check-out de Jornada:** Inicio y cierre explícito de la jornada laboral mediante confirmación consciente del vendedor.
- **Servicio en Primer Plano (Foreground Service):** Notificación fija, persistente y visible en la barra de estado de Android indicando que ROUTRACK está monitoreando la ruta durante la jornada de trabajo.
- **Detención Automática del Monitoreo:** Al finalizar la jornada, el servicio de ubicación se destruye de inmediato; el dispositivo no registra ninguna ubicación fuera del horario de trabajo.

### 5.4. Módulo de Rastreo GPS y Telemetría
- Captura de puntos mediante Fused Location Provider de Google Play Services con precisión balanceada para optimización de batería.
- Registro de metadatos por punto: latitud, longitud, precisión (accuracy en metros), velocidad, nivel de batería, estado de conexión y marca de tiempo (`recorded_at`).
- Detección de anomalías de hardware y proveedores de ubicación simulada (*Mock Location Detection*).

### 5.5. Módulo de Visitas Comerciales en Campo
- Listado de visitas asignadas o clientes cercanos disponibles para el día.
- Registro de visita comercial con captura instantánea de coordenadas de check-in y check-out de visita.
- Validación automática de cercanía física contra las coordenadas del cliente.
- Captura opcional de notas comerciales y evidencia fotográfica asociada a la visita.

### 5.6. Módulo Web de Monitoreo en Vivo y Visualización de Rutas
- Mapa interactivo multi-capa (Leaflet) con marcadores diferenciados de vendedores activos, clientes y puntos de visita.
- Trazado de ruta recorrida (breadcrumbs / polilínea) con código de colores según velocidad y estado de movimiento.
- Resumen en tiempo real del estado de cada vendedor (en ruta, detenido en visita, jornada finalizada, sin señal).

### 5.7. Módulo de Auditoría y Reportes
- Detección y señalización de visitas sospechosas (realizadas fuera del radio de tolerancia o con duración menor a la estipulada).
- Registro inmutable de auditoría para eventos clave (inicio de jornada, alteración de datos, intentos de uso de ubicaciones falsas).
- Exportación de reportes de cumplimiento de jornada y visitas a formatos estándar (CSV / PDF).

---

## 6. Alcance del MVP (Minimum Viable Product)

El MVP tiene como meta poner en producción una versión robusta, estable y completamente funcional del ciclo básico de operación:

| Componente | Incluido en el MVP |
| :--- | :--- |
| **Backend & Base de Datos** | - Proyecto en Supabase con PostgreSQL y extensión PostGIS activa.<br>- Esquema inicial con tablas: `organizations`, `profiles`, `clients`, `work_shifts`, `tracking_points`, `visit_records`, `audit_logs`.<br>- Políticas de Row Level Security (RLS) para aislamiento estricto multi-tenant.<br>- Supabase Auth para usuarios y gestión de roles. |
| **Aplicación Móvil Android** | - Login con credenciales de vendedor.<br>- Inicio y fin explícito de jornada laboral con Foreground Service y notificación persistente.<br>- Captura periódica de ubicaciones (cada 3-5 minutos o por umbral de desplazamiento de 50m).<br>- Persistencia local en SQLite mediante Room.<br>- Sincronización en segundo plano hacia Supabase con WorkManager.<br>- Listado de clientes y botón para registrar visita (check-in / check-out con notas de texto).<br>- Detección básica de ubicaciones simuladas (`isFromMockProvider`). |
| **Panel Web (Next.js)** | - Login para Super Administradores y Supervisores.<br>- Gestión básica (CRUD) de clientes y vendedores.<br>- Mapa interactivo con Leaflet que muestra la última posición conocida de los vendedores activos.<br>- Vista de detalle de un vendedor: trazado de la polilínea de la jornada y lista de visitas registradas.<br>- Indicador de estado de visita (Dentro de radio / Fuera de radio).<br>- Exportación básica de resumen de jornada en CSV. |
| **Seguridad e Infraestructura** | - Cifrado seguro de tokens locales en Android Keystore con AES-256-GCM.<br>- Comunicaciones 100% cifradas vía HTTPS/TLS 1.3.<br>- Despliegue del frontend web en Vercel. |

---

## 7. Funcionalidades Fuera del Alcance (Out of Scope - Futuras Fases)

Las siguientes características quedan expresamente excluidas del MVP y se planificarán para versiones posteriores:

1. **Facturación Electrónica y Cobranzas:** No se procesarán pagos, cobros en efectivo ni emisión de comprobantes fiscales electrónicos ante el SRI de Ecuador en esta versión.
2. **Toma de Pedidos Compleja y Catálogo de Inventario:** No se implementará módulo de preventa de ítems con sincronización de stock de ERP en el MVP; el vendedor solo registra notas y estado de la visita.
3. **Optimización Automática de Rutas con IA / TSP:** En el MVP las rutas son asignadas de forma manual o estática; no se calculará la ruta matemática óptima en función del tráfico en tiempo real.
4. **Chat Interno o Mensajería Instantánea:** No se incluirá mensajería entre supervisor y vendedor dentro de la app móvil.
5. **Aplicación para iOS:** El soporte móvil inicial es exclusivo para dispositivos Android (versiones Android 8.0 Oreo / API 26 en adelante).
6. **Notificaciones Push Complejas con Firebase (FCM):** La sincronización y actualización se gestionará mediante polling inteligente y Supabase Realtime en web, y WorkManager en Android.
7. **Monitoreo Invasivo o Espía:** Queda estrictamente descartada la captura de pulsaciones de teclado (keylogger), lectura de mensajes privados de terceros (WhatsApp, redes sociales), captura de pantalla oculta o activación no autorizada de micrófonos y cámaras.

---

## 8. Requisitos Funcionales (RF)

- **RF-01 (Autenticación):** El sistema debe permitir el inicio de sesión mediante email y contraseña tanto en el panel web como en la app móvil.
- **RF-02 (Aislamiento de Organización):** Cada consulta y mutación debe estar restringida exclusivamente a la organización a la que pertenece el usuario autenticado.
- **RF-03 (Inicio de Jornada):** El vendedor debe iniciar explícitamente su jornada en la app Android mediante un botón claro, recibiendo confirmación visual.
- **RF-04 (Foreground Service Visible):** Durante la jornada activa, la app Android debe ejecutar un servicio en primer plano que mantenga una notificación no descartable con el estado "ROUTRACK en servicio — Registrando ruta laboral".
- **RF-05 (Captura de Telemetría):** El sistema móvil debe registrar latitud, longitud, precisión, velocidad y estampa de tiempo a intervalos configurables mientras la jornada esté activa.
- **RF-06 (Fin de Jornada):** El vendedor debe poder cerrar su jornada laboral; la app debe finalizar inmediatamente el servicio en primer plano y detener la recolección de coordenadas GPS.
- **RF-07 (Registro Offline):** Los puntos de telemetría y registros de visitas deben guardarse localmente en la base de datos Room sin requerir conectividad de red inmediata.
- **RF-08 (Sincronización Automática):** WorkManager debe verificar la disponibilidad de red y sincronizar por lotes los registros pendientes hacia Supabase.
- **RF-09 (Check-in de Visita):** El vendedor debe poder seleccionar un cliente y registrar su llegada, capturando fecha, hora y coordenadas GPS actuales.
- **RF-10 (Validación Espacial de Visita):** El sistema debe calcular la distancia entre las coordenadas del check-in y las coordenadas registradas del cliente, clasificando la visita como "Verificada" (dentro de radio) o "Fuera de Radio".
- **RF-11 (Visualización en Mapa Web):** El panel de supervisión debe renderizar un mapa interactivo con la ubicación en vivo de los vendedores en jornada activa.
- **RF-12 (Trazado de Recorrido):** El supervisor debe poder seleccionar un vendedor y una fecha específica para visualizar la polilínea completa de su recorrido, puntos de parada y visitas efectuadas.
- **RF-13 (Detección de Ubicación Falsa):** La app debe identificar si las coordenadas provienen de un proveedor simulado (*mock provider*) y marcar el punto como sospechoso en la base de datos.
- **RF-14 (Exportación de Datos):** El supervisor debe poder descargar reportes tabulares de jornadas y visitas en formato CSV.

---

## 9. Requisitos No Funcionales (RNF)

- **RNF-01 (Rendimiento Web):** El tiempo de carga inicial del panel web debe ser inferior a 2.0 segundos en conexiones estándar de banda ancha; las consultas de rutas no deben superar los 1.5 segundos.
- **RNF-02 (Consumo de Batería Móvil):** El servicio de rastreo en Android no debe consumir más del 5% al 7% de la batería del dispositivo durante una jornada laboral típica de 8 horas continuas.
- **RNF-03 (Consumo Eficiente de Datos Celulares):** La sincronización por lotes debe optimizar el payload en formato JSON comprimido, transfiriendo menos de 10 MB de datos por vendedor al mes en condiciones de operación estándar.
- **RNF-04 (Disponibilidad y Resiliencia Offline):** El almacenamiento local en Room debe ser capaz de retener hasta 15 días continuos de telemetría sin pérdida de información ante fallas prolongadas de conectividad.
- **RNF-05 (Seguridad en Tránsito y Reposo):** Todas las comunicaciones deben realizarse bajo HTTPS con TLS 1.3. Los datos de sesión y credenciales locales en Android deben cifrarse mediante Android Keystore con AES-256-GCM.
- **RNF-06 (Aislamiento de Datos):** La seguridad de acceso a los datos debe aplicarse a nivel de motor de base de datos mediante RLS de PostgreSQL, de modo que ningún error en el frontend web o móvil permita la filtración entre organizaciones.
- **RNF-07 (Compatibilidad Android):** Soporte garantizado para dispositivos con sistema operativo Android 8.0 (API nivel 26) o superior.
- **RNF-08 (Compatibilidad Web):** El panel web debe ser compatible con las últimas dos versiones estables de navegadores modernos basados en Chromium (Chrome, Edge), Firefox y Safari.
- **RNF-09 (Cumplimiento Legal LOPDP Ecuador):** El sistema debe garantizar los derechos del trabajador consagrados en la Ley Orgánica de Protección de Datos Personales, impidiendo el rastreo fuera de horario y asegurando la finalidad legítima de la información recolectada.

---

## 10. Criterios Generales de Aceptación

1. **Transparencia Total de Rastreo:** El rastreo únicamente opera cuando existe una jornada abierta explícitamente y con notificación visible en Android. Al presionar "Finalizar Jornada", cesa de forma total e inmediata la recolección de coordenadas.
2. **Tolerancia a Cortes de Red:** Una simulación de jornada completa en "Modo Avión" debe almacenar todos los puntos y visitas en el teléfono y transmitirlos íntegramente a Supabase al reactivar la conexión, sin pérdida ni duplicación de registros.
3. **Cero Fuga entre Organizaciones:** Ningún usuario autenticado perteneciente a la Empresa A debe poder leer, escribir o inferir información perteneciente a la Empresa B.
4. **Precisión Espacial Verificable:** La distancia calculada entre el punto de check-in y la geocerca del cliente debe coincidir con precisión métrica respecto a la fórmula geográfica ejecutada en PostGIS.
5. **Estabilidad del Servicio en Segundo Plano:** El servicio de ubicación de Android no debe ser cerrado arbitrariamente por el sistema operativo durante la jornada, manteniendo el canal de notificación activo de acuerdo con los estándares de Android Oreo y versiones posteriores.
