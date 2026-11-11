import { defineConfig, devices } from "@playwright/test";
import path from "path";

/**
 * ROUTRACK — Configuración Oficial de Playwright E2E (TASK-024)
 * Archivo: web-admin/playwright.config.ts
 *
 * Configura la ejecución automatizada de pruebas End-to-End en Chromium y Firefox
 * en modo headless, con inicio automático del servidor Next.js de producción (npm run start).
 */
export default defineConfig({
  testDir: path.join(__dirname, "e2e"),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:3000",
        headless: true,
      },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        baseURL: "http://127.0.0.1:3000",
        headless: true,
      },
    },
  ],
  webServer: {
    command: "npm run start",
    cwd: __dirname,
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});

