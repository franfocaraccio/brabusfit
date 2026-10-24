# Brabus Fit — Setup

Monorepo con la app **web** (Next.js, en Vercel) y la app **mobile** (Expo, iOS
+ Android), ambas sobre el mismo proyecto de **Supabase**.

## 1. Requisitos

- Node 20+ y npm (el monorepo usa npm workspaces; **instalar siempre desde la raíz**)
- Una cuenta de [Supabase](https://supabase.com)
- (Mobile) La app **Expo Go** en tu teléfono (App Store / Play Store)
- (Opcional) [Resend](https://resend.com) para emails y credenciales OAuth de Google

## 2. Crear el proyecto Supabase

1. Creá un proyecto nuevo en Supabase.
2. En **SQL Editor**, pegá y ejecutá [`supabase/setup.sql`](supabase/setup.sql)
   (todas las migraciones juntas). Si ya tenías la base, corré solo las
   migraciones nuevas de [`supabase/migrations/`](supabase/migrations).
3. En **Settings → API Keys**, copiá:
   - Project URL (sin `/rest/v1/`)
   - **Publishable key** (`sb_publishable_…`) — pública
   - **Secret key** (`sb_secret_…`) — ¡secreta! Solo para la web (server).

## 3. Auth: email + Google

- **Email/Password**: activo por defecto. "Confirm email" está desactivado a
  propósito hasta tener un dominio propio para enviar emails (ver ROADMAP).
- **Google (SSO, solo web por ahora)**: en **Authentication → Providers →
  Google**, cargá el Client ID / Secret del OAuth Client de Google Cloud, con
  *Authorized redirect URI* `https://<TU-PROYECTO>.supabase.co/auth/v1/callback`.
- **Authentication → URL Configuration**: Site URL = URL de producción, y
  Redirect URLs `http://localhost:3000/auth/callback` + `https://<tu-dominio>/auth/callback`.

## 4. Variables de entorno

### Web — `apps/web/.env.local` (no se commitea)

Copiá [`apps/web/.env.example`](apps/web/.env.example):

```
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
RESEND_API_KEY=
RESEND_FROM_EMAIL=Brabus Fit <no-reply@tudominio.com>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Mobile — `apps/mobile/.env` (no se commitea)

Copiá [`apps/mobile/.env.example`](apps/mobile/.env.example). **Solo valores
públicos** (las variables `EXPO_PUBLIC_*` quedan dentro de la app):

```
EXPO_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## 5. Correr en local

```bash
npm install            # desde la raíz
npm run dev            # web → http://localhost:3000
npm run dev:mobile     # mobile → QR para Expo Go
```

**Probar mobile en tu teléfono:** con la compu y el teléfono en la **misma red
wifi**, corré `npm run dev:mobile`, abrí **Expo Go** y escaneá el QR (en iPhone,
con la cámara). Si la red bloquea la conexión, usá
`npm run start --workspace=@brabus/mobile -- --tunnel`. Expo Go tiene que estar
logueado con la misma cuenta de Expo que la CLI (`npx expo login`, cuenta `franfoca`).
El proyecto pertenece a la organización `brabusfit-team`: para que otra persona
lo abra en Expo Go, invitarla en expo.dev → brabusfit-team → Members (rol Viewer).
Para abrirla: escanear `docs/expo-go-qr.png` con la cámara (link fijo al canal
`main`, siempre trae la última versión publicada):
`exp://u.expo.dev/6f6c74e5-fc15-451d-9808-66cce2ea769d?channel-name=main&runtime-version=exposdk:58.0.0`

**Usar la app fuera de casa (EAS Update):** desde `apps/mobile`, corré
`npm run publish`. Sube la versión actual del código a Expo (branch `main`) y
aparece en Expo Go → perfil → proyecto *brabus-fit*, usable desde cualquier red
sin la compu. Las variables `EXPO_PUBLIC_*` se toman del entorno `production`
de EAS (expo.dev → proyecto → Environment variables), no del `.env` local.
`runtimeVersion` está fijado en `exposdk:58.0.0` (cambiarlo al subir de SDK) para que Expo Go acepte las
updates; al pasar a builds propias (EAS Build) cambiarlo a `{"policy": "appVersion"}`.

### Entorno local (Supabase en Docker)

Para desarrollar y probar sin tocar producción. Requiere **Docker Desktop** corriendo.

```bash
npm run db:start       # levanta Supabase local + migraciones + supabase/seed.sql
npm run local:web      # web → http://localhost:3001 contra la base local
npm run local:mobile   # mobile en el navegador → http://localhost:8081
npm run db:reset       # borra todo y vuelve a aplicar migraciones + seed
npm run db:stop
```

- Las variables locales van en `apps/web/.env.localdb` y `apps/mobile/.env.localdb`
  (gitignored). Si faltan, `npx supabase status -o env` muestra la URL y las
  claves locales (`API_URL`, `PUBLISHABLE_KEY`, `SECRET_KEY`).
- Usuarios de prueba (contraseña `brabus-test-123`): `coach@brabus.test`,
  `coach2@brabus.test`, `alumno@brabus.test`, `alumno2@brabus.test`. Ver `supabase/seed.sql`.
- Studio local: http://127.0.0.1:54323 · emails locales: http://127.0.0.1:54324.
- Una migración nueva se prueba con `npm run db:reset` antes de correrla en producción.

> Si `expo start` falla con `Cannot find module 'expo-router/...'`, borrá
> `node_modules` (raíz y workspaces) y `package-lock.json` y volvé a correr
> `npm install` desde la raíz: npm a veces anida paquetes al instalar en tandas.

## 6. Deploy

### Web (Vercel)

- **Root Directory:** `apps/web` (Settings → Build and Deployment), con
  "Include files outside the root directory" activado (usa `packages/`).
- Variables de entorno: las mismas de `apps/web/.env.local`
  (`NEXT_PUBLIC_SITE_URL` = dominio de producción).
- Push a `main` → deploy automático a producción; otras ramas → Preview.

### Mobile (EAS) — pendiente

Builds para las tiendas con **EAS Build** (en la nube, no requiere Mac) y
publicación con **EAS Submit**. Requiere cuentas de Apple Developer y Google
Play. Se configura cuando se encare la publicación.
