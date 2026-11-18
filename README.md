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
pnpm dev:web
pnpm dev:ext   # then load the built extension from chrome://extensions (Developer mode)
```

## Using with OpenCode
1. Copy this folder's contents into your repo root.
2. Run `opencode` in the repo, then `/init` (it will keep or refine the provided `AGENTS.md`).
3. Prompt: "Read docs/PLAN.md and complete task P0-1."
