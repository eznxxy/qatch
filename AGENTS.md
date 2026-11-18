# AGENTS.md — Qatch

> Qatch is a Chrome (Manifest V3) extension plus a web backend that lets a user capture a bug
> (screenshot or screen recording) together with console logs, network requests and device info, then share it
> as a link or send it to an issue tracker, with an optional AI-assisted root-cause analysis.

## Read first

Before any non-trivial task, read the relevant doc in `docs/`:

- `docs/PRD.md`: what we build and why, with requirement IDs (FR-xx)
- `docs/ARCHITECTURE.md`: components, message flow, capture techniques, key decisions
- `docs/API_AND_DATA.md`: database schema, REST API, report payload format
- `docs/SECURITY_PRIVACY.md`: redaction rules and security requirements (non-negotiable)
- `docs/PLAN.md`: phased task list with checkboxes. **This is the source of truth for progress.**

## Out of scope (do NOT build)

- Camera / webcam recording
- "Rewind" / session replay / rrweb / always-on background recording
- Firefox, Safari, Edge-specific work, mobile, desktop-app bugs

## Tech stack

- Monorepo: pnpm workspaces, TypeScript (strict) everywhere
- `apps/extension`: WXT (Vite) + React, Manifest V3, Fabric.js for annotation
- `apps/web`: Next.js (App Router), Postgres via Drizzle ORM, S3-compatible storage (Cloudflare R2 / S3), Zod
- `packages/shared`: shared types, Zod schemas, constants (report payload, message types)
- Tests: Vitest (unit), Playwright (e2e for web and extension)

## Commands

```bash
pnpm install
pnpm dev:ext        # run extension in dev (WXT), loads in Chrome
pnpm dev:web        # run Next.js app
pnpm build          # build all packages
pnpm typecheck      # tsc --noEmit across workspaces
pnpm lint           # eslint + prettier check
pnpm test           # vitest
pnpm db:generate    # drizzle-kit generate
pnpm db:migrate     # drizzle-kit migrate
```

Run `pnpm typecheck && pnpm lint && pnpm test` before declaring any task done.

## Repo layout

```
apps/
  extension/
    entrypoints/
      background.ts          # service worker (stateless, event-driven)
      content.ts             # isolated-world content script (overlays, messaging)
      injected.ts            # MAIN-world script (console + fetch/XHR hooks)
      offscreen/             # offscreen document (MediaRecorder, canvas work)
      popup/                 # popup UI
      editor/                # annotation + report form page
    lib/                     # capture, redact, messaging, api client
  web/
    app/                     # routes: dashboard, /r/[id] viewer, /api/*
    db/                      # drizzle schema + migrations
    lib/                     # auth, storage, integrations, ai
packages/
  shared/                    # types, zod schemas, message contracts
docs/
```

## Conventions

- TypeScript strict, no `any` (use `unknown` + Zod parsing at boundaries).
- Validate every network boundary with Zod schemas from `packages/shared`.
- Prefer small pure functions; keep Chrome API calls in `apps/extension/lib/*` wrappers so they can be mocked.
- Named exports; files in `kebab-case.ts`; React components in `PascalCase.tsx`.
- No default secrets in code. Config via env vars; document new ones in `.env.example`.
- Commit style: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`).

## Chrome extension rules (MV3)

- The service worker can be killed at any time. **Never keep required state only in memory**; persist to
  `chrome.storage.session` / IndexedDB.
- The service worker has no DOM. Use the offscreen document for `MediaRecorder`, canvas and blob work.
- Console / `fetch` / `XHR` hooks MUST run in the page's MAIN world (`injected.ts`). Isolated-world content
  scripts cannot see the page's JS objects. Relay to the content script with `window.postMessage` using a
  per-session nonce, and verify `event.source === window` and the nonce on receipt.
- Use `activeTab` + `scripting` and inject on demand. Do **not** add `<all_urls>` host permissions.
- Request the minimum permissions; every new permission needs justification in `docs/ARCHITECTURE.md`.
- No remotely hosted code, no `eval`, no inline scripts (MV3 CSP).
- Never call the LLM or hold third-party API secrets in the extension. Those live on the backend.

## Security rules (summary; see docs/SECURITY_PRIVACY.md)

- Redact `Authorization`, `Cookie`, `Set-Cookie`, tokens and password-like fields **before** data leaves the
  page context.
- Cap body sizes and log counts. Skip binary bodies.
- Presigned upload URLs only; the backend never trusts client-supplied user IDs.
- Treat all report content as untrusted: sanitize when rendering in the viewer (no `dangerouslySetInnerHTML`).

## Workflow for agents

1. Open `docs/PLAN.md`, pick the next unchecked task, and work on **one task at a time**.
2. Re-read the linked FR-xx requirements before coding.
3. Write or update tests alongside code.
4. Tick the checkbox in `docs/PLAN.md` and add a one-line note if you deviated from the plan.
5. If a requirement is ambiguous, ask instead of guessing. If you change an architecture decision, update
   `docs/ARCHITECTURE.md` in the same change.

## Definition of done

- Typecheck, lint and tests pass
- Behavior matches the FR-xx requirement and acceptance criteria
- No new permission or dependency without justification
- Docs and `.env.example` updated if applicable
