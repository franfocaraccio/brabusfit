import { execSync } from "node:child_process";

import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    supabase: { url: string; publishableKey: string };
  }
}

/**
 * Los tests de base corren contra el Supabase local (`npm run db:start`).
 * Solo usan la clave PÚBLICA, igual que la app mobile: todo lo que se puede o
 * no se puede hacer lo decide la base (RLS + funciones SQL).
 */
export default function setup(project: TestProject) {
  let url = process.env.SUPABASE_URL;
  let publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    let status: Record<string, string>;
    try {
      const out = execSync("npx supabase status -o json", {
        cwd: new URL("../../..", import.meta.url),
        stdio: ["ignore", "pipe", "ignore"],
      }).toString();
      status = JSON.parse(out.slice(out.indexOf("{")));
    } catch {
      throw new Error(
        "No encontré el Supabase local. Levantalo con `npm run db:start` (o definí SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY).",
      );
    }
    url = status.API_URL;
    publishableKey = status.PUBLISHABLE_KEY;
  }

  project.provide("supabase", { url, publishableKey });
}
