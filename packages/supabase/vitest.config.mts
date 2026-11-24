import { defineConfig } from "vitest/config";

process.env.TZ = "America/Argentina/Buenos_Aires";

// Tests unitarios (sin base). Los de RLS e integración están en
// vitest.db.config.mts (`npm run test:db`).
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    env: { TZ: "America/Argentina/Buenos_Aires" },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
      reporter: ["text-summary", "json-summary"],
    },
  },
});
