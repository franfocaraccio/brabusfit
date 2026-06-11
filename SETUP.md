# Brabus Fit — Setup

App web de rutinas para coaches y alumnos. Next.js + Supabase + Tailwind/shadcn, desplegable en Vercel.

## 1. Requisitos

- Node 20+
- Una cuenta de [Supabase](https://supabase.com) (plan free alcanza para el POC)
- (Opcional) Una cuenta de [Resend](https://resend.com) para emails de aviso
- (Opcional) Credenciales OAuth de Google para el login con Gmail

## 2. Crear el proyecto Supabase

1. Creá un proyecto nuevo en Supabase.
2. En **SQL Editor**, pegá y ejecutá el contenido de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). Esto crea todas las tablas, triggers (incluido el de creación de perfil + vinculación de rutinas compartidas) y las políticas RLS.
3. En **Settings → API**, copiá:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (¡secreta!)

## 3. Auth: email + Google

- **Email/Password**: viene activado por defecto. Para el POC podés desactivar
  "Confirm email" en **Authentication → Providers → Email** para entrar sin
  confirmar. Si lo dejás activo, el alta redirige a "revisá tu email".
- **Google (SSO)**: en **Authentication → Providers → Google**, cargá el
  Client ID / Secret de un OAuth Client de Google Cloud. En el OAuth Client
  agregá como *Authorized redirect URI*:
  `https://<TU-PROYECTO>.supabase.co/auth/v1/callback`.
- En **Authentication → URL Configuration**, agregá tus *Redirect URLs*:
  `http://localhost:3000/auth/callback` y la de producción
  `https://<tu-dominio>/auth/callback`.

## 4. Variables de entorno

Copiá `.env.example` a `.env.local` y completá los valores:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
RESEND_FROM_EMAIL=Brabus Fit <no-reply@tudominio.com>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> Sin `RESEND_API_KEY` la app funciona igual: los emails de aviso se omiten
> (se loguean en consola) y la rutina se comparte de todas formas.

## 5. Correr en local

```bash
npm install
npm run dev
```

Abrí http://localhost:3000

## 6. Deploy a Vercel

1. Importá el repo en Vercel.
2. Cargá las mismas variables de entorno en **Settings → Environment Variables**
   (cambiá `NEXT_PUBLIC_SITE_URL` por tu dominio de producción).
3. Agregá la URL de producción a las Redirect URLs de Supabase (paso 3).
