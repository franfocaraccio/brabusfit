import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Paquetes del monorepo publicados como código TypeScript (sin build propio).
  transpilePackages: ["@brabus/shared", "@brabus/supabase"],
};

export default nextConfig;
