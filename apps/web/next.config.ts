import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Paquetes del monorepo publicados como código TypeScript (sin build propio).
  transpilePackages: ["@brabus/shared", "@brabus/supabase"],
  // "Alumnos" pasó a llamarse "Clientes" (las fichas tienen ids nuevos).
  async redirects() {
    return [{ source: "/alumnos/:path*", destination: "/clientes", permanent: false }];
  },
};

export default nextConfig;
