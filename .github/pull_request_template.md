## What and why

<!-- What changes and why. Link the issue if there is one. -->

## How it was verified

<!-- Commands run, manual checks (web and mobile), screenshots for UI changes. -->

## Checklist

- [ ] `npx turbo run typecheck lint test` passes
- [ ] `npx turbo run build --filter=@brabus/web` passes
- [ ] Web and mobile both updated (or the PR says why not)
- [ ] Schema change: new migration, `npm run test:db` passes and `npm run db:types` committed
- [ ] Mobile change: `npx expo-doctor` and `npx expo export` from `apps/mobile`
- [ ] Production steps listed below (migration workflow, `npm run publish`), if any

## Production steps

<!-- e.g. "Run Database migrations (production) after merging", or "None". -->
