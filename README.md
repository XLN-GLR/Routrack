# ROUTRACK — Plataforma de Seguimiento GPS, Supervisión Operativa y Auditoría de Vendedores en Ruta

Bienvenido al repositorio oficial de **ROUTRACK**, una solución integral diseñada para empresas con equipos comerciales y de distribución en terreno (preventistas, personal de autoventa y asesores técnicos en ruta).

---

## 1. ¿Qué es ROUTRACK?

ROUTRACK es una plataforma B2B orientada a optimizar la gestión en campo de fuerzas de ventas. Combina:
- Una **aplicación móvil nativa en Android** para el vendedor que opera bajo un modelo *offline-first*, recolectando de forma confiable, transparente y autorizada la telemetría GPS durante su jornada laboral y permitiendo el registro ágil de visitas a puntos de venta.
- Un **panel web centralizado de supervisión** para jefes de ventas, supervisores y auditores que permite visualizar en tiempo real a los vendedores en mapa interactivo, auditar rutas recorridas, verificar proximidad a clientes mediante geocercas y exportar métricas de cumplimiento.
- Una **infraestructura backend unificada en Supabase** con base de datos PostgreSQL y la extensión geoespacial PostGIS, garantizando aislamiento multi-tenant estricto mediante políticas de seguridad a nivel de fila (*Row Level Security* - RLS).

---

## 2. ¿Qué Problema Resuelve?

1. **Falta de visibilidad de equipos en campo:** Elimina la incertidumbre sobre la ubicación, desplazamientos y estado de los vendedores durante el horario de trabajo.
2. **Fraude en visitas comerciales (visitas simuladas o fantasma):** Valida matemáticamente mediante PostGIS si el vendedor estuvo físicamente en el local del cliente al registrar la visita (radio de tolerancia de geocerca).
3. **Pérdida de datos por intermitencia de red:** Su arquitectura *offline-first* asegura que la app móvil registre coordenadas y visitas en zonas sin cobertura celular, sincronizándolas automáticamente al recuperar la señal.
4. **Privacidad y transparencia laboral:** Cumple estrictamente con la normativa de protección de datos (LOPDP de Ecuador). El rastreo GPS es explícito, notificado de forma permanente en el teléfono y restringido exclusivamente a la jornada de trabajo activa. Cero monitoreo invasivo, cero espionaje de aplicaciones personales.
5. **Auditoría operativa y control de costos:** Identifica tiempos muertos injustificados, paradas excesivas, manipulación de GPS (*mock locations*) y calcula distancias reales recorridas.

---

## 3. Tecnologías Utilizadas

| Componente | Tecnología Principal |
| :--- | :--- |
| **Entorno de Desarrollo** | Google Antigravity |
| **Control de Versiones** | Git + GitHub |
| **Aplicación Móvil** | Android nativo (Kotlin, Jetpack Compose, Room DB, WorkManager) |
| **Telemetría y GPS** | Google Play Services Fused Location Provider + Android Foreground Service |
| **Seguridad Móvil** | Android Keystore System + AES-256-GCM |
| **Panel Web** | Next.js (App Router) + React + TypeScript en modo estricto |
| **Estilos Web** | Tailwind CSS |
| **Cartografía Web** | Leaflet + React-Leaflet con proveedor de tiles configurable |
| **Backend & Base de Datos** | Supabase (PostgreSQL 15+ con extensión PostGIS) |
| **Autenticación** | Supabase Auth (JWT con claims de organización y roles RBAC) |
| **Seguridad de Servidor** | Row Level Security (RLS) en todas las tablas |
| **Lógica Serverless** | Supabase Edge Functions (Deno / TypeScript) |
| **Pruebas Automatizadas** | Playwright (E2E Web), JUnit 5 + MockK (Android), pgTAP (RLS) |
| **Despliegue Web** | Vercel |

> *Nota:* Supabase actúa como el backend unificado inicial; no se incorpora un backend separado en FastAPI ni Express (ADR-001).

---

## 4. Arquitectura General

```text
[ Vendedores en Campo ]                 [ Backend Cloud Supabase ]             [ Supervisores en Oficina ]
   App Móvil Android                        PostgreSQL + PostGIS                  Panel Web Next.js
 (Kotlin + Compose + Room)              (Auth, RLS, Storage, Functions)          (App Router + Leaflet)
         │                                            ▲                                     │
         │─── Ingesta Batch HTTPS (JWT) ─────────────┤                                     │
         │    (Puntos GPS y Visitas)                 │◄─── Consultas Seguras RLS ──────────┤
         │                                           │◄─── Suscripción Realtime (WS) ──────┤
         └─── Foreground Service + Keystore          └─── PostGIS ST_DWithin (Geofencing)  └─── Dashboard & Reportes
```

---

## 5. Estructura del Repositorio

```text
routrack/
├── .agent/rules/             # Reglas del agente para Google Antigravity
├── docs/                     # Documentación fundacional detallada
│   ├── PRD.md                # Requisitos del producto y alcance MVP
│   ├── ARCHITECTURE.md       # Arquitectura técnica, esquema DB y flujos
│   ├── DESIGN.md             # Sistema de diseño, paleta y componentes UI
│   ├── TEST_PLAN.md          # Estrategia de pruebas y criterios de aceptación
│   ├── SECURITY.md           # Políticas de seguridad, RLS y LOPDP Ecuador
│   ├── DECISIONS.md          # Architectural Decision Records (ADRs 001-008)
│   └── MEMORY.md             # Estado vivo del proyecto y bitácora técnica
├── apps/                     # Código fuente de las aplicaciones (Fase 1+)
│   ├── web/                  # Aplicación Web Next.js (App Router)
│   └── android/              # Aplicación Móvil Android (Kotlin + Compose)
├── supabase/                 # Migraciones SQL, seed y Edge Functions
├── .env.example              # Plantilla de variables de entorno (sin secretos)
├── .gitignore                # Exclusiones de Git para Android, Node y credenciales
├── AGENTS.md                 # Reglas de Antigravity (estándar raíz)
├── GEMINI.md                 # Reglas de Antigravity (estándar directorio)
├── TASKS.md                  # Plan maestro de tareas y seguimiento de avance
└── README.md                 # Este documento
```

---

## 6. Documentación Disponible

Para consultar los detalles completos de diseño, ingeniería y gobernanza del proyecto, revise los siguientes documentos en la carpeta [`docs/`](file:///docs/):

- 📋 [**PRD.md**](file:///docs/PRD.md): Especificación de requisitos del producto, alcance del MVP y exclusiones.
- 🏗️ [**ARCHITECTURE.md**](file:///docs/ARCHITECTURE.md): Diseño de arquitectura, esquema de base de datos PostGIS, flujo de sincronización y responsabilidades.
- 🎨 [**DESIGN.md**](file:///docs/DESIGN.md): Sistema de diseño visual, paleta de colores, tipografía, componentes y estados de interfaz.
- 🧪 [**TEST_PLAN.md**](file:///docs/TEST_PLAN.md): Estrategia de pruebas unitarias, de integración, E2E con Playwright y pruebas móviles offline.
- 🔒 [**SECURITY.md**](file:///docs/SECURITY.md): Políticas de seguridad, aislamiento multi-tenant RLS, Android Keystore y cumplimiento de la LOPDP de Ecuador.
- 📜 [**DECISIONS.md**](file:///docs/DECISIONS.md): Registro de decisiones de arquitectura (ADR-001 a ADR-008).
- 🧠 [**MEMORY.md**](file:///docs/MEMORY.md): Memoria viva del estado actual del proyecto, bloqueos y siguientes pasos.
- 📌 [**TASKS.md**](file:///TASKS.md): Plan secuencial de desarrollo dividido en 9 fases y 30 tareas atómicas.

---

## 7. Estado Actual del Proyecto

- **Fase Actual:** **Fase 0 — Investigación y Documentación Fundacional.**
- **Hito Reciente:** Completada la tarea `TASK-001`, estableciendo las bases conceptuales, arquitectónicas, operativas y de seguridad del sistema.
- **Próximo Paso:** `TASK-002`, inicialización de la estructura de directorios y configuración base de los entornos.

---

## 8. Requisitos Futuros para Ejecutar el Proyecto

Cuando inicie la implementación en las Fases 1 en adelante, se requerirá contar con:
- **Node.js:** Versión 18.x o superior LTS.
- **npm / pnpm / yarn:** Gestor de paquetes de Node.
- **Java Development Kit (JDK):** JDK 17 o superior (para compilación de Android).
- **Android Studio / Android SDK:** SDK Platform 34+, Android Build Tools, emulador o dispositivo físico con Android 8.0+.
- **Supabase CLI & Docker:** Para levantar el entorno local de Supabase con PostgreSQL y PostGIS (`supabase start`).
- **Navegadores para Pruebas E2E:** Chromium / Firefox instalados mediante Playwright (`npx playwright install`).

---

## 9. Metodología de Trabajo con Google Antigravity

El desarrollo de ROUTRACK se rige bajo una metodología estricta de **programación guiada por IA (Vibe Coding)** asistida por el IDE **Google Antigravity**:
- **Reglas Permanentes:** Definidas en `GEMINI.md` y `AGENTS.md`. Obligan a leer la documentación antes de cada tarea, validar código en cliente y servidor, no exponer secretos y no avanzar sin verificar.
- **Vertical Slices:** Cada tarea aborda una porción funcional completa, medible y probada.
- **Actualización Continua:** Al culminar cada tarea se actualizan `TASKS.md` y `docs/MEMORY.md`.
- **Integridad Documental:** La documentación se mantiene sincronizada con el código real en todo momento.

---

## 10. Licencia y Confidencialidad

Proyecto privado. Todos los derechos reservados. No publicar credenciales, claves API ni variables de entorno sensibles en este repositorio.
