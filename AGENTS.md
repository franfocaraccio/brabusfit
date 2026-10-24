# Brabus Fit — notas para agentes

Monorepo (npm workspaces + Turborepo). Cada app tiene sus propias notas:

- `apps/web/AGENTS.md` — Next.js 16 (APIs distintas a las de tu entrenamiento:
  leer `node_modules/next/dist/docs/` antes de escribir código).
- `apps/mobile/AGENTS.md` — Expo SDK 58 (consultar la doc versionada de Expo,
  usar `npx expo install` para dependencias nativas).

## Reglas del monorepo

- `npm install` **siempre desde la raíz**. Una sola copia de React (19.3.0, la de Expo SDK 58) para
  todo el repo: web y mobile deben usar la misma versión.
- La lógica de datos va en `packages/supabase` (funciones que reciben el cliente
  Supabase) y los tipos/validaciones en `packages/shared`. Las apps solo agregan
  lo propio de su plataforma (UI, revalidación de caché, emails server-side).
- La seguridad vive en la base (RLS + funciones SQL). La app mobile usa solo la
  clave **pública** de Supabase; la secret key nunca sale de `apps/web` (server).
- Cambios de schema: nueva migración en `supabase/migrations/` + regenerar
  `supabase/setup.sql` + actualizar `packages/shared/src/database.ts`. Las
  migraciones se corren a mano en el SQL Editor de Supabase.

- **Paridad web ↔ mobile:** toda funcionalidad se implementa en las dos apps,
  salvo que se acuerde lo contrario. Después de cambiar la mobile, publicarla con
  `npm run publish` (desde `apps/mobile`, EAS Update).
- Para probar con usuarios reales sin tocar producción: Supabase local
  (`npm run db:start`, `npm run local:web`, `npm run local:mobile`; ver SETUP.md).

## Verificación antes de commitear

```bash
npx turbo run typecheck lint
npx turbo run build --filter=@brabus/web
```

Para mobile, además: `npx expo-doctor` y `npx expo export` desde `apps/mobile`.

## Versión de Expo

El proyecto usa **SDK 58** (React Native 0.88, React 19.3) porque es la que
soporta Expo Go del App Store (verificar en Expo Go → configuración →
"Supported SDK"). Expo Go del App Store abre solo **la última** SDK: cuando se
actualiza, la app deja de abrir hasta subir el proyecto (pasó de 57 a 58).

Al subir de SDK:
1. `npm install expo@~<versión> --workspace=@brabus/mobile` desde la raíz y
   `npx expo install --fix` desde `apps/mobile`.
2. Alinear React (y `@types/react`) de la web a la misma versión exacta.
3. Si `npx expo-doctor` marca copias duplicadas, regenerar el lockfile: borrar
   `package-lock.json` y todos los `node_modules`, y `npm install` desde la raíz.
4. Cambiar `runtimeVersion` en `app.json` (`exposdk:<versión>.0.0`) y el link y
   el QR de Expo Go (SETUP.md y `docs/expo-go-qr.png`).
5. Revisar APIs que cambian. Ej.: desde SDK 58 `usePreventRemove` se importa de
   `expo-router`; con React Native 0.88 cambió el tipado de `StyleSheet.create`
   (ver `makeStyles` en `apps/mobile/src/lib/theme.tsx`).
6. Publicar con `npm run publish` desde `apps/mobile`.
