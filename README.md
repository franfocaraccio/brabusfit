# Brabus Fit

App web de rutinas de entrenamiento para **coaches** y **alumnos**.

- Los **coaches** crean rutinas y las comparten con sus alumnos por email.
- Los **alumnos** crean sus propias rutinas y usan las que les comparte su coach,
  registrando peso y repeticiones para llevar el progreso (que el coach puede ver).
- Mobile-first: pensada para usarse desde el celular mientras se entrena.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS v4** + **shadcn/ui**
- **Supabase**: Postgres + Auth (email/password y Google SSO) + Row Level Security
- **Resend** (opcional) para emails de aviso/invitación
- Deploy en **Vercel**

## Cómo arrancar

Ver **[SETUP.md](SETUP.md)** para la configuración paso a paso (crear el proyecto
Supabase, correr la migración, variables de entorno y deploy).

```bash
npm install
# completá .env.local (ver SETUP.md)
npm run dev
```

## Estructura

```
src/
  app/(auth)/         login y signup
  app/(app)/          dashboard, rutinas, alumnos, perfil (rutas protegidas)
  components/         UI (shadcn), auth, rutinas, training, app
  lib/supabase/       clientes (browser/server) + tipos de la DB
  lib/actions/        server actions (auth, routines, shares, training)
supabase/migrations/  esquema SQL, funciones RPC y políticas RLS
```
