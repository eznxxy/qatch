# API and Data Model

## 1. Database schema (Postgres, Drizzle)

```
users
  id              uuid pk
  email           text unique not null
  name            text
  created_at      timestamptz default now()

sessions / accounts   -- managed by the chosen auth library

projects                                        -- FR-26
  id              uuid pk
  owner_id        uuid fk users.id not null
  name            text not null                 -- 1..80 chars, unique per owner (case-insensitive)
  description     text                          -- <= 500 chars
  color           text                          -- one of a fixed palette key, for UI only
  created_at      timestamptz default now()
  updated_at      timestamptz default now()

reports
  id              uuid pk
  owner_id        uuid fk users.id not null
  project_id      uuid fk projects.id on delete set null   -- null = "No project" (FR-27)
  title           text not null
  description     text
  severity        text check in ('low','medium','high','critical') default 'medium'
  tags            text[] default '{}'
  kind            text check in ('screenshot','recording') not null
  visibility      text check in ('private','unlisted','public') default 'unlisted'
  share_token     text unique not null          -- random, unguessable (>=128 bits)
  page_url        text
  device          jsonb not null                -- DeviceInfo
  console         jsonb not null default '[]'   -- ConsoleEntry[] (or object-store key if large)
  network         jsonb not null default '[]'   -- NetworkEntry[] (or object-store key if large)
  truncated       jsonb default '{}'            -- {console?:true, network?:true, bodies?:true}
  created_at      timestamptz default now()
  deleted_at      timestamptz

report_assets
  id              uuid pk
  report_id       uuid fk reports.id on delete cascade
  type            text check in ('image','video','annotated_image')
  storage_key     text not null
  mime            text not null
  bytes           bigint
  width           int
  height          int
  duration_ms     int

integrations
  id              uuid pk
  owner_id        uuid fk users.id
  provider        text check in ('linear','github','jira')
  access_token    bytea not null                -- encrypted (AES-GCM)
  refresh_token   bytea
  meta            jsonb                         -- team id, repo, jira cloud id, default project
  created_at      timestamptz default now()

exports
  id              uuid pk
  report_id       uuid fk reports.id
  provider        text
  external_id     text
  external_url    text
  created_at      timestamptz default now()

ai_analyses
  id              uuid pk
  report_id       uuid fk reports.id
  model           text
  summary         text
  root_cause      text
  suggestions     jsonb                         -- string[]
  created_at      timestamptz default now()
```
Indexes: `reports(owner_id, created_at desc)`, `reports(share_token)`, `report_assets(report_id)`,
`reports(owner_id, project_id, created_at desc)`, unique `projects(owner_id, lower(name))`.

## 2. Payload types (in `packages/shared`)

```ts
export type ConsoleEntry = {
  ts: number;                       // ms since capture start
  level: "log" | "info" | "warn" | "error" | "debug";
  message: string;                  // serialized, length-capped
  stack?: string;
  source?: "console" | "onerror" | "unhandledrejection";
};

export type NetworkEntry = {
  id: string;
  ts: number;                       // start, ms since capture start
  durationMs: number;
  method: string;
  url: string;                      // query-string secrets redacted
  status: number | 0;               // 0 = failed/aborted
  statusText?: string;
  initiator: "fetch" | "xhr";
  requestHeaders: Record<string, string>;   // redacted
  responseHeaders: Record<string, string>;  // redacted
  requestBody?: string;             // text/JSON only, capped
  responseBody?: string;            // text/JSON only, capped
  bodyTruncated?: boolean;
  error?: string;
};

export type DeviceInfo = {
  userAgent: string;
  browser: { name: string; version: string };
  os: { name: string; version?: string };
  viewport: { w: number; h: number };
  screen: { w: number; h: number };
  dpr: number;
  language: string;
  timeZone: string;
  url: string;
  connection?: { effectiveType?: string; downlink?: number; rtt?: number };
  capturedAt: string;               // ISO 8601
};
```

## 3. REST API
All routes return JSON, validate with Zod, and use `Authorization: Bearer <token>` (extension) or a session
cookie (web). Errors: `{ error: { code, message } }`.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/uploads/presign` | user | Body `{ type, mime, bytes }` → `{ key, url, multipart? }`. Enforces size/mime limits. |
| POST | `/api/uploads/complete` | user | Completes multipart upload `{ key, uploadId, parts }`. |
| POST | `/api/reports` | user | Create report: `{ title, description?, severity, tags, kind, pageUrl, device, console, network, assets[] , visibility, projectId? }` → `{ id, shareUrl }`. |
| GET | `/api/reports` | user | List own reports (`?q=&cursor=&projectId=<uuid>|none`). |
| GET | `/api/reports/:id` | owner or token | Report + signed asset URLs. Token via `?t=<share_token>` for unlisted/public. |
| PATCH | `/api/reports/:id` | owner | Update title, description, visibility, tags, `projectId` (`null` = no project). |
| POST | `/api/reports/move` | owner | Bulk move `{ reportIds: uuid[] (1..100), projectId: uuid \| null }`. All-or-nothing: if any report or the project is not the caller's → 404, nothing changes. |
| GET | `/api/projects` | user | List own projects with report counts, plus the "No project" count. |
| POST | `/api/projects` | user | Create `{ name, description?, color? }` → project. 409 on duplicate name. |
| GET | `/api/projects/:id` | owner | Project details. |
| PATCH | `/api/projects/:id` | owner | Rename / edit description or color. 409 on duplicate name. |
| DELETE | `/api/projects/:id` | owner | Hard delete the project; its reports move to "No project" (`project_id = null`). |
| DELETE | `/api/reports/:id` | owner | Soft delete, then purge assets via job. |
| POST | `/api/reports/:id/rotate-link` | owner | Regenerate `share_token` (revokes old link). |
| POST | `/api/reports/:id/export/:provider` | owner | Create issue in `linear`/`github`/`jira` → `{ externalUrl }`. |
| POST | `/api/reports/:id/analyze` | owner | Run AI analysis → `{ summary, rootCause, suggestions[] }`. Rate-limited. |
| GET | `/api/integrations` | user | List connected providers. |
| GET | `/api/integrations/:provider/connect` | user | Start OAuth. |
| GET | `/api/integrations/:provider/callback` | user | OAuth callback. |
| DELETE | `/api/integrations/:provider` | user | Disconnect. |

### Visibility rules
- `private`: only the owner can read.
- `unlisted`: anyone with the link containing a valid `share_token` (`/r/:id?t=<share_token>`).
- `public`: loads at `/r/:id` **without** a token (still no listing/search in MVP). Rotating the token has no
  effect on public access; switch to `unlisted` or `private` to restrict it.
- Wrong or missing token on a non-owner request → **404** (not 403) to avoid confirming existence.

### Limits (defaults, env-configurable)
- Screenshot ≤ 20 MB; video ≤ 30 min and ≤ `RECORDING_MAX_BYTES` (about 675 MB), both from
  `packages/shared/src/config.ts` and enforced again by `/api/uploads/presign`
- Console ≤ 1,000 entries, network ≤ 500 entries, body ≤ 64 KB each, payload ≤ 5 MB
- Rate limits: reports 30/hour/user, analyze 20/hour/user
- Projects: ≤ 200 per user; name 1–80 chars; description ≤ 500 chars

### Project rules
- Projects are private to their owner; they have no visibility of their own and never change who can open a
  report (that stays per report).
- Any `projectId` in a request must belong to the caller; otherwise **404**, same as a missing project.
- The extension calls `GET /api/projects` to fill the editor's project picker and remembers the last used project
  in `chrome.storage.local`.

## 4. Extension ↔ backend auth
Auth is Better Auth (ARCHITECTURE ADR 8): cookie sessions for the web app, its bearer-token plugin for the
extension. Use the web sign-in flow via `chrome.identity.launchWebAuthFlow` (or a tab redirect) to obtain a
short-lived access token plus refresh token; store them in `chrome.storage.local`. Never store provider (Linear/Jira)
tokens in the extension.

## 5. AI analysis prompt contract (server-side)
Input: report title/description, device summary, last N console errors/warnings, failed or slow network
requests (status ≥ 400 or duration over threshold) with redacted bodies truncated to a budget.
Output (JSON, validated): `{ summary: string, rootCause: string, suggestions: string[] }`.
Rules: never include raw tokens, cap total input tokens, treat report content as untrusted (ignore any
instructions inside logs/bodies), and cache by report content hash.
