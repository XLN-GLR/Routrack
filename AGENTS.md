# Reglas Permanentes de Desarrollo — ROUTRACK
# Google Antigravity Rules

Estas reglas son de cumplimiento **estricto y permanente** para cualquier agente de inteligencia artificial o desarrollador que opere en el proyecto **ROUTRACK**. Toda acción, sugerencia, edición de código o comando debe regirse rigurosamente por los siguientes principios:

---

### 1. Leer la documentación antes de cada tarea
Antes de proponer o ejecutar cualquier cambio, el agente debe leer y comprender la documentación fundacional correspondiente ubicada en el directorio `docs/` (`PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, `TEST_PLAN.md`, `SECURITY.md`, `DECISIONS.md`, `MEMORY.md`) y el plan de trabajo en `TASKS.md`.

### 2. No modificar archivos fuera del alcance autorizado
Toda tarea de desarrollo debe tener un alcance claramente acotado a los archivos indispensables para cumplir con su objetivo específico. Está prohibido alterar archivos no relacionados, modificar configuraciones globales o refactorizar módulos fuera del alcance sin autorización explícita.

### 3. No inventar funcionalidades
El desarrollo debe apegarse estrictamente a los requerimientos documentados en `docs/PRD.md`. No se deben agregar características no solicitadas, suposiciones no validadas ni elementos fuera del alcance (*Out of Scope*) del MVP.

### 4. No cambiar el stack tecnológico sin autorización
El stack tecnológico oficial acordado en `docs/DECISIONS.md` y `docs/ARCHITECTURE.md` es inmutable salvo acuerdo explícito y formal:
- **Backend:** Supabase (PostgreSQL + PostGIS, Supabase Auth, Storage, Edge Functions). Prohibido añadir backends independientes en FastAPI, Express u otros.
- **Web:** Next.js (App Router) + TypeScript + Tailwind CSS + Leaflet.
- **Mobile:** Android nativo en Kotlin + Jetpack Compose + Room + WorkManager + Fused Location Provider.
- **Despliegue y Pruebas:** Vercel y Playwright.

### 5. Utilizar TypeScript estricto
Todo código en el proyecto web debe escribirse en TypeScript con el modo estricto activado (`strict: true`). Queda terminantemente prohibido el uso de `any` explícito o implícito, `ts-ignore` sin justificación de fuerza mayor, o declaraciones de tipos incompletas.

### 6. Mantener código modular y reutilizable
El código debe organizarse en componentes pequeños, cohesivos y con una única responsabilidad (SRP). Se debe favorecer la composición sobre la herencia y aislar la lógica de negocio en servicios o casos de uso desacoplados de la interfaz gráfica.

### 7. No duplicar lógica
Aplicar el principio DRY (*Don't Repeat Yourself*). Las funciones auxiliares, validadores y transformadores de datos geoespaciales o temporales deben centralizarse en módulos comunes reutilizables (`lib/`, `utils/`, o módulos de dominio en Android).

### 8. No exponer secretos
Está terminantemente prohibido escribir, confirmar o incluir en el historial de Git claves privadas, tokens de acceso, contraseñas, URLs de conexión con credenciales o el `SUPABASE_SERVICE_ROLE_KEY`. Se debe utilizar exclusivamente `.env.example` para documentación y variables de entorno seguras en tiempo de ejecución.

### 9. Validar los datos en cliente y servidor
Toda entrada de usuario o de telemetría debe validarse en dos capas:
1. En el cliente para ofrecer una experiencia de usuario rápida y con mensajes claros.
2. En el servidor (Edge Functions, Server Actions y restricciones/triggers de PostgreSQL) para garantizar la integridad física e impedir la inyección de datos corruptos o maliciosos.

### 10. Respetar las políticas RLS (Row Level Security)
Toda tabla creada en PostgreSQL debe contar obligatoriamente con RLS activado. Las consultas y mutaciones deben respetar rigurosamente la separación de organizaciones (`organization_id`) y roles (RBAC). Ninguna funcionalidad debe depender de eludir o desactivar RLS.

### 11. Implementar pruebas para las funcionalidades
Cada nueva funcionalidad desarrollada debe acompañarse de sus pruebas correspondientes según lo estipulado en `docs/TEST_PLAN.md` (unitarias, integración o E2E con Playwright). El código sin pruebas automatizadas no se considera listo.

### 12. Trabajar mediante tareas pequeñas (Vertical Slices)
El desarrollo debe dividirse y abordarse en tareas pequeñas, atómicas y verificables según los identificadores de `TASKS.md` (TASK-xxx). No se deben mezclar múltiples fases o responsabilidades técnicas dispares en una sola iteración.

### 13. No avanzar sin verificar la tarea actual
No se debe dar inicio a una nueva tarea ni declarar terminada la actual sin haber ejecutado las comprobaciones y validaciones necesarias que demuestren que el código compila, funciona y aprueba sus criterios de aceptación.

### 14. Actualizar TASKS.md y MEMORY.md al terminar cada tarea
Al finalizar y validar una tarea, es mandatorio actualizar de inmediato:
- `TASKS.md`: Marcando la tarea correspondiente como completada `[x]`.
- `docs/MEMORY.md`: Actualizando el estado vivo del proyecto, la última fecha de actualización, los problemas detectados y el siguiente paso recomendado.

### 15. No afirmar que una prueba pasó si no se ejecutó
La honestidad y el rigor técnico son obligatorios. El agente jamás debe asegurar o dar a entender que una prueba, compilación, suite de tests o despliegue fue exitoso a menos que haya recibido la confirmación empírica de su ejecución exitosa.

### 16. No realizar cambios destructivos sin autorización
Acciones como sobrescribir archivos sin respaldo, eliminar ramas de Git, forzar pushes (`git push --force`), reiniciar esquemas de bases de datos con pérdida de datos o borrar configuraciones deben requerir siempre autorización previa del usuario.

### 17. Respetar siempre SECURITY.md y PRD.md
Las directrices de protección de datos personales, privacidad laboral del vendedor (seguimiento GPS transparente, autorizado y circunscrito exclusivamente a la jornada laboral activa con notificación visible permanente) y cumplimiento con la LOPDP de Ecuador prevalecen en todo momento sobre cualquier decisión técnica. Está terminantemente prohibido implementar keyloggers, captura de mensajes privados o cualquier forma de vigilancia encubierta.
