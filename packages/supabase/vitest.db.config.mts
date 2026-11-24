import { defineConfig } from "vitest/config";

process.env.TZ = "America/Argentina/Buenos_Aires";

// Tests de RLS e integración contra el Supabase local (`npm run db:start`).
// Ver test/global-setup.ts.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    env: { TZ: "America/Argentina/Buenos_Aires" },
    // Cada archivo arma sus usuarios en beforeAll y los tests los comparten.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
