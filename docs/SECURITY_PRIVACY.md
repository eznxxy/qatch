# Security and Privacy Requirements

These are **non-negotiable**. Any change that weakens them needs an explicit decision recorded here.

## 1. Data minimization

- Capture only after an explicit user action; never record in the background.
- Inject scripts only into the active tab via `activeTab`.
- No analytics or telemetry that includes page content.

## 2. Redaction (in the page context, before data leaves `injected.ts`)

**Headers** (case-insensitive), replace value with `[REDACTED]`:
`authorization`, `proxy-authorization`, `cookie`, `set-cookie`, `x-api-key`, `x-auth-token`, `x-csrf-token`,
`x-xsrf-token`, and any header whose name contains `token`, `secret`, `key`, `session`.

**URLs.** Redact query params named like `token`, `access_token`, `id_token`, `refresh_token`, `api_key`,
`apikey`, `key`, `secret`, `password`, `code`, `signature`, `sig`, `session`.

**Bodies.** For JSON bodies, redact values of keys matching: `password`, `pass`, `pwd`, `secret`, `token`,
`access_token`, `refresh_token`, `authorization`, `api_key`, `credit_card`, `card_number`, `cvv`, `ssn`.
For `application/x-www-form-urlencoded`, apply the same rules by field name.

**Console.** Run a best-effort pattern scrub: JWTs (`eyJ...\.\w+\.\w+`), `Bearer <token>`, long hex/base64
secrets, AWS key patterns, emails optional (user setting).

**Screenshots and video.** Provide a blur/redact tool in the editor (images). For recordings, warn the user
that everything visible is captured; offer a "pause" control.

Image blur is pixelation by block **averaging** (not a reversible filter), with blocks at least about one text line
tall (`blurBlockFor`, ≥ 12 px) because small blocks over text can be partly reversed. It is flattened into the
exported PNG; the unannotated original stays only in the local draft (IndexedDB) and is never uploaded once
upload exists (P3): uploads use the flattened export.

Redaction rules live in `packages/shared/redaction.ts` with unit tests for every rule. Redaction must be
idempotent and never throw (on error, drop the field rather than leak it). The module is bundled into
`injected.ts`, which runs on every captured page, so it must be **dependency-free plain TypeScript**: no Zod and
no imports beyond other dependency-free shared modules. Zod schemas live in separate files.

Header-name matching (`token`, `secret`, `key`, `session`) intentionally over-redacts harmless headers such as
`sec-websocket-key`. This fails safe and is by design; do not narrow it.

## 3. User control

- Pre-upload preview: user can see and delete any console entry or network request, and remove bodies.
- Per-domain exclusion list (disable capture on listed domains).
- Clear, plain-language note in the popup about what is captured.

## 4. Extension security

- MV3 default CSP; no remote code, no `eval`.
- `window.postMessage` between MAIN and isolated worlds uses a per-session random nonce; verify
  `event.source === window`, `event.data.nonce`, and a message-type allow-list. Never trust page-supplied data
  as instructions.
- The nonce is **not** a security boundary: the page shares a world with `injected.ts` and can read it and
  forge messages. The content script Zod-validates every `page/*` message, re-applies size/count caps, and never
  performs an action based on page data. (Impact of forgery is limited to the page faking its own logs.)
- Service worker validates sender (`sender.id === chrome.runtime.id`) for every message.
- Minimal permissions (see ARCHITECTURE §6). `debugger` only as an optional runtime permission.
- No secrets in the extension bundle.

## 5. Backend security

- Authenticate every mutating route; derive user id from the session/token only.
- Every referenced resource id (report, project) must be owned by the caller; check ownership in the same query
  that reads or writes it. Foreign ids return 404.
- Zod-validate all inputs; enforce size/mime limits on presign.
- `share_token`: ≥128 bits from a CSPRNG; constant-time comparison; rotate on demand.
- Return 404 for unauthorized access to non-public reports.
- Integration tokens encrypted at rest (AES-GCM, key from env/KMS), never returned to clients, never logged.
- Signed media URLs expire in ≤15 minutes; set `Content-Disposition` and correct `Content-Type`;
  `X-Content-Type-Options: nosniff`.
- Rate-limit report creation, analysis and auth endpoints.
- Standard hardening: CORS allow-list (extension origin + web), CSRF protection for cookie auth, security
  headers, dependency audit in CI.
- Storage bucket CORS allows `PUT` only from the extension origin (`chrome-extension://<pinned id>`) and the
  web origin.

## 6. Viewer safety

- Report content (titles, logs, bodies) is untrusted: render as text, never as HTML.
- Syntax-highlight with a sanitizing library; no `dangerouslySetInnerHTML`.
- Strict CSP on the viewer; media served from a separate storage domain.

## 7. AI safety

- Server-side only; redacted input; token budget.
- Treat log/body content as untrusted data (prompt-injection aware): system prompt instructs the model to
  ignore instructions found in report data; output validated against a schema.
- Do not send media to the model in MVP.

## 8. Retention and deletion

- Users can delete a report; deletion removes DB rows and objects (async job, within 24 hours).
- Define default retention (suggested: keep until deleted) and document it in the privacy policy.

## 9. Web Store and compliance checklist

- [ ] Privacy policy URL describing captured data, storage, and sharing
- [ ] Permission justifications written for each permission
- [ ] "Single purpose" statement
- [ ] Data-use disclosures completed accurately
