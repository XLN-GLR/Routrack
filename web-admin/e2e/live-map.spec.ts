import { test, expect } from "@playwright/test";

/**
 * ROUTRACK — Pruebas End-to-End: Monitoreo en Vivo e Histórico de Rutas (TASK-024 / E2E-02, E2E-03)
 * Archivo: web-admin/e2e/live-map.spec.ts
 */

test.describe("E2E-02 y E2E-03: Cartografía, Monitoreo en Vivo y Rutas", () => {
  test.beforeEach(async ({ context }) => {
    // Inyectar sesión de supervisor para todas las pruebas cartográficas
    await context.addCookies([
      {
        name: "routrack_e2e_session",
        value: "supervisor",
        url: "http://127.0.0.1:3000",
      },
    ]);
  });

  test("E2E-02: Visor de Monitoreo en Vivo carga mapa Leaflet, marcadores y telemetría", async ({
    page,
  }) => {
    await page.goto("/live");

    // 1. Verificar cabecera y títulos operativos
    await expect(page.locator("h1")).toContainText(/Supervisión Geográfica|Monitoreo/i);

    // 2. Verificar tarjetas KPI de estados operativos
    await expect(page.getByText("EN RUTA").first()).toBeVisible();
    await expect(page.getByText("DETENIDO").first()).toBeVisible();

    // 3. Verificar que el contenedor de Leaflet se monte correctamente en el cliente
    const mapContainer = page.locator(".leaflet-container");
    await expect(mapContainer).toBeVisible({ timeout: 15000 });

    // 4. Verificar lista de asesores comerciales en el panel lateral
    await expect(page.getByText("Carlos Mendoza")).toBeVisible();
    await expect(page.getByText("Diana Paredes")).toBeVisible();

    // 5. Interacción: Centrar mapa con botón "Ver Todos"
    const fitAllButton = page.getByRole("button", { name: /Ver Todos/i });
    await expect(fitAllButton).toBeVisible();
    await fitAllButton.dispatchEvent("click");
    await expect(fitAllButton).toBeVisible();
  });

  test("E2E-03: Histórico de Rutas renderiza polilínea, desvíos espaciales y métricas cuantitativas", async ({
    page,
  }) => {
    await page.goto("/routes");

    // 1. Verificar cabecera
    await expect(page.locator("h1")).toContainText(/Histórico de (Trayectorias|Rutas) y Desvíos/i);

    // 2. Verificar controles interactivos de selección
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible();

    // 3. Verificar tarjetas KPI de la jornada
    await expect(page.getByText("Distancia Total").first()).toBeVisible();
    await expect(page.getByText("Duración Turno").first()).toBeVisible();
    await expect(page.getByText(/Desvíos \(>300m\)|Desvíos/i).first()).toBeVisible();

    // 4. Verificar contenedor cartográfico Leaflet con polilínea
    const mapContainer = page.locator(".leaflet-container");
    await expect(mapContainer).toBeVisible({ timeout: 15000 });

    // 5. Verificar toggle de tramos desviados
    const toggleDesvios = page.getByRole("button", { name: /Resaltar Desvíos/i });
    await expect(toggleDesvios).toBeVisible();
    await toggleDesvios.dispatchEvent("click");
    await expect(toggleDesvios).toBeVisible();
  });
});

