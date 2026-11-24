import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

process.env.TZ = "America/Argentina/Buenos_Aires";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    env: { TZ: "America/Argentina/Buenos_Aires" },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}"],
      reporter: ["text-summary", "json-summary"],
    },
  },
});
