# Brabus Fit — notas para agentes

Monorepo (npm workspaces + Turborepo). Cada app tiene sus propias notas:

- `apps/web/AGENTS.md` — Next.js 16 (APIs distintas a las de tu entrenamiento:
  leer `node_modules/next/dist/docs/` antes de escribir código).
- `apps/mobile/AGENTS.md` — Expo SDK 57 (consultar la doc versionada de Expo,
  usar `npx expo install` para dependencias nativas).

## Reglas del monorepo

- `npm install` **siempre desde la raíz**. Una sola copia de React (19.2.3, la de Expo SDK 57) para
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

El proyecto usa **SDK 57** porque es la última que soporta Expo Go del App
Store (verificar en Expo Go → configuración → "Supported SDK"). Subir de SDK
solo cuando Expo Go lo soporte, o cuando se use una development build. Al subir:
alinear React de la web a la misma versión y revisar APIs (ej. `usePreventRemove`
se importa de `expo-router/react-navigation` en SDK 57; desde SDK 58 viene en
`expo-router`).
