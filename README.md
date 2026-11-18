# Qatch

Chrome extension + web app for fast, context-rich bug reports: screenshots, screen recordings, console logs,
network requests and device info, shareable as a link or exportable to Linear, Jira and GitHub, with optional
AI root-cause analysis.

## Docs

- [PRD](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API and data model](docs/API_AND_DATA.md)
- [Security and privacy](docs/SECURITY_PRIVACY.md)
- [Implementation plan](docs/PLAN.md)

## Getting started

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm db:up     # local Postgres via docker compose (data in .data/); `pnpm db:down` stops it
pnpm db:migrate
pnpm dev:web   # http://localhost:3000
pnpm dev:ext   # opens Chrome with the dev build (apps/extension/.output/chrome-mv3-dev)
```

`pnpm build` needs `WXT_API_ORIGIN` for the extension (copy `apps/extension/.env.example` to
`apps/extension/.env.production`); the unpacked build is in `apps/extension/.output/chrome-mv3`.

## Using with OpenCode

1. Copy this folder's contents into your repo root.
2. Run `opencode` in the repo, then `/init` (it will keep or refine the provided `AGENTS.md`).
3. Prompt: "Read docs/PLAN.md and complete task P0-1."
