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
2. Aplicá las migraciones de [`supabase/migrations/`](supabase/migrations) con
   la CLI (o con el workflow de GitHub, ver "Migraciones a producción"):
   ```bash
   npx supabase@3.3.0 login
   npx supabase@3.3.0 link --project-ref <ref-del-proyecto>
   npx supabase@3.3.0 db push --remote
   ```
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
  (gitignored). Si faltan, `npx supabase@3.3.0 status -o env` muestra la URL y las
  claves locales (`API_URL`, `PUBLISHABLE_KEY`, `SECRET_KEY`).
- Usuarios de prueba (contraseña `brabus-test-123`): `coach@brabus.test`,
  `coach2@brabus.test`, `alumno@brabus.test`, `alumno2@brabus.test`. Ver `supabase/seed.sql`.
- Studio local: http://127.0.0.1:54323 · emails locales: http://127.0.0.1:54324.
- Una migración nueva se prueba con `npm run db:reset` y `npm run test:db`, y después se regeneran los tipos con `npm run db:types` (ver AGENTS.md).

### Tests

```bash
npm test               # unitarios: packages/shared, packages/supabase y la web (Vitest)
npm run test:db        # RLS e integración contra el Supabase local (requiere db:start)
npm run e2e            # E2E con Playwright (requiere db:start; levanta la web en :3001)
```

- **Unitarios:** lógica pura de `packages/shared` y tests de caracterización del
  entrenador web (`apps/web/src/components/training/day-trainer.test.tsx`).
- **Base (`packages/supabase/test`):** cada corrida registra usuarios nuevos con
  la clave **pública** (igual que la app mobile) y prueba que RLS aísla a cada
  coach y alumno, que el anónimo no lee nada y que al desvincularse el alumno
  conserva sus rutinas. No dependen del seed: se pueden repetir sin `db:reset`.
- **E2E (`apps/web/e2e`):** con Playwright y los usuarios del seed, el coach
  crea una plantilla y la asigna, el alumno la entrena y guarda la sesión, y el
  coach la ve en la ficha. Usa un nombre único por corrida (se puede repetir).
  La primera vez, `npx playwright install chromium` desde `apps/web`; o, para
  usar el Chrome instalado, `PW_CHANNEL=chrome npm run e2e`.
- **Coverage:** `npx turbo run test:coverage` (y `npm run test:db --workspace=@brabus/supabase -- --coverage`).
  En CI se juntan en el resumen del job y en `main` se publica el badge (rama `badges`).

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

### Migraciones a producción (GitHub Actions)

Las migraciones **nunca** se aplican solas en cada push: se aplican a mano con
el workflow [`db-migrate.yml`](.github/workflows/db-migrate.yml), y solo desde
`main` (lo ya revisado y mergeado).

**Configuración (una vez):** en GitHub → Settings → Environments → **New
environment** `production`:
- *Deployment branches*: solo `main`. Opcional: *Required reviewers* (vos) para
  aprobar cada corrida.
- **Secrets:** `SUPABASE_ACCESS_TOKEN` (supabase.com → Account → Access Tokens) y
  `SUPABASE_DB_PASSWORD` (la contraseña de la base del proyecto).
- **Variable:** `SUPABASE_PROJECT_ID` (el *ref* del proyecto, lo que va antes
  de `.supabase.co`).

**Uso:** Actions → *Database migrations (production)* → *Run workflow* desde
`main`. Sin tildar **apply** hace un *dry run*: muestra el historial local vs.
remoto y qué migraciones aplicaría. Con **apply** las aplica (`db push`).

**Primera vez: marcar las migraciones ya aplicadas.** Las migraciones
0001–0015 se corrieron a mano en el SQL Editor, así que la tabla de historial
de producción (`supabase_migrations.schema_migrations`) no las tiene: un
`db push` intentaría correrlas de nuevo. Antes del primer `db push`, desde tu
máquina:

```bash
npx supabase@3.3.0 login
npx supabase@3.3.0 link --project-ref <ref-del-proyecto>

# 1) Ver el estado: las 15 aparecen en "Local" y vacías en "Remote".
npx supabase@3.3.0 migration list --remote

# 2) Confirmar que producción ya tiene el esquema de las 15 migraciones:
#    compara una base armada con supabase/migrations contra producción.
#    Si no imprime diferencias del esquema public, es seguro seguir.
npx supabase@3.3.0 db diff --remote --schema public

# 3) Registrarlas como aplicadas (solo escribe en la tabla de historial, no
#    corre ningún SQL de las migraciones).
npx supabase@3.3.0 migration repair --remote --status applied 0001 0002 0003 0004 0005 0006 0007 0008 0009 0010 0011 0012 0013 0014 0015

# 4) Verificar: Local y Remote coinciden, y no queda nada por aplicar.
npx supabase@3.3.0 migration list --remote
npx supabase@3.3.0 db push --remote --dry-run
```

Si el paso 2 muestra diferencias, **no** sigas con el `repair` hasta entender
cada una: puede ser una migración sin correr o un cambio hecho a mano. Los
objetos creados a mano para herramientas externas (por ejemplo un rol de solo
administración y sus `grant`) también aparecen; esos no vienen de las
migraciones y no impiden el `repair`, pero conviene pasarlos a una migración
para que la base se pueda reconstruir entera desde el repo.

### Usuarios de demo (producción)

[`scripts/seed-demo.ts`](scripts/seed-demo.ts) crea un coach y un alumno de demo con datos inventados:
- clientes, plantillas y rutinas
- un plan de nutrición
- 10 semanas de entrenamientos

Es **idempotente**: si ya existen, los borra con todo lo suyo y los vuelve a crear, así que también sirve para limpiar lo que cambien los visitantes. Usa la capa de datos de la app con la sesión de cada usuario demo, así que pasa por RLS. La clave secreta se usa solo para crear y borrar los usuarios y para fechar las sesiones en el pasado.

Desde la raíz, con las claves del proyecto como variables de entorno (no se commitean):

```bash
# bash
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_PUBLISHABLE_KEY=sb_publishable_... SUPABASE_SECRET_KEY=sb_secret_... npm run seed:demo
```

```powershell
$env:SUPABASE_URL = "https://<ref>.supabase.co"
$env:SUPABASE_PUBLISHABLE_KEY = "sb_publishable_..."
$env:SUPABASE_SECRET_KEY = "sb_secret_..."
npm run seed:demo
```

- Cuentas: `coach.demo@brabusfit.test` y `alumno.demo@brabusfit.test`. La contraseña es la del README (`brabusfit-demo`); se puede cambiar con `DEMO_PASSWORD` (en ese caso, actualizá el README).
- Antes de correrlo contra producción, probalo contra el Supabase local: `npx supabase@3.3.0 status -o env` muestra `API_URL`, `PUBLISHABLE_KEY` y `SECRET_KEY`.

### Mobile (EAS) — pendiente

Builds para las tiendas con **EAS Build** (en la nube, no requiere Mac) y
publicación con **EAS Submit**. Requiere cuentas de Apple Developer y Google
Play. Se configura cuando se encare la publicación.
