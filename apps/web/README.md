# web

Next.js 16 (App Router) + Tailwind v4 + shadcn/ui for Admin, Manager and Accounts.

```
cp .env.example .env.local
pnpm --filter web dev      # http://localhost:3000
```

- `src/components/ui` — shadcn components (owned code). `components.json` is configured; add more with `npx shadcn@latest add <name>`.
- `src/components/status` — Stage / Decision / Activation / Payout badges and provenance chips (F-803).
- `src/app/(admin|manager|accounts)` — role areas guarded server-side by `requireRole` (F-801); `src/proxy.ts` redirects unauthenticated traffic to `/login`.
- Auth uses httpOnly cookies set by the API (`platform: WEB`); the browser never handles tokens.
- Fonts: system stack for now (Google Fonts is fetched at build time by `next/font/google`, which fails offline; self-host Inter in F-801 polish).
