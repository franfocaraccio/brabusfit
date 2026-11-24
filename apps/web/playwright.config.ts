import { defineConfig, devices } from "@playwright/test";

/**
 * E2E de la web contra un Supabase LOCAL (migraciones + supabase/seed.sql).
 *
 * - En local: levanta (o reutiliza) `npm run local:web` en el puerto 3001.
 * - En CI: la web ya está compilada con las variables del Supabase local y se
 *   sirve con `next start` (ver .github/workflows/ci.yml, job "e2e").
 */
const PORT = 3001;
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  // Los pasos dependen unos de otros (coach → alumno → coach).
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // PW_CHANNEL=chrome usa el Chrome instalado en vez de bajar Chromium.
        ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
      },
    },
  ],
  webServer: {
    command: CI ? `npx next start --port ${PORT}` : "npm run local:web",
    cwd: CI ? "." : "../..",
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
});
