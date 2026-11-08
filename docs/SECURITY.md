# Política de Seguridad, Privacidad y Cumplimiento Normativo — ROUTRACK

**Proyecto:** ROUTRACK  
**Documento:** Arquitectura de Seguridad y Privacidad de Datos  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Base Oficial  

---

## 1. Principios Fundamentales de Seguridad

La seguridad y la privacidad en ROUTRACK no son características accesorias, sino pilares estructurales del diseño del sistema:
- **Mínimo Privilegio (PoLP):** Ningún usuario, componente o proceso posee más permisos de los estrictamente necesarios para su función operativa.
- **Defensa en Profundidad:** La seguridad se aplica en múltiples capas independientes: autenticación a nivel de gateway, autorización en el motor de base de datos con RLS, cifrado en tránsito TLS 1.3 y cifrado en reposo en hardware seguro (Android Keystore).
- **Transparencia y Ética Laboral:** El monitoreo de ubicación es visible, autorizado y acotado estrictamente al horario laboral. Se descarta cualquier técnica de vigilancia clandestina o invasiva.

---

## 2. Autenticación y Autorización

### 2.1. Gestión de Identidades (Supabase Auth)
- La autenticación se gestiona centralizadamente mediante Supabase Auth utilizando correo electrónico y contraseñas robustas (mínimo 8 caracteres, combinación de mayúsculas, minúsculas, números y símbolos).
- **Manejo de Tokens JWT:**
  - `access_token`: Token firmado mediante HMAC-SHA256 con tiempo de vida corto (1 hora), conteniendo en sus *claims* de `app_metadata` el identificador de organización (`organization_id`) y el rol asignado (`role`).
  - `refresh_token`: Token de larga duración utilizado para renovar el `access_token` de manera transparente y segura sin forzar al vendedor o supervisor a reingresar sus credenciales constantemente.

### 2.2. Roles y Matriz de Permisos (RBAC)

| Rol | Descripción | Permisos Clave |
| :--- | :--- | :--- |
| **super_admin** | Administrador de la organización | Gestión total de usuarios, asignación de roles, configuración de parámetros y consulta de toda la información de su organización. |
| **supervisor** | Responsable de equipos y rutas | Consulta en vivo de vendedores, asignación de clientes, visualización de rutas y descarga de reportes operativos. |
| **seller** | Vendedor / Asesor en ruta | Inicio y fin de su propia jornada laboral, captura de sus propios puntos GPS y registro de visitas a clientes. |
| **auditor** | Analista de cumplimiento | Lectura de reportes, análisis de discrepancias geográficas y consulta de la bitácora inmutable de auditoría. |

---

## 3. Políticas de Seguridad a Nivel de Fila (Row Level Security - RLS)

Todas las tablas del sistema en PostgreSQL tienen activado obligatoriamente el modo RLS (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`). Esto garantiza que, incluso si una consulta web o móvil omite un filtro, la base de datos rechace la devolución o modificación de filas no autorizadas.

### 3.1. Regla Base de Aislamiento Multi-Tenant
Toda consulta filtra los registros comparando el `organization_id` de la fila con el `organization_id` extraído del JWT del usuario:
```sql
-- Función auxiliar para extraer la organización del usuario autenticado
CREATE OR REPLACE FUNCTION auth.get_user_organization_id()
RETURNS UUID AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::UUID;
$$ LANGUAGE SQL STABLE;
```

### 3.2. Ejemplos de Políticas RLS por Entidad

```sql
-- 1. Tabla clients: Solo usuarios de la misma organización pueden ver sus clientes
CREATE POLICY "Acceso a clientes por organización"
ON public.clients
FOR ALL
USING (organization_id = auth.get_user_organization_id());

-- 2. Tabla work_shifts: Un vendedor solo puede insertar o modificar su propia jornada
CREATE POLICY "Vendedor gestiona su propia jornada"
ON public.work_shifts
FOR ALL
USING (
  organization_id = auth.get_user_organization_id() AND
  seller_id = auth.uid()
)
WITH CHECK (
  organization_id = auth.get_user_organization_id() AND
  seller_id = auth.uid()
);

-- 3. Tabla work_shifts: Supervisores pueden leer las jornadas de su organización
CREATE POLICY "Supervisores consultan jornadas de la organizacion"
ON public.work_shifts
FOR SELECT
USING (
  organization_id = auth.get_user_organization_id() AND
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('supervisor', 'super_admin', 'auditor')
);

-- 4. Tabla tracking_points: Vendedor inserta sus puntos; supervisores leen
CREATE POLICY "Vendedor inserta sus puntos GPS"
ON public.tracking_points
FOR INSERT
WITH CHECK (
  organization_id = auth.get_user_organization_id() AND
  seller_id = auth.uid()
);

CREATE POLICY "Lectura de telemetria por supervisores"
ON public.tracking_points
FOR SELECT
USING (
  organization_id = auth.get_user_organization_id() AND
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('supervisor', 'super_admin', 'auditor')
);
```

---

## 4. Protección de Credenciales y Variables de Entorno

1. **Separación de Claves Públicas y Secretas:**
   - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Son claves públicas diseñadas para interactuar con Supabase respetando siempre las reglas RLS. Son seguras para incluirse en el frontend web y la app móvil.
   - `SUPABASE_SERVICE_ROLE_KEY`: Clave maestra que **omite todas las políticas RLS**. Está **estrictamente prohibido** utilizar esta clave en el cliente web Next.js, en la aplicación Android o en repositorios de código. Solo se permite su uso en entornos aislados de servidor o Edge Functions debidamente protegidas.
2. **Archivos de Entorno:**
   - Los archivos `.env`, `.env.local` y equivalentes están excluidos del repositorio mediante `.gitignore`. Se provee únicamente `.env.example` con valores ficticios y descriptivos.

---

## 5. Cifrado y Seguridad en el Dispositivo Android

1. **Android Keystore y Cifrado AES-256-GCM:**
   - Los tokens de sesión (`access_token`, `refresh_token`) se almacenan utilizando `EncryptedSharedPreferences` respaldado por el **Android Keystore System**.
   - Las llaves criptográficas se generan en hardware seguro (Trusted Execution Environment - TEE o StrongBox Keymaster), haciendo imposible su extracción del dispositivo incluso ante privilegios de superusuario (*root*).
2. **Protección de la Base de Datos Local Room:**
   - La base de datos SQLite local de Room se encuentra aislada en el almacenamiento privado de la aplicación (`data/data/com.routrack.app/databases/`), inaccesible para otras apps instaladas en el teléfono.
3. **Detección de Manipulación (Mock Location & Anti-Tampering):**
   - La aplicación detecta si una coordenada proviene de una aplicación de ubicación simulada (*Mock Location*) a través de los métodos oficiales del SDK de Android (`Location.isFromMockProvider()` o `Location.isMock()`).
   - Los puntos marcados con proveedor simulado se etiquetan como `is_mock = true`, lo cual desencadena alertas inmediatas en el módulo de auditoría.

---

## 6. Seguridad en las Comunicaciones

- **HTTPS / TLS 1.3:** Todo el tráfico entre clientes (Web y Móvil) y Supabase viaja forzosamente cifrado mediante TLS 1.3 con suites de cifrado modernas (evitando protocolos obsoletos como SSLv3, TLS 1.0 y TLS 1.1).
- **Protección de Cabeceras Web:** En Next.js se configuran cabeceras de seguridad estrictas:
  - `Content-Security-Policy (CSP)`
  - `X-Frame-Options: DENY` (prevención de Clickjacking)
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: geolocation=(self)`

---

## 7. Validación de Datos y Sanitización

- **Defensa en Doble Capa:** La validación de datos nunca se delega exclusivamente a la interfaz de usuario.
  - **Cliente Web y Móvil:** Validación inmediata para mejorar la experiencia de usuario (validación de formatos de correo, coordenadas válidas entre -90 y 90 de latitud y -180 a 180 de longitud).
  - **Servidor y Base de Datos:** Validación mediante esquemas Zod en Server Actions / Edge Functions y restricciones de integridad física (`CHECK constraints`) en PostgreSQL.

---

## 8. Auditoría de Operaciones y Bitácora Inmutable

La tabla `audit_logs` registra permanentemente los eventos críticos para control interno:
- Inicios de sesión y cierres de sesión sospechosos.
- Intentos de inserción de puntos con `is_mock = true`.
- Modificación o eliminación de registros de clientes.
- Cierres forzados o anormales de jornadas laborales.
- Las filas de `audit_logs` tienen permisos de **solo inserción** (`INSERT ONLY`); ningún rol, ni siquiera `super_admin`, tiene permitido ejecutar `UPDATE` o `DELETE` sobre la bitácora de auditoría.

---

## 9. Protección de Datos Personales y Privacidad Laboral

### 9.1. Transparencia y Consentimiento
El rastreo GPS en ROUTRACK está regido por los principios de lealtad, proporcionalidad y consentimiento informado:
- **Rastreo Visible y Notificado:** La app Android informa continuamente al vendedor mediante una notificación fija en la barra de estado del sistema operativo mientras la jornada de trabajo esté en curso.
- **Límite Temporal Estricto:** La recolección de coordenadas GPS inicia **únicamente** cuando el vendedor presiona el botón "Iniciar Jornada" y cesa de forma total e inmediata cuando presiona "Finalizar Jornada".
- **Sin Monitoreo en Horas de Descanso:** Fuera del horario de la jornada registrada, ROUTRACK no recolecta, consulta ni transmite ningún dato de ubicación, preservando íntegramente la vida privada del trabajador.

### 9.2. Prohibición de Vigilancia Invasiva
Queda formal y técnicamente prohibida la incorporación de cualquier mecanismo de espionaje o intrusión no autorizada:
- **NO Keylogger:** CERO registro o intercepción de pulsaciones de teclado o contraseñas.
- **NO Acceso a Mensajería:** CERO lectura de chats, mensajes SMS, correos electrónicos personales o conversaciones de WhatsApp u otras plataformas de mensajería.
- **NO Monitoreo de Otras Apps:** CERO inspección de las aplicaciones instaladas o utilizadas por el empleado en su dispositivo móvil.
- **NO Grabación Oculta:** CERO activación no autorizada de micrófonos, cámaras o grabaciones de pantalla.

---

## 10. Cumplimiento con la LOPDP de Ecuador

El diseño de ROUTRACK se ajusta a lo estipulado en la **Ley Orgánica de Protección de Datos Personales (LOPDP)** de la República del Ecuador:

1. **Principio de Juridicidad y Finalidad (Art. 10 LOPDP):** Los datos de geolocalización se tratan con la finalidad exclusiva y legítima de optimizar la logística comercial, verificar la ejecución de visitas comerciales y coordinar la seguridad del trabajador en ruta.
2. **Principio de Proporcionalidad y Minimización:** Solo se capturan los datos indispensables (coordenadas, precisión y marca de tiempo). No se almacenan metadatos innecesarios ni datos sensibles ajenos a la actividad laboral.
3. **Derechos de los Titulares (Derechos ARCO):** La plataforma facilita mecanismos para que los trabajadores puedan solicitar el acceso a los datos de telemetría registrados durante sus jornadas y la rectificación de datos inexactos.
4. **Política de Retención y Purgado:**
   - Los puntos de telemetría detallados (`tracking_points`) tienen una política de retención estándar de **180 días**. Pasado este lapso, los puntos individuales se purgan automáticamente de la base de datos o se agregan en métricas consolidadas (distancia total del día y visitas verificadas), anonimizando el detalle minuto a minuto del recorrido histórico.
   - Los registros de visitas comerciales (`visit_records`) y facturación se conservan según los requerimientos mercantiles y tributarios vigentes.
