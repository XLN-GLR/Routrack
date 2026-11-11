import { test, expect } from "@playwright/test";

/**
 * ROUTRACK — Pruebas End-to-End: Clientes, Auditoría y Exportación CSV (TASK-024 / E2E-04, E2E-05)
 * Archivo: web-admin/e2e/reports.spec.ts
 */

test.describe("E2E-04 y E2E-05: Clientes, Auditoría y Exportación", () => {
  test.beforeEach(async ({ context }) => {
    // Inyectar sesión autorizada de supervisor
    await context.addCookies([
      {
        name: "routrack_e2e_session",
        value: "supervisor",
        url: "http://127.0.0.1:3000",
      },
    ]);
  });

  test("E2E-04: Catálogo de Clientes abre modal interactivo de creación y geocercas", async ({
    page,
  }) => {
    await page.goto("/clients");

    // 1. Verificar cabecera del módulo de clientes
    await expect(page.locator("h1")).toContainText(/Georreferenciación de Clientes|Catálogo/i);

    // 2. Verificar presencia de tarjetas KPI y tabla
    await expect(page.getByText("Total de Clientes").first()).toBeVisible();

    // 3. Abrir modal de nuevo cliente
    const newClientButton = page.getByRole("button", { name: /Nuevo Cliente/i });
    await expect(newClientButton).toBeVisible();
    await newClientButton.click();

    // 4. Verificar apertura accesible del modal (role="dialog")
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Registrar Nuevo Cliente/i)).toBeVisible();

    // 5. Verificar campos obligatorios en el formulario
    await expect(dialog.locator("#razon_social")).toBeVisible();
    await expect(dialog.locator("#identificacion")).toBeVisible();
    await expect(dialog.locator("#direccion")).toBeVisible();

    // 6. Cerrar modal con tecla Escape
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("E2E-05: Descarga automática de reporte CSV con nombre normalizado", async ({ page }) => {
    await page.goto("/reports");

    // 1. Verificar cabecera
    await expect(page.locator("h1")).toContainText("Reportes de Jornada y Desempeño");

    // 2. Verificar botón de exportación formal
    const exportButton = page.getByRole("button", { name: /Exportar CSV/i });
    await expect(exportButton).toBeVisible();

    // 3. Interceptar evento de descarga y hacer clic
    const downloadPromise = page.waitForEvent("download");
    await exportButton.click();
    const download = await downloadPromise;

    // 4. Validar Criterio 1: Nombre de archivo normalizado reporte-jornadas-YYYY-MM-DD.csv
    const downloadedName = download.suggestedFilename();
    expect(downloadedName).toMatch(/^reporte-jornadas-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test("E2E-05: Bitácora Inmutable muestra indicador de integridad HMAC y eventos", async ({
    page,
  }) => {
    await page.goto("/audit");

    // 1. Verificar título
    await expect(page.locator("h1")).toContainText("Bitácora Inmutable de Eventos del Sistema");

    // 2. Verificar indicador visual prominente de integridad criptográfica
    await expect(page.getByText("Cadena HMAC Íntegra (100% Válida)")).toBeVisible();

    // 3. Verificar tarjetas KPI de auditoría
    await expect(page.getByText("Total Eventos").first()).toBeVisible();
    await expect(page.getByText("Alertas Críticas").first()).toBeVisible();

    // 4. Verificar tabla con severidades semánticas (INFO, WARNING, CRITICAL)
    await expect(page.locator("table").getByText("Turno Iniciado").first()).toBeVisible();
    await expect(page.locator("table").getByText("Crítico").first()).toBeVisible();
  });
});

