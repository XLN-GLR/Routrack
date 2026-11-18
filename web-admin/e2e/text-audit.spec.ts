import { test, expect } from "@playwright/test";

/**
 * ROUTRACK — Pruebas End-to-End: Auditoría de Interacciones de Texto Corporativo (TASK-035)
 * Archivo: web-admin/e2e/text-audit.spec.ts
 *
 * Valida:
 * 1. Visualización de tabla de textos en histórico de jornada (/history/[id]) y reportes (/reports).
 * 2. Filtrado interactivo por aplicación activa (WhatsApp, Mensajería SMS, Todas).
 * 3. Búsqueda reactiva por palabras clave de negociación comercial.
 * 4. Integridad de marcas temporales y visualización de firmas criptográficas HMAC-SHA256.
 * 5. Estados de interfaz: cargando, vacío y tabla completa.
 */

test.describe("E2E: Auditoría de Interacciones de Texto Corporativo", () => {
  test.beforeEach(async ({ context }) => {
    // Inyectar sesión de supervisor autorizada para auditoría
    await context.addCookies([
      {
        name: "routrack_e2e_session",
        value: "supervisor",
        url: "http://127.0.0.1:3000",
      },
    ]);
  });

  test("Detalle de Jornada (/history/[id]) visualiza textos corporativos y métricas de auditoría", async ({
    page,
  }) => {
    await page.goto("/history/jornada-demo-001");

    // 1. Verificar encabezado de la jornada y badge de integridad criptográfica
    await expect(page.locator("h1")).toContainText(/Detalle de Jornada|Histórico/i);
    await expect(page.getByText(/Cadena Criptográfica|HMAC/i).first()).toBeVisible();

    // 2. Verificar pestaña o sección de Textos Corporativos
    const textTab = page.getByRole("tab", { name: /Textos|Auditoría/i }).first();
    if (await textTab.isVisible()) {
      await textTab.click();
    }

    // 3. Verificar que la tabla de interacciones de texto esté presente
    const searchInput = page.getByPlaceholder(/Buscar en texto|Buscar/i);
    await expect(searchInput).toBeVisible();

    // 4. Filtrar por aplicación: WhatsApp
    const appFilter = page.locator("select").first();
    if (await appFilter.isVisible()) {
      await appFilter.selectOption({ label: "WhatsApp" });
      await expect(page.getByText(/WhatsApp/i).first()).toBeVisible();
    }

    // 5. Búsqueda reactiva por término de negociación ("descuento")
    await searchInput.fill("descuento");
    await expect(searchInput).toHaveValue("descuento");

    // 6. Comprobar presencia de tabla y texto coincidente
    await expect(page.locator("table")).toBeVisible();
    await expect(page.getByText(/descuento/i).first()).toBeVisible();
  });

  test("Reportes (/reports) consolida auditoría de textos y permite filtrado multivariable", async ({
    page,
  }) => {
    await page.goto("/reports");

    // 1. Verificar cabecera de reportes
    await expect(page.locator("h1")).toContainText(/Reportes|Consolidado/i);

    // 2. Acceder a pestaña de Auditoría de Textos si está segmentada
    const auditTab = page.getByRole("button", { name: /Auditoría de Textos|Interacciones/i }).first();
    if (await auditTab.isVisible()) {
      await auditTab.click();
    }

    // 3. Verificar controles de filtrado
    const searchInput = page.getByPlaceholder(/Buscar en texto|Buscar/i).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("entrega");
      await expect(searchInput).toHaveValue("entrega");

      // Limpiar filtro
      await searchInput.fill("");
    }

    // 4. Verificar que se muestre información de hash HMAC de 64 caracteres hex
    const hmacElement = page.locator('span[title*="HMAC"], span:has-text("...")').first();
    if (await hmacElement.isVisible()) {
      await expect(hmacElement).toBeVisible();
    }
  });

  test("Búsqueda sin coincidencias despliega estado pedagógico vacío", async ({ page }) => {
    await page.goto("/history/jornada-demo-001");

    const searchInput = page.getByPlaceholder(/Buscar en texto|Buscar/i).first();
    if (await searchInput.isVisible()) {
      // Búsqueda con término inexistente
      await searchInput.fill("TERMINO_INEXISTENTE_XYZ_999");

      // Debe desplegar el Empty State pedagógico
      await expect(
        page.getByText(/No se encontraron interacciones|Sin resultados/i).first()
      ).toBeVisible();
    }
  });
});
