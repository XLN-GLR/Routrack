import { test, expect } from "@playwright/test";

/**
 * ROUTRACK — Pruebas End-to-End: Autenticación y Control de Acceso (TASK-024 / E2E-01)
 * Archivo: web-admin/e2e/auth.spec.ts
 */

test.describe("E2E-01: Autenticación y Control de Acceso", () => {
  test("despliega el formulario de inicio de sesión con inputs y branding", async ({ page }) => {
    await page.goto("/login");

    // Verificar branding del sistema
    await expect(page.locator("h1")).toContainText("ROUTRACK");
    await expect(page.getByText("Supervisión Operativa y Auditoría de Rutas")).toBeVisible();

    // Verificar inputs requeridos
    const emailInput = page.locator("#email");
    const passwordInput = page.locator("#password");
    const submitButton = page.getByRole("button", { name: /Iniciar Sesión/i });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test("valida campos vacíos mostrando mensaje de advertencia", async ({ page }) => {
    await page.goto("/login");

    const submitButton = page.getByRole("button", { name: /Iniciar Sesión/i });
    await submitButton.click();

    // Debe mostrar la alerta con data-testid="login-error-alert"
    const alert = page.locator('[data-testid="login-error-alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Por favor ingrese su correo electrónico y contraseña");
  });

  test("muestra alerta ante intento de acceso de usuario con rol VENDEDOR", async ({ page }) => {
    // Simula la redirección generada cuando un vendedor intenta ingresar al panel web
    await page.goto("/login?error=unauthorized_role");

    const alert = page.locator('[data-testid="login-error-alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Acceso no autorizado: Su usuario cuenta con rol VENDEDOR");
  });

  test("bloquea navegación anónima y redirige hacia /login", async ({ page }) => {
    // Intentar acceder directamente a rutas protegidas sin sesión
    await page.goto("/live");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/routes");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/audit");
    await expect(page).toHaveURL(/\/login/);
  });

  test("permite acceso exitoso al dashboard con sesión autorizada de supervisor", async ({
    context,
    page,
  }) => {
    // Inyectar cookie de sesión autorizada de supervisor
    await context.addCookies([
      {
        name: "routrack_e2e_session",
        value: "supervisor",
        url: "http://127.0.0.1:3000",
      },
    ]);

    await page.goto("/");
    // No debe redirigir a login
    await expect(page).toHaveURL("http://127.0.0.1:3000/");
    await expect(page.locator("h1")).toContainText("Bienvenido");
  });
});

