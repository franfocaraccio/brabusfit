# Brabus Fit

App de rutinas de entrenamiento para **coaches** y **alumnos**, en **web** y
**mobile (iOS + Android)**.

- Los **coaches** crean rutinas (organizadas en carpetas) y las comparten con
  sus alumnos por email o nombre de usuario.
- Los **alumnos** usan las rutinas compartidas (o las propias) y registran peso
  y repeticiones por serie; el coach ve el progreso.

## Monorepo

```
apps/
  web/          Next.js 16 (App Router) — deploy en Vercel (Root Directory: apps/web)
  mobile/       Expo SDK 58 + Expo Router — iOS y Android con un solo código
packages/
  shared/       Tipos de la base, validaciones y helpers (TypeScript puro)
  supabase/     Consultas y mutaciones compartidas (reciben el cliente Supabase)
supabase/
  migrations/   Esquema SQL, funciones RPC y políticas RLS (una sola base)
docs/
  ROADMAP.md    Decisiones de arquitectura y próximos módulos
```

La lógica de datos vive en `packages/supabase` y la usan **las dos apps**. La
seguridad (quién ve qué) la garantiza la base con **RLS**, así que la app mobile
usa solo la clave pública de Supabase.

## Stack

- **Web:** Next.js 16 + React 19 + TypeScript, Tailwind CSS v4 + shadcn/ui (base-ui)
- **Mobile:** Expo SDK 58, React Native 0.88, Expo Router
- **Backend:** Supabase (Postgres + Auth email/Google + RLS)
- **Tooling:** npm workspaces + Turborepo
- **Deploy:** Vercel (web) · EAS (mobile, cuando se publique)

## Comandos (desde la raíz)

```bash
npm install          # instala todo el monorepo (siempre desde la raíz)
npm run dev          # web en http://localhost:3000
npm run dev:mobile   # Expo: escaneá el QR con Expo Go
npm run build        # build de todo
npm run lint         # lint de todo
npm run typecheck    # typecheck de todo
```

Setup completo (Supabase, variables de entorno, deploy, mobile): ver
**[SETUP.md](SETUP.md)**.
