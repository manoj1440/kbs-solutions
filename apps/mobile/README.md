# mobile

Expo SDK 57 (dev-client) + Expo Router + NativeWind, Android-first (REQ-02 §2.1).

```
cp .env.example .env
pnpm --filter mobile prebuild        # generates android/ (git-ignored)
pnpm --filter mobile android         # builds + installs the dev client on an emulator/device
pnpm --filter mobile start           # Metro for the dev client
pnpm --filter mobile build:apk       # preview APK via EAS (local build)
```

- `app/(auth)` welcome → mobile → OTP (S01, S06, S07); `app/(gates)` training / network-blocked / onboarding / deactivated;
  `app/(telecaller|advisor|manager)` role tab areas. Routing is decided by `lib/routing.ts` from `/auth/me` gates (F-111).
- Tokens are kept in `expo-secure-store`; the API client refreshes single-flight on 401 (`lib/api.ts`).
- `components/ui` are shadcn-style RN primitives on shared tokens (ADR-003). The react-native-reusables registry can replace them
  when network access allows (`npx @react-native-reusables/cli@latest add button …`).
- `components/secure-screen.tsx` applies FLAG_SECURE (F-302). Limits documented in `DOCS/runbooks/02-mobile-security-limits.md`.
- Emulator reaches the host API at `http://10.0.2.2:4000`; a physical device needs your LAN IP in `EXPO_PUBLIC_API_URL` and `WEB_ORIGIN` on the API.
