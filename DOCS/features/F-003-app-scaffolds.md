# F-003 Application scaffolds (api, web, mobile)

- Group: Foundation · Status: **PLANNED** · Depends on: F-001, F-002
- PRD refs: REQ-02 §2.1 (Android APK with React Native; web admin), REQ-20 §20.1, ADR-002, ADR-003

## Scope
- `apps/api`: NestJS 11 app, `main.ts` with pino logger, Helmet, CORS from `WEB_ORIGIN`, global prefix `/api/v1`, Zod validation pipe, health endpoint `GET /api/v1/health` (db + redis ping). Jest configured. `WORKER_MODE=1` boots only the jobs module (F-110).
- `apps/web`: Next.js 16 App Router, Tailwind v4, shadcn/ui initialised (`components.json`, `lib/utils.ts`, base components: button, input, card, badge, dialog, table, sidebar, sheet, toast/sonner, dropdown-menu, form, label, select, tabs, tooltip, skeleton). ESLint from `@kbs/config`.
- `apps/mobile`: Expo SDK 57 with `expo-router`, `expo-dev-client`, `expo-secure-store`, `expo-screen-capture`, NativeWind v4, `react-native-reusables` base components (button, input, card, text, badge, dialog, tabs, skeleton), `metro.config.js` with monorepo watchFolders and `nodeModulesPaths`, `app.json` Android package `com.kbs.dsa`, `eas.json` with `development` (dev-client APK) and `preview` (APK) profiles.
- Each app has a README with run instructions.

## Acceptance criteria
- [ ] `pnpm --filter api build` and `pnpm --filter web build` pass.
- [ ] `pnpm --filter mobile typecheck` passes; `npx expo export` not required in CI.
- [ ] Health endpoint responds `{ status: 'ok', db: true, redis: true }` with infra up.
