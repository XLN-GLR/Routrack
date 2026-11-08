# Sistema de Diseño e Identidad Visual — ROUTRACK

**Proyecto:** ROUTRACK  
**Documento:** Especificación del Sistema de Diseño (Design System)  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Base Oficial  

---

## 1. Filosofía Visual y Apariencia

ROUTRACK es una plataforma de supervisión empresarial y auditoría operativa. Su lenguaje visual debe transmitir:
- **Claridad y precisión:** La información cartográfica, las métricas de jornada y los estados de visitas deben ser comprensibles de un vistazo.
- **Sobriedad y profesionalismo:** Interfaces limpias basadas en tonos neutros oscuros y claros con contrastes balanceados, evitando saturación visual innecesaria.
- **Rápida identificación de estados:** Los colores semánticos (verde, ámbar, rojo, azul) están reservados rigurosamente para estados operativos (vendedor en ruta, visita validada, alerta de mock location, etc.).
- **Legibilidad en campo y oficina:** El panel web debe ofrecer comodidad visual para sesiones prolongadas de supervisión; la aplicación móvil debe garantizar alto contraste y áreas táctiles generosas para operarse bajo luz solar directa y con una sola mano.

---

## 2. Paleta de Colores

La paleta se define siguiendo los nombres estándar de Tailwind CSS para garantizar coherencia directa entre el diseño y la futura implementación en código.

### 2.1. Colores Primarios y de Marca
| Nombre | Código HEX | Rol / Uso en la Interfaz |
| :--- | :--- | :--- |
| **Primary Navy** | `#0F172A` (Slate 900) | Fondo de barras de navegación principales, encabezados oscuros, texto principal en modo claro. |
| **Primary Blue** | `#2563EB` (Blue 600) | Color de acción principal, botones primarios, enlaces activos, marcador de vendedor en movimiento. |
| **Primary Blue Hover** | `#1D4ED8` (Blue 700) | Estado *hover* de botones y elementos interactivos primarios. |
| **Primary Blue Light** | `#EFF6FF` (Blue 50) | Fondos de selección, badges de estado informativo, resaltados suaves. |

### 2.2. Colores Semánticos y de Estado Operativo
| Estado | Color | Código HEX | Equivalente Tailwind | Significado en ROUTRACK |
| :--- | :--- | :--- | :--- | :--- |
| **Éxito (Success)** | Verde Esmeralda | `#10B981` | `emerald-500` | Visita verificada dentro de radio; jornada activa regular; sincronización completa. |
| **Éxito Suave** | Verde Fondo | `#ECFDF5` | `emerald-50` | Fondo de badges de visitas aprobadas y tarjetas de resumen positivo. |
| **Advertencia (Warning)**| Ámbar Cálido | `#F59E0B` | `amber-500` | Visita registrada fuera de radio; batería de dispositivo < 20%; parada prolongada. |
| **Advertencia Suave** | Ámbar Fondo | `#FFFBEB` | `amber-50` | Fondo de alertas preventivas en auditoría. |
| **Peligro / Alerta (Danger)** | Rojo Carmesí | `#EF4444` | `red-500` | Ubicación simulada detectada (Mock GPS); GPS apagado; jornada abortada. |
| **Peligro Suave** | Rojo Fondo | `#FEF2F2` | `red-50` | Fondo de alertas de fraude y errores críticos de sistema. |
| **Informativo / Auditoría**| Violeta | `#8B5CF6` | `violet-500` | Bitácora de auditoría inmutable, eventos de sistema, perfil de configuración. |

### 2.3. Colores Neutros y Superficies
| Nivel | Nombre | HEX | Tailwind | Aplicación |
| :--- | :--- | :--- | :--- | :--- |
| Superficie Fondo (Web) | Slate 50 | `#F8FAFC` | `bg-slate-50` | Fondo global de la aplicación web. |
| Superficie Tarjetas (Cards)| Blanco Puro | `#FFFFFF` | `bg-white` | Fondo de contenedores, tarjetas KPI, diálogos modales y tablas. |
| Bordes y Divisores | Slate 200 | `#E2E8F0` | `border-slate-200` | Líneas divisorias, bordes de inputs y separadores de tablas. |
| Bordes Suaves | Slate 100 | `#F1F5F9` | `border-slate-100` | Divisores internos sutiles en listas. |
| Texto Principal | Slate 900 | `#0F172A` | `text-slate-900` | Títulos principales, métricas numéricas grandes, texto de alto contraste. |
| Texto Secundario | Slate 600 | `#475569` | `text-slate-600` | Descripciones, etiquetas de formularios, texto de apoyo. |
| Texto Terciario / Muted | Slate 400 | `#94A3B8` | `text-slate-400` | Placeholders, marcas de tiempo secundarias, metadatos no críticos. |

---

## 3. Tipografía

Se adopta una fuente sans-serif moderna, geométrica y con alta legibilidad en pantallas digitales: **Inter** (o la fuente de sistema `ui-sans-serif, system-ui`).

### 3.1. Escala Tipográfica
| Nivel | Tamaño | Altura de Línea (Leading) | Peso (Font Weight) | Uso en Interfaz |
| :--- | :--- | :--- | :--- | :--- |
| **Display / H1** | 24px (1.5rem) | 32px (2rem) | Bold (700) | Encabezado principal del panel o vista activa. |
| **H2** | 20px (1.25rem) | 28px (1.75rem) | SemiBold (600) | Títulos de secciones principales, nombres de vendedores. |
| **H3** | 16px (1.0rem) | 24px (1.5rem) | SemiBold (600) | Títulos de tarjetas KPI, cabeceras de diálogos modales. |
| **Body (Base)** | 14px (0.875rem) | 20px (1.25rem) | Regular (400) | Texto general de contenido, celdas de tablas, inputs de formulario. |
| **Body Small** | 12px (0.75rem) | 16px (1.0rem) | Medium (500) | Badges de estado, etiquetas secundarias, marcas de tiempo. |
| **Caption / Tiny**| 11px (0.6875rem) | 14px (0.875rem) | Regular (400) | Coordenadas GPS numéricas, notas legales, leyendas de mapas. |

---

## 4. Espaciado, Radios de Borde y Sombras

### 4.1. Escala de Espaciado (Malla de 4px / 8px)
- `space-1` (4px): Espaciado micro entre icono y texto.
- `space-2` (8px): Espaciado interno en botones compactos y chips.
- `space-3` (12px): Padding estándar en celdas de tablas e inputs.
- `space-4` (16px): Padding estándar en tarjetas (cards) y gaps en grids móviles.
- `space-6` (24px): Padding en contenedores principales de sección y modales.
- `space-8` (32px): Separación vertical entre bloques principales del dashboard.

### 4.2. Bordes y Radios (Border Radius)
- **Inputs y Botones:** `rounded-lg` (8px) para un balance contemporáneo y accesible.
- **Tarjetas y Contenedores:** `rounded-xl` (12px) para aportar suavidad y modularidad visual.
- **Badges y Chips de Estado:** `rounded-full` (completamente redondeados).
- **Modales y Diálogos:** `rounded-2xl` (16px) con sombra prominente.

### 4.3. Elevación y Sombras
- **Nivel 0 (Plano):** `shadow-none`, bordes en `border-slate-200`.
- **Nivel 1 (Tarjetas estándar):** `shadow-sm` (`0 1px 2px 0 rgb(0 0 0 / 0.05)`).
- **Nivel 2 (Tarjetas flotantes / Dropdowns):** `shadow-md` (`0 4px 6px -1px rgb(0 0 0 / 0.1)`).
- **Nivel 3 (Modales y Popovers de Mapa):** `shadow-xl` (`0 20px 25px -5px rgb(0 0 0 / 0.1)`).

---

## 5. Componentes Principales del Sistema

### 5.1. Botones (Buttons)
- **Primary:** Fondo `bg-blue-600`, texto blanco, hover `bg-blue-700`, active `bg-blue-800`. Utilizado para la acción primordial de la vista (ej. "Iniciar Jornada", "Guardar Cliente", "Filtrar").
- **Secondary:** Fondo blanco `bg-white`, borde `border-slate-300`, texto `text-slate-700`, hover `bg-slate-50`. Para acciones secundarias o cancelaciones.
- **Destructive:** Fondo `bg-red-600`, texto blanco, hover `bg-red-700`. Para acciones críticas como "Abortar Jornada" o "Eliminar Registro".
- **Ghost / Icon Button:** Sin borde ni fondo por defecto; hover `bg-slate-100`, icono en `text-slate-600`. Para controles de zoom en mapa, cerrar ventanas o menús de acciones rápidas.

### 5.2. Formularios e Inputs
- **Campos de Texto:** Altura estándar 40px (`h-10`), padding horizontal 12px, borde `border-slate-300`, focus ring `ring-2 ring-blue-500 border-transparent`.
- **Selects y Dropdowns:** Misma altura y estilo de borde, con flecha indicadora minimalista y menú contextual elevado con sombra nivel 2.
- **Mensajes de Error en Formularios:** Texto en `text-red-600` de 12px, acompañado de un icono informativo de advertencia situado debajo del input correspondiente.

### 5.3. Tablas de Datos (Data Tables)
- **Cabecera (Header):** Fondo `bg-slate-50`, texto en `text-slate-600` en mayúsculas pequeñas (`text-xs font-semibold tracking-wider`), borde inferior `border-b border-slate-200`.
- **Filas (Rows):** Fondo blanco alternado o limpio con hover `hover:bg-slate-50/75` para facilitar el seguimiento visual de filas largas.
- **Paginación y Filtros:** Barra inferior fija con selector de elementos por página, contador de resultados ("Mostrando 1 a 20 de 154 vendedores") y botones de navegación anterior/siguiente.

### 5.4. Tarjetas Informativas (KPI Cards)
Estructura modular de 4 bloques en el dashboard de supervisión:
1. **Vendedores Activos en Ruta:** Número principal grande (32px Bold), badge de porcentaje de asistencia respecto al total.
2. **Visitas Completadas:** Contador de visitas del día con desglose (Verificadas en verde vs Fuera de rango en ámbar).
3. **Kilómetros Acumulados:** Estimación sumada de distancia recorrida por la flota activa.
4. **Alertas de Auditoría:** Cantidad de incidentes detectados en el día (intentos de mock location o jornadas inconsistentes).

### 5.5. Elementos Cartográficos (Leaflet Map UI)
- **Marcador de Vendedor en Movimiento:** Icono circular azul con flecha interna que orienta el sentido de avance según el rumbo (*bearing*).
- **Marcador de Vendedor Detenido:** Círculo ámbar con icono de pausa o reloj.
- **Marcador de Cliente Visitado:** Pin verde esmeralda con check.
- **Marcador de Cliente Pendiente:** Pin gris pizarra con inicial del cliente.
- **Popup de Marcador:** Tarjeta limpia de 220px de ancho máximo mostrando: Nombre del vendedor, hora del último reporte, velocidad actual, nivel de batería y botón "Ver Recorrido del Día".

---

## 6. Navegación y Estructura del Panel de Administración

### 6.1. Barra Lateral de Navegación (Sidebar)
- Ubicada a la izquierda, ancho fijo de 260px en escritorio (colapsable a 64px o drawer deslizable en tabletas/móviles).
- Fondo `bg-slate-900` con texto en `text-slate-300` y acentos activos en `bg-blue-600 text-white`.
- Enlaces de primer nivel:
  1. **Monitoreo en Vivo (Mapa General):** Vista principal de supervisión.
  2. **Jornadas y Rutas:** Histórico de días anteriores por vendedor.
  3. **Visitas Comerciales:** Auditoría de check-ins y evidencias.
  4. **Gestión de Clientes:** Directorio y georreferenciación de puntos de venta.
  5. **Equipo de Vendedores:** Administración de usuarios y dispositivos.
  6. **Reportes y Auditoría:** Descarga de archivos CSV y análisis de métricas.
  7. **Configuración:** Parámetros de la organización y tolerancias geográficas.

### 6.2. Barra Superior (Top Header)
- Altura fija de 60px (`h-15`), fondo blanco con borde inferior `border-slate-200`.
- Contiene el selector de sucursal / organización activa, indicador de estado de conexión Realtime (punto verde pulsante "En vivo"), fecha actual y menú desplegable del perfil de usuario con opción de cierre de sesión seguro.

---

## 7. Diseño Responsive y Adaptabilidad

1. **Panel Web:**
   - **Escritorio (> 1280px):** Disposición en pantalla dividida (Split View): panel lateral de lista y filtros a la izquierda (35% de ancho) y visor de mapa Leaflet a la derecha (65% de ancho restante).
   - **Tableta (768px - 1279px):** Sidebar colapsado a iconos; vista de mapa con panel flotante colapsable para la lista de vendedores.
   - **Móvil (< 768px):** Alternancia por pestañas ("Lista de Vendedores" | "Mapa en Vivo") para evitar sobrecargar la pantalla compacta.
2. **Aplicación Android (Mobile First):**
   - Interfaz vertical con navegación inferior fija (`NavigationBar` de Compose) con dos pantallas primordiales: **"Mi Jornada"** (estado de turno, botón de inicio/fin y métricas del día) y **"Clientes / Visitas"** (lista ordenada por distancia o ruta sugerida).

---

## 8. Estados de Interfaz (UI States)

- **Cargando (Loading State):** 
  - Uso estricto de elementos esqueleto (*Skeleton Loaders*) con animación de pulso sutil (`animate-pulse bg-slate-200`), replicando la forma exacta de las tarjetas, filas de tablas o paneles antes de presentar los datos.
  - Spinner minimalista centrado únicamente para acciones directas en botones ("Guardando...").
- **Error (Error State):** 
  - Banner con borde izquierdo grueso rojo (`border-l-4 border-red-500 bg-red-50 text-red-800`), explicando con claridad la causa del error en español y ofreciendo un botón evidente de "Reintentar".
- **Vacío (Empty State):**
  - Contenedor centrado con ilustración lineal sobria en escala de grises, título claro ("No hay vendedores en ruta en este momento") y sugerencia amigable ("Las jornadas iniciadas por los asesores comerciales aparecerán aquí en tiempo real").
- **Éxito (Success State):**
  - Notificaciones flotantes tipo Toast en la esquina superior derecha del panel web, con duración automática de 4 segundos, icono verde de confirmación y botón de cierre manual.
