# ROUTRACK — Plataforma de Rastreo Geográfico, Supervisión Operativa y Auditoría Inmutable

Bienvenido al repositorio oficial de **ROUTRACK**, una solución integral empresarial diseñada específicamente para organizaciones comerciales que gestionan fuerzas de venta y distribución masiva en campo (preventistas, personal de autoventa y asesores técnicos en ruta).

---

## 1. Resumen Ejecutivo

ROUTRACK aborda de forma unificada la supervisión de campo y la integridad operativa mediante tres pilares:
1. **Aplicación Móvil Android Nativa (`mobile-android`):** Desarrollada en Kotlin con Jetpack Compose (Material 3). Funciona de forma 100% autónoma bajo arquitectura *Offline-First*, capturando telemetría adaptativa mediante un Foreground Service respaldado por el Fused Location Provider y Activity Recognition, persistiendo puntos y visitas en una base de datos local SQLite (Room) cifrada con SQLCipher y encolando la sincronización resiliente con WorkManager.
2. **Panel Web de Administración y Supervisión (`web-admin`):** Desarrollado en Next.js (App Router) con TypeScript estricto y Tailwind CSS. Integra un visor cartográfico interactivo con Leaflet y OpenStreetMap (sin APIs de pago), suscripciones en vivo, análisis histórico de trayectorias con cálculo de desvíos espaciales y bitácora de auditoría inmutable.
3. **Backend Serverless Unificado (`supabase`):** Base de datos relacional PostgreSQL 15+ con capacidades espaciales nativas mediante **PostGIS 3.3+**, aislamiento multi-tenant forzado mediante Row Level Security (RLS) y Supabase Edge Functions (`sync-jornada`) para validación criptográfica HMAC-SHA256 e ingesta idempotente por lotes.

---

## 2. Arquitectura de Alto Nivel

```text
[ Vendedores en Terreno ]                 [ Backend Cloud Supabase ]             [ Supervisores en Oficina ]
    App Móvil Android                        PostgreSQL + PostGIS                  Panel Web Next.js
 (Kotlin + Compose + Room)              (Auth, RLS, Storage, Functions)          (App Router + Leaflet)
         │                                            ▲                                     │
         │─── Ingesta Batch HTTPS (JWT) ─────────────┤                                     │
         │    (sync-jornada / HMAC SHA-256)           │◄─── Consultas Seguras RLS ──────────┤
         │                                           │◄─── Suscripción Realtime (WS) ──────┤
         └─── Foreground Service + Keystore          └─── PostGIS ST_DWithin (Geofencing)  └─── Dashboard & Reportes
```

---

## 3. Stack Tecnológico Oficial

| Capa / Módulo | Tecnología Seleccionada | Justificación Técnica |
| :--- | :--- | :--- |
| **Entorno de Desarrollo** | Google Antigravity | IDE asistido por IA para desarrollo consistente y riguroso. |
| **Control de Versiones** | Git + GitHub | Repositorio central privado (`XLN-GLR/Routrack`). |
| **App Móvil (UI)** | Kotlin + Jetpack Compose | Estándar oficial moderno declarativo de Google para Android (Material 3). |
| **Persistencia Local Móvil**| Room + SQLCipher | SQLite cifrado en reposo mediante hardware seguro (Android Keystore). |
| **Tareas Segundo Plano** | Android WorkManager | Encolado de sincronización tolerante a fallos con backoff exponencial. |
| **Ubicación Móvil** | Fused Location + Activity Recognition | Optimización de consumo de batería (< 5-7% por jornada de 8h). |
| **Servicio de Ejecución** | Android Foreground Service | Notificación persistente visible; mitigación de Doze Mode. |
| **Panel Web** | Next.js 14+ (App Router) + TS | Server Components para SSR rápido y rutas protegidas con `@supabase/ssr`. |
| **Estilos Web** | Tailwind CSS | Sistema de diseño modular y responsivo de cero costo de runtime. |
| **Cartografía Web** | Leaflet + OpenStreetMap | Visor de mapas ligero sin dependencias de APIs comerciales de pago ($0 USD). |
| **Backend / Base de Datos** | Supabase (PostgreSQL 15+) | BaaS serverless con autenticación integrada y escalabilidad automática. |
| **Motor Geoespacial** | Extensión PostGIS 3.3+ | Geometrías `GEOMETRY(Point, 4326)`, indexación GiST y geocercas `ST_DWithin`. |
| **Seguridad de Servidor** | Row Level Security (RLS) | Aislamiento inquebrantable multi-tenant a nivel de fila por `organization_id`. |
| **Lógica Serverless** | Supabase Edge Functions | Ingesta por lotes, verificación HMAC-SHA256 e idempotencia en Deno/TypeScript. |
| **Pruebas Automatizadas** | Playwright (E2E), JUnit 5/MockK | Pruebas web E2E en navegadores reales y pruebas unitarias de Kotlin. |
| **Despliegue Web** | Vercel / Cloudflare Pages | Alojamiento en capa gratuita (*Free Tier*) sin costos fijos. |

---

## 4. Estructura de Carpetas del Monorepo

```text
routrack/
├── .agent/rules/rules.md      # Reglas permanentes del agente para Google Antigravity
├── .agents/rules/rules.md     # Espejo de compatibilidad para reglas jerárquicas
├── docs/                      # Documentación técnica fundacional (Single Source of Truth)
│   ├── PRD.md                 # Product Requirement Document y alcance MVP
│   ├── ARCHITECTURE.md        # Arquitectura del sistema, esquema PostGIS y contratos
│   ├── DESIGN.md              # Sistema de diseño, paleta semántica y componentes UI
│   ├── TEST_PLAN.md           # Plan de pruebas, mitigación de spoofing y pirámide
│   ├── SECURITY.md            # Modelo de amenazas, RLS, SQLCipher y LOPDP Ecuador
│   ├── DECISIONS.md           # Architectural Decision Records (ADR-001 a ADR-008)
│   └── MEMORY.md              # Bitácora viva del estado y sincronización del proyecto
├── mobile-android/            # Aplicación Móvil Android Nativa (Kotlin + Compose)
├── supabase/                  # Backend Supabase (Migraciones SQL, PostGIS, Edge Functions)
├── web-admin/                 # Panel Web Administrativo (Next.js App Router + TypeScript)
├── .env.example               # Plantilla de variables de entorno seguras (sin secretos)
├── .gitignore                 # Exclusiones de Git unificadas para monorepo
├── AGENTS.md                  # Reglas del agente para Antigravity (estándar raíz)
├── GEMINI.md                  # Reglas del agente para Antigravity (estándar directorio)
├── README.md                  # Este documento
└── TASKS.md                   # Mapa de ruta secuencial estructurado por Vertical Slices
```

---

## 5. Instrucciones de Incorporación y Entorno Local

### 5.1. Requisitos Previos
- **Node.js:** Versión 18.x o 20.x LTS.
- **JDK:** Java Development Kit 17 o superior.
- **Android Studio / Android SDK:** SDK Platform 34+ con herramientas de compilación.
- **Supabase CLI & Docker:** Para ejecutar la base de datos y PostGIS localmente (`supabase start`).
- **Navegadores Playwright:** Instalables vía `npx playwright install`.

### 5.2. Pasos de Inicialización (Fase 1+)
1. **Clonar el Repositorio:**
   ```bash
   git clone https://github.com/XLN-GLR/Routrack.git
   cd Routrack
   ```
2. **Configurar Variables de Entorno:**
   Copiar la plantilla de ejemplo y completar los valores del proyecto de prueba:
   ```bash
   cp .env.example .env.local
   ```
3. **Levantar el Entorno Supabase Local:**
   ```bash
   supabase start
   ```

---

## 6. Metodología de Trabajo con Google Antigravity

El desarrollo de ROUTRACK sigue rigurosamente la **Programación Guiada por IA (Vibe Coding)** bajo supervisión de un Technical Lead:
- **Lectura Obligatoria:** Todo agente debe consultar `docs/` antes de cada tarea técnica.
- **Desarrollo por Vertical Slices:** El progreso se realiza tarea por tarea conforme a `TASKS.md`, abarcando desde la persistencia hasta la interfaz y las pruebas correspondientes.
- **Actualización Continua:** Al concluir cada tarea, es mandatorio actualizar `TASKS.md` y `docs/MEMORY.md`.
- **Cero Secretos:** Queda formalmente prohibida la exposición de credenciales privadas o la clave `SUPABASE_SERVICE_ROLE_KEY` en clientes o repositorios.
