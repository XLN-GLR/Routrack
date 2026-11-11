/**
 * ROUTRACK — Utilidad de Exportación Formal a CSV con UTF-8 BOM (TASK-023)
 * Archivo: web-admin/src/lib/export/exportCsv.ts
 *
 * Genera archivos CSV estructurados con Byte Order Mark (BOM: \uFEFF) para
 * garantizar que Microsoft Excel en español abra los archivos con tildes, eñes
 * y caracteres monetarios sin corrupción de caracteres (Criterio de Aceptación 2).
 */

export interface ReportShiftRow {
  fecha: string;
  vendedor: string;
  email: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_horas: string;
  kilometros: number;
  visitas_totales: number;
  visitas_verificadas: number;
  visitas_fuera_rango: number;
  efectividad_porcentaje: string;
  monto_pactado_usd: number;
  estado_turno: string;
}

export const UTF8_BOM = "\uFEFF";

/**
 * Escapa un campo individual según las especificaciones RFC 4180:
 * Si contiene comas, comillas dobles o saltos de línea, se envuelve en comillas
 * y se duplican las comillas internas.
 */
export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Genera el nombre de archivo normalizado según el Criterio 1:
 * reporte-jornadas-YYYY-MM-DD.csv
 */
export function buildReportFileName(dateStr?: string): string {
  const datePart =
    dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? dateStr
      : new Date().toISOString().slice(0, 10);
  return `reporte-jornadas-${datePart}.csv`;
}

/**
 * Genera el contenido completo en formato CSV con BOM UTF-8 y encabezados en español.
 */
export function generateShiftsCsv(rows: ReportShiftRow[]): string {
  const headers = [
    "Fecha",
    "Vendedor",
    "Correo Electrónico",
    "Hora Inicio",
    "Hora Fin",
    "Duración Estimada",
    "Kilómetros Recorridos (km)",
    "Total Visitas",
    "Visitas Verificadas",
    "Visitas Fuera de Rango",
    "Tasa de Efectividad",
    "Monto Pactado ($ USD)",
    "Estado de Jornada",
  ];

  const headerLine = headers.map(escapeCsvField).join(",");

  const dataLines = rows.map((row) =>
    [
      escapeCsvField(row.fecha),
      escapeCsvField(row.vendedor),
      escapeCsvField(row.email),
      escapeCsvField(row.hora_inicio),
      escapeCsvField(row.hora_fin),
      escapeCsvField(row.duracion_horas),
      escapeCsvField(row.kilometros.toFixed(1)),
      escapeCsvField(row.visitas_totales),
      escapeCsvField(row.visitas_verificadas),
      escapeCsvField(row.visitas_fuera_rango),
      escapeCsvField(row.efectividad_porcentaje),
      escapeCsvField(row.monto_pactado_usd.toFixed(2)),
      escapeCsvField(row.estado_turno),
    ].join(",")
  );

  // Anteponer obligatoriamente el BOM UTF-8 (\uFEFF) para Microsoft Excel
  return UTF8_BOM + [headerLine, ...dataLines].join("\r\n");
}

/**
 * Dispara la descarga del archivo CSV en el navegador del usuario de forma automática (Criterio 1).
 */
export function downloadCsvFile(csvContent: string, fileName: string): boolean {
  try {
    if (typeof window === "undefined" || !window.document) return false;

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

