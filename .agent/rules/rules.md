# Reglas Permanentes de Desarrollo — ROUTRACK
# Google Antigravity Agent Rules

Estas reglas operativas son de cumplimiento **estricto, ineludible y permanente** para cualquier agente de inteligencia artificial o desarrollador que opere en el proyecto **ROUTRACK**. Toda propuesta de arquitectura, edición de archivos, generación de código o comando debe regirse rigurosamente por los siguientes 11 mandatos fundamentales:

---

### 1. Lectura obligatoria de `docs/` antes de cada tarea
Antes de iniciar cualquier acción técnica o análisis, es mandatorio inspeccionar y leer la documentación fundacional correspondiente en `docs/` (`PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, `TEST_PLAN.md`, `SECURITY.md`, `DECISIONS.md`, `MEMORY.md`) y el plan de trabajo en `TASKS.md`. Ninguna tarea debe asumirse ni comenzarse a ciegas sin verificar los contratos e interfaces predefinidos.

### 2. Prohibición estricta de modificar archivos fuera del alcance de la tarea activa
Cada tarea tiene un alcance explícito y delimitado. Queda terminantemente prohibido alterar archivos, dependencias, refactorizar módulos no relacionados o crear código fuera de la lista de archivos involucrados autorizados para la tarea en curso.

### 3. No inventar funcionalidades no pedidas ni expandir el MVP
El desarrollo debe apegarse con precisión a los requerimientos del producto detallados en `docs/PRD.md`. Está estrictamente vetado incorporar características fuera de alcance (*Out of Scope*), tales como soporte iOS, pasarelas de pago, chats internos, optimización predictiva por IA o mapas de pago.

### 4. No cambiar el stack tecnológico pactado ni agregar librerías de pago
El stack tecnológico oficial acordado en `docs/DECISIONS.md` y `docs/ARCHITECTURE.md` es inmutable:
- **Backend:** Supabase unificado (PostgreSQL 15+, PostGIS 3.3+, Supabase Auth, Storage, Edge Functions). Prohibido añadir backends independientes en FastAPI o Express.
- **Web:** Next.js (App Router) + TypeScript + Tailwind CSS + Leaflet (OpenStreetMap). Cero APIs de pago como Google Maps Platform o Mapbox comercial.
- **Mobile:** Android nativo en Kotlin + Jetpack Compose (Material 3) + Room + SQLCipher + WorkManager + Fused Location Provider.
- **Despliegue y Pruebas:** Vercel (Free Tier) y Playwright. Cero infraestructura de pago ($0 USD).

### 5. TypeScript estricto (sin `any`) y Kotlin idiomático inmutable
- En `web-admin` y `supabase/functions`, todo código debe compilar en TypeScript con `strict: true`. Se prohíbe el uso de `any`, aserciones ciegas de tipo (`as unknown`) o directivas `@ts-ignore` sin justificación de fuerza mayor.
- En `mobile-android`, todo código debe escribirse en Kotlin idiomático, priorizando la inmutabilidad (`val`, data classes inmutables, `StateFlow`), Clean Architecture y corrutinas estructuradas.

### 6. No duplicar lógica y mantener modularidad en servicios
Aplicar con rigurosidad el principio DRY (*Don't Repeat Yourself*). Las funciones auxiliares, transformadores geodésicos y validadores deben centralizarse en módulos reutilizables desacoplados (`lib/`, `utils/`, servicios de dominio). La UI jamás contendrá lógica de negocio ni acceso directo a la base de datos.

### 7. Cero exposición de secretos o claves maestras en repositorios
Está terminantemente prohibido incluir en el código, confirmar en Git o exponer en el cliente web o móvil credenciales reales, tokens privados, contraseñas de base de datos o la `SUPABASE_SERVICE_ROLE_KEY`. Se utilizará únicamente `.env.example` para documentación y variables de entorno seguras en tiempo de ejecución.

### 8. Validación de entradas en cliente y servidor (Zod)
Toda entrada de datos, sea un formulario de usuario o un paquete de telemetría de campo, debe validarse en doble capa:
1. En el cliente para brindar retroalimentación instantánea con mensajes claros en español.
2. En el servidor mediante esquemas de validación estrictos con **Zod** y restricciones/triggers en PostgreSQL.

### 9. Obligatoriedad de políticas RLS para toda tabla creada
Toda tabla en la base de datos PostgreSQL debe tener activado obligatoriamente **Row Level Security (RLS)** (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`). Toda política de acceso debe validar el aislamiento multi-tenant por `organization_id` y restringir operaciones según los roles definidos (`ADMIN`, `SUPERVISOR`, `VENDEDOR`).

### 10. Prohibición de dar por superada una prueba sin haberla ejecutado
El agente jamás debe afirmar, insinuar o dar por aprobada una prueba, suite de tests o compilación sin haber ejecutado la orden correspondiente en la terminal y verificado empíricamente la salida exitosa del comando. Si un comando o prueba falla, debe reportarse el error con total transparencia.

### 11. Obligación de actualizar TASKS.md y MEMORY.md al finalizar cada tarea
Al concluir la ejecución y verificación de una tarea, es un paso obligatorio e inmediato:
- Marcar la tarea completada en `TASKS.md` (`[x] TASK-xxx`).
- Actualizar `docs/MEMORY.md` con la fecha actual, estado de avance, novedades y el siguiente paso requerido por el plan de ruta.
