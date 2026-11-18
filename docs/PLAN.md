# Implementation Plan

Source of truth for progress. Work **one task at a time**, in order. Tick the box when done (typecheck, lint
and tests passing). Requirement IDs refer to `PRD.md`.

Legend: `[ ]` todo · `[x]` done · **(manual)** needs a human check

---

## Phase 0: Project setup

- [x] **P0-1** Init pnpm monorepo: `apps/extension`, `apps/web`, `packages/shared`; root scripts from `AGENTS.md`
  - Note: packages scoped `@qatch/*`; `build`/`typecheck`/`lint`/`test` delegate with `pnpm -r --if-present` (valid
    now, become real in P0-2); `dev:ext`/`dev:web` are wired but need the workspace `dev` scripts from P0-3/P0-4.
- [x] **P0-2** Strict TypeScript base config, ESLint, Prettier, Vitest; CI workflow (typecheck, lint, test)
  - Note: TypeScript pinned `~6.0` (typescript-eslint 8 does not support TS 7 yet). `lint` runs once at the root
    (`eslint . && prettier --check .`); Prettier reformatted the docs (whitespace/tables only). CI also runs
    `pnpm audit`; GHSA-fc5q-39xc-vjpf (dev-only picomatch, no fix published) is ignored in
    `pnpm-workspace.yaml` until a patch ships. `.gitattributes` forces LF.
- [ ] **P0-3** Scaffold WXT extension (React, MV3) with empty background, content, popup, editor, offscreen entrypoints
  - Pin a public `key` in the manifest for a stable extension ID; record the ID (ADR 12). Keep the `.pem` out of git.
  - `host_permissions`: the API origin only, from env per environment (ADR 12).
- [ ] **P0-4** Scaffold Next.js app, Drizzle + Postgres (docker-compose for local DB), `.env.example`
- [ ] **P0-5** `packages/shared`: message types, `ConsoleEntry`, `NetworkEntry`, `DeviceInfo`, Zod schemas
  - `src/config.ts` (recording limits) already exists; wire it into the package exports here.

**Exit:** `pnpm build` and `pnpm dev:ext` load an empty extension; `pnpm dev:web` serves a page.

## Phase 1: Local screenshot and annotation (FR-01, 03, 04, 09)

- [ ] **P1-1** Popup with capture-mode buttons; worker handles `capture/start` (activeTab)
- [ ] **P1-2** Visible-tab screenshot via `captureVisibleTab` → draft saved in IndexedDB → opens editor (FR-01)
- [ ] **P1-3** Device info collector with unit tests (FR-09)
- [ ] **P1-4** Region-select overlay in content script; DPR-correct crop on canvas (FR-03)
- [ ] **P1-5** Editor page with Fabric.js: arrow, rectangle, freehand, text, blur, undo/redo; export PNG (FR-04)
- [ ] **P1-6** Draft persistence/recovery after service worker restart or tab close

**Exit:** user can capture visible/region, annotate, and download the PNG locally.

## Phase 2: Console and network capture (FR-07, 08, 23, 24)

- [ ] **P2-1** `redaction.ts` in `packages/shared` with exhaustive unit tests (headers, URLs, JSON/form bodies, console patterns) (FR-23)
  - Dependency-free (no Zod): it is bundled into `injected.ts` (SECURITY_PRIVACY §2).
- [ ] **P2-2** `injected.ts` (MAIN world): console hooks, `onerror`, `unhandledrejection`, safe serializer
- [ ] **P2-3** `fetch` + XHR hooks: headers, bodies (text/JSON, capped), timing, errors; response cloning
- [ ] **P2-4** Nonce-secured `postMessage` bridge to content script → worker → draft; sender validation
  - Treat page messages as untrusted: Zod-validate and re-cap in the content script (nonce is not a boundary).
- [ ] **P2-5** On-demand injection on capture start; buffers with entry/size caps and `truncated` flags
- [ ] **P2-6** Editor tabs: Console, Network, Device with per-entry delete and "remove bodies" (FR-24)
- [ ] **P2-7** Fixture page + Playwright test asserting captured events and redaction

**Exit:** a fixture page producing errors and failing requests yields correct, redacted entries in the editor.

## Phase 3: Backend, auth, sharing (FR-11 to 15)

- [ ] **P3-1** Drizzle schema + migration for `users`, `reports`, `report_assets` (see `API_AND_DATA.md`)
- [ ] **P3-2** Auth with Better Auth (decided, ADR 8): web sign-in/out, bearer-token plugin for the extension
- [ ] **P3-3** Extension sign-in via `launchWebAuthFlow`; token storage and refresh
- [ ] **P3-4** `POST /api/uploads/presign` (+ limits from `packages/shared/src/config.ts`) and S3/R2 client
  - Bucket CORS: allow `PUT` from `chrome-extension://<pinned id>` and the web origin.
- [ ] **P3-5** `POST /api/reports` with Zod validation, share token generation, ownership
- [ ] **P3-6** Editor submit flow: upload assets, create report, show share link, retry/resume on failure
- [ ] **P3-7** Viewer `/r/[id]`: image/video, description, Console/Network/Device tabs, safe rendering
- [ ] **P3-8** Visibility rules + 404 behavior + rotate-link; tests for each access case
  - Public = loads without a token; unlisted = token required (API_AND_DATA §3).

**Exit:** capture → annotate → submit → open share link as an anonymous visitor (unlisted) works end to end.

## Phase 4: Full-page screenshot (FR-02)

- [ ] **P4-1** Scroll-and-stitch with rate-limit-aware capture loop and offscreen canvas stitching
- [ ] **P4-2** Handle sticky/fixed elements (hide after first frame, restore); lazy-load nudge; max height cap
- [ ] **P4-3** Optional `chrome.debugger` fallback via `optional_permissions` (runtime request)
- [ ] **P4-4** Tests for stitching math; **(manual)** verify on long pages with sticky headers

## Phase 5: Screen recording (FR-05, 06)

- [ ] **P5-1** Offscreen document + `chrome.offscreen` lifecycle; `getDisplayMedia`/`tabCapture` stream
- [ ] **P5-2** `MediaRecorder` pipeline, chunks to IndexedDB, "Record Screen" / Stop UI with timer and max duration
  - Cap from `RECORDING_MAX_MINUTES` (default 30) in `packages/shared/src/config.ts`; stream each chunk to IndexedDB.
- [ ] **P5-3** Optional mic toggle (off by default) with permission handling (FR-06)
- [ ] **P5-4** Multipart video upload via presigned URLs; viewer video playback with console/network timeline link
- [ ] **P5-5** Console/network capture runs during recording and attaches on stop
- [ ] **P5-6** **(manual)** Recording checklist: tab/window/screen, permission denied, stop from toolbar, 30-min cap

## Phase 6: Dashboard and polish (FR-16, 25, 26, 27)

- [ ] **P6-1** Dashboard: list, search, delete, visibility toggle
- [ ] **P6-1a** `projects` table + `reports.project_id` migration; `/api/projects` CRUD and `POST /api/reports/move`
      with ownership checks; tests for duplicate names, foreign ids (404), delete → reports become "No project" (FR-26)
- [ ] **P6-1b** Dashboard projects: sidebar list with counts, create/rename/delete dialogs, filter by project and
      "No project", move one or many reports (FR-26, FR-27)
- [ ] **P6-1c** Editor project picker on submit (defaults to last used, "No project" allowed); `projectId` in
      `POST /api/reports` (FR-27)
- [ ] **P6-2** Per-domain capture exclusion list in extension settings (FR-25)
- [ ] **P6-3** Error handling, empty states, loading/progress UI, keyboard accessibility
- [ ] **P6-4** E2E suite: capture → editor → upload → viewer (Playwright with extension)

## Phase 7: Integrations (FR-18 to 20)

- [ ] **P7-1** `integrations` table, encrypted token storage, OAuth connect flow scaffolding
- [ ] **P7-2** Linear export (issue with summary, link, severity mapping)
- [ ] **P7-3** GitHub Issues export
- [ ] **P7-4** Jira Cloud export (OAuth 3LO, project/issue-type selection)
- [ ] **P7-5** Export UI in editor/viewer; `exports` table to prevent duplicates and show the external link

## Phase 8: AI analysis (FR-21)

> **Pending decision:** AI provider, and whether to use an LLM at all, is deferred (see PRD §12 Q4). Resolve
> before starting P8-1.

- [ ] **P8-1** Prompt builder: select errors/failed requests, budget and truncate, redaction re-check
- [ ] **P8-2** `POST /api/reports/:id/analyze` with schema-validated output, caching, rate limits
- [ ] **P8-3** Viewer "Analyze" panel (summary, likely root cause, suggestions)
- [ ] **P8-4** Prompt-injection tests with malicious log/body content

## Phase 9: Release

- [ ] **P9-1** Privacy policy, permission justifications, store listing assets (see `SECURITY_PRIVACY.md` §9)
- [ ] **P9-2** Production deploy (web + DB + storage), env/secret management, backups
- [ ] **P9-3** Chrome Web Store submission build, versioning, changelog
- [ ] **P9-4** Security review pass against `SECURITY_PRIVACY.md`

---

## Backlog (not scheduled)

- FR-17 comments; FR-22 AI chat follow-up
- Workspaces/teams (shared projects), SSO, usage limits
- WebSocket frame capture; document/asset request capture via `chrome.debugger`
- Self-hosting guide

## Milestone summary

| Milestone        | Phases | Outcome                                 |
| ---------------- | ------ | --------------------------------------- |
| M1 Local MVP     | 0–2    | Capture, annotate, logs/network locally |
| M2 Shareable MVP | 3–4    | Share links, full-page capture          |
| M3 Video         | 5      | Recording end to end                    |
| M4 Beta          | 6–7    | Dashboard, integrations                 |
| M5 Launch        | 8–9    | AI analysis, store release              |

## Suggested prompts for OpenCode

- "Read AGENTS.md and docs/PLAN.md, then implement task P0-1. Stop when its exit criteria are met."
- "Implement P2-1 following docs/SECURITY_PRIVACY.md §2. Write tests first."
- "Review the diff against docs/SECURITY_PRIVACY.md and list any violations."
