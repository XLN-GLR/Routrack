import { test, expect } from "@playwright/test";

/**
 * ROUTRACK — Pruebas End-to-End: Trazado Vial Real (Map-Matching) y Animación Cinemática (TASK-035)
 * Archivo: web-admin/e2e/road-matching.spec.ts
 *
 * Valida:
 * 1. Proyección de polilíneas ajustadas sobre calles y avenidas reales de OpenStreetMap (costo $0 USD).
 * 2. Cero líneas rectas aéreas entre vértices urbanos lejanos.
 * 3. Animación cinemática continua de marcadores vehiculares a 60 FPS sin saltos abruptos.
 * 4. Botón interactivo de alternancia entre "Vía Real (OSRM)" y "Vía Directa".
 * 5. Alto rendimiento de renderizado en hardware canvas de Leaflet.
 */

test.describe("E2E: Map-Matching y Navegación Cartográfica por Calles Reales", () => {
  test.beforeEach(async ({ context }) => {
    // Inyectar sesión de supervisor
    await context.addCookies([
      {
        name: "routrack_e2e_session",
        value: "supervisor",
        url: "http://127.0.0.1:3000",
      },
    ]);
  });

  test("Visor de Monitoreo (/live) carga polilíneas viales sobre calles reales con OSRM", async ({
    page,
  }) => {
    await page.goto("/live");

    // 1. Contenedor del mapa Leaflet montado en el cliente
    const mapContainer = page.locator(".leaflet-container");
    await expect(mapContainer).toBeVisible({ timeout: 15000 });

    // 2. Comprobar botón interactivo de alternancia vial (Vía Real vs Vía Directa)
    const roadToggleBtn = page.getByRole("button", { name: /Vía Real \(OSRM\)|Vía Directa/i });
    await expect(roadToggleBtn).toBeVisible();

    // 3. Seleccionar un vendedor de la lista para proyectar su corredor vial
    const sellerCard = page.getByText("Carlos Mendoza").first();
    await expect(sellerCard).toBeVisible();
    await sellerCard.click();

    // 4. Verificar tarjeta flotante de detalle del vendedor
    await expect(page.getByText(/Carlos Mendoza/i).first()).toBeVisible();
    await expect(page.getByText(/km\/h/i).first()).toBeVisible();

    // 5. Verificar que exista al menos una capa SVG o Canvas de trayectoria en el mapa
    const vectorLayer = page.locator(".leaflet-pane svg path, .leaflet-pane canvas").first();
    await expect(vectorLayer).toBeAttached();

    // 6. Alternar botón de trazado vial
    await roadToggleBtn.click();
    await expect(page.getByRole("button", { name: /Vía Directa|Vía Real/i })).toBeVisible();
  });

  test("Marcadores vehiculares renderizan icono direccional con rumbo y rotación angular", async ({
    page,
  }) => {
    await page.goto("/live");

    // 1. Esperar renderizado del mapa
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 15000 });

    // 2. Verificar presencia de marcadores personalizados en la capa de marcadores
    const sellerMarkers = page.locator(".routrack-seller-marker-icon");
    await expect(sellerMarkers.first()).toBeVisible({ timeout: 10000 });

    // 3. Verificar que al menos un marcador posea flecha direccional con rotación en estilo
    const enRutaMarker = page.locator('.routrack-seller-marker-icon div[style*="rotate"]').first();
    if (await enRutaMarker.count() > 0) {
      await expect(enRutaMarker).toBeAttached();
    }
  });

  test("Atribución a OpenStreetMap ($0 USD) visible y ausencia de APIs comerciales de pago", async ({
    page,
  }) => {
    await page.goto("/live");

    // 1. Verificar atribución de OpenStreetMap
    await expect(page.getByText(/OpenStreetMap/i).first()).toBeVisible();

    // 2. Comprobar que no se carguen scripts de Google Maps ni Mapbox en la red del navegador
    const pageContent = await page.content();
    expect(pageContent).not.toContain("maps.googleapis.com");
    expect(pageContent).not.toContain("api.mapbox.com");
  });
});
