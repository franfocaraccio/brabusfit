import { defineConfig } from "vitest/config";

// Las métricas por semana y las fechas usan la hora local: fijamos la zona
// horaria para que los tests den lo mismo en cualquier máquina y en CI.
process.env.TZ = "America/Argentina/Buenos_Aires";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    env: { TZ: "America/Argentina/Buenos_Aires" },
  },
});
