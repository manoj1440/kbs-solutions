Read `AGENTS.md` first, then `DOCS/PROGRESS.md`, then the feature file PROGRESS points at. Follow the session start/end protocols in AGENTS.md exactly.

## Design skills (global, auto-enabled)
UI design skills are installed globally (`~/.claude/skills`, routing in `~/.claude/CLAUDE.md`). In this repo:
- Use `impeccable` (`/impeccable critique|audit|polish|harden`) on `apps/web` and `apps/mobile` UI work, and `playwright-cli` to screenshot-verify.
- `design-references` / `refero-design` for researching patterns (e.g. tables, forms, dashboards) before new screens.
- ADR-003 wins: shadcn/ui on web, react-native-reusables on mobile, tokens from `packages/ui-tokens`. Do not apply `design-system-styles`, taste style variants, `scroll-craft`, `scroll-world` or `img2threejs` here unless the user asks.
