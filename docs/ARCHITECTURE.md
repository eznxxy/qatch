# Architecture

## 1. System overview

```
┌───────────────────────── Chrome (MV3 extension) ─────────────────────────┐
│                                                                          │
│  Popup / Editor (React)  ◄──────►  Service Worker (background.ts)        │
│        ▲                                   │         ▲                   │
│        │ messages                          │         │                   │
│        ▼                                   ▼         │                   │
│  Content script (isolated) ◄─postMessage─► Injected script (MAIN world)  │
│   overlays, region select                  console + fetch/XHR hooks     │
│                                            Offscreen doc: MediaRecorder  │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ HTTPS (Zod-validated)
                                ▼
┌──────────────────────── Backend (Next.js) ───────────────────────────────┐
│ REST API · Auth · Presigned uploads · Report viewer (/r/:id) · Dashboard │
│ Integrations (Linear/GitHub/Jira) · AI analysis                          │
└───────────────┬───────────────────────────────┬──────────────────────────┘
                ▼                               ▼
          Postgres (Drizzle)             S3 / R2 object storage
```

## 2. Extension components

| Component       | World / context      | Responsibility                                                                                                                               |
| --------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `background.ts` | Service worker       | Orchestrates capture sessions, `chrome.tabs`/`scripting`/`offscreen`, uploads, auth tokens. Stateless; persists to `chrome.storage.session`. |
| `content.ts`    | Isolated             | Region-select overlay, capture UI chrome, relays data between page and worker.                                                               |
| `injected.ts`   | MAIN                 | Wraps `console.*`, `fetch`, `XMLHttpRequest`; listens for `error` and `unhandledrejection`; redacts, then `postMessage`s to content script.  |
| `offscreen/`    | Offscreen doc        | `MediaRecorder` for screen stream, canvas stitching/cropping, blob assembly.                                                                 |
| `popup/`        | Extension page       | Choose capture mode (visible, full, region, record), settings.                                                                               |
| `editor/`       | Extension page (tab) | Annotation canvas (Fabric.js), report form, log preview/removal, upload progress.                                                            |

## 3. Capture session lifecycle

1. User clicks the extension icon and chooses a mode (grants `activeTab`).
2. Worker injects `injected.ts` (MAIN world) and `content.ts` via `chrome.scripting.executeScript`.
3. Hooks start buffering console and network events with monotonic timestamps. Events are redacted at the source.
4. User captures a screenshot or starts/stops a recording.
5. Worker collects the media blob, drains the buffers, gathers device info, and stores a **draft** in IndexedDB.
6. Worker opens `editor/`; the user annotates, edits logs, fills in the form.
7. On submit: request presigned URLs, upload media (multipart for video), `POST /api/reports` with the payload.
8. Backend returns the share URL; the editor shows copy-link and export actions.

Capture is **on-demand only** (no always-on recording). Logs before step 2 are not available (see PRD FR-10).
To capture the events that lead to a bug, the user clicks **Record Screen**, reproduces the bug, and clicks
**Stop**: console, network and device info are captured for the whole recording. Screenshot modes attach
device info plus whatever console/network events occurred after injection.

## 4. Message contracts (in `packages/shared`)

```ts
type Msg =
  | { t: 'capture/start'; mode: 'visible' | 'full' | 'region' | 'record' }
  | { t: 'capture/stop' }
  | { t: 'page/console'; entry: ConsoleEntry }
  | { t: 'page/network'; entry: NetworkEntry }
  | { t: 'region/selected'; rect: { x: number; y: number; w: number; h: number; dpr: number } }
  | { t: 'draft/ready'; draftId: string };
```

All page-to-content messages carry a per-session `nonce`; receivers verify `event.source === window` and nonce.
The nonce only filters out other frames and unrelated scripts. It is **not** a security boundary: `injected.ts`
runs in the page's world, so the page can read the nonce and forge messages. The content script therefore
treats every `page/*` message as untrusted data: Zod-validate it, re-apply size caps, and never let it trigger
an action.

## 5. Capture techniques

**Visible screenshot.** `chrome.tabs.captureVisibleTab({ format: "png" })`.

**Full-page screenshot.** Two options; start with (A):

- (A) Scroll-and-stitch: scroll by viewport height, `captureVisibleTab` each step (respect the ~2 calls/sec
  rate limit), temporarily set `position: fixed|sticky` elements to `position: static`/hidden after the first
  frame, stitch on an offscreen canvas, restore the page.
- (B) `chrome.debugger` + `Page.captureScreenshot { captureBeyondViewport: true }`. Cleaner result, but shows the
  "debugging this browser" banner. Keep as optional fallback.

**Region screenshot.** Content-script overlay → rect in CSS px → capture visible → crop on canvas multiplying
by `devicePixelRatio`.

**Screen recording.** Worker gets a stream id via `chrome.tabCapture.getMediaStreamId` (tab) or the offscreen
doc calls `getDisplayMedia` (window/screen). `MediaRecorder` (`video/webm;codecs=vp9,opus`) with a fixed
target bitrate, 1 s timeslice, each chunk written to IndexedDB as it arrives (never held in memory for the whole
recording). Hard cap on duration: default 30 min, set by `RECORDING_MAX_MINUTES` in
`packages/shared/src/config.ts`; the upload size cap is derived from it. Mic is optional via
`getUserMedia({ audio: true })` in an extension page that can show the permission prompt.

**Console.** Wrap `console.{log,info,warn,error,debug}`: serialize args safely (cycle-safe, depth-limited,
length-limited), record `ts`, `level`, `message`, `stack` (via `new Error().stack` for errors). Also hook
`window.onerror` and `unhandledrejection`.

**Network.** Wrap `fetch` and `XMLHttpRequest.prototype.open/send/setRequestHeader`. Record method, URL, status,
start time, duration, request/response headers, and bodies (text/JSON only, truncated to a cap, skip binary and
streaming responses). Clone responses (`response.clone()`) so page behavior is unchanged. Known gap: this does
not capture document/asset loads or WebSocket frames. Acceptable for MVP.

**Device info.** `navigator.userAgentData` (with `getHighEntropyValues`) falling back to `userAgent`;
`screen`, `window.innerWidth/innerHeight`, `devicePixelRatio`, `navigator.language`, `Intl` time zone,
`navigator.connection`, `location.href`.

## 6. Permissions (justify any change)

| Permission                          | Why                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `activeTab`                         | Capture and inject only in the tab the user invoked                                                                       |
| `scripting`                         | Inject MAIN-world and content scripts on demand                                                                           |
| `storage`                           | Settings, session state                                                                                                   |
| `offscreen`                         | MediaRecorder and canvas work                                                                                             |
| `tabCapture`                        | Tab recording                                                                                                             |
| `identity` or tab-based OAuth       | Sign-in flow                                                                                                              |
| `debugger`                          | **Optional** (full-page option B), requested at runtime via `optional_permissions`                                        |
| `host_permissions`: API origin only | Call the Qatch backend from the extension without relying on CORS. Exactly one origin (per environment), never a wildcard |

No `<all_urls>`, no `webRequest`.

**Stable extension ID.** The manifest pins a public `key` so the extension ID is identical across dev, unpacked
and store builds. The ID is used by the `launchWebAuthFlow` redirect (`https://<id>.chromiumapp.org`), the
backend CORS allow-list, the R2 bucket CORS rules (`chrome-extension://<id>`), and sender checks. The private
`.pem` is never committed.

## 7. Backend

- Next.js App Router; route handlers for the REST API (see `API_AND_DATA.md`).
- Postgres via Drizzle; migrations in `apps/web/db/migrations`.
- Object storage: S3-compatible. The client uploads directly with presigned (multipart for video) URLs; the
  backend stores only keys.
- The viewer streams media via short-lived signed GET URLs; private reports require an authenticated owner.
- Integrations run server-side; OAuth tokens encrypted at rest (AES-GCM with a key from env/KMS).
- AI analysis: server-side call to an LLM provider with a bounded, redacted prompt built from console and
  network data; result cached in `ai_analyses`.

## 8. Key decisions (ADR-lite)

| #   | Decision                                                              | Rationale                                                                                       | Alternatives                                                        |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | WXT + React                                                           | Good MV3 DX, HMR, typed entrypoints                                                             | CRXJS, plain Vite                                                   |
| 2   | MAIN-world hooks injected on demand                                   | Only way to see page `fetch`/console; avoids `<all_urls>`                                       | `chrome.debugger` (banner), `webRequest` (no bodies)                |
| 3   | No rewind/session replay                                              | Scope, privacy, complexity                                                                      | rrweb ring buffer                                                   |
| 4   | Offscreen doc for media                                               | Service worker has no DOM                                                                       | Recording in a visible tab                                          |
| 5   | Presigned direct uploads                                              | Large videos, cheaper backend                                                                   | Proxy uploads                                                       |
| 6   | LLM only on backend                                                   | No secrets in extension, redaction control                                                      | Client-side calls                                                   |
| 7   | Drafts in IndexedDB                                                   | Survive worker restarts and failed uploads                                                      | In-memory                                                           |
| 8   | Better Auth for authentication                                        | First-class bearer-token plugin for the extension plus cookie sessions for web; Drizzle adapter | Auth.js (cookie-centric; extension token flow would be hand-rolled) |
| 9   | Hosted-only for MVP                                                   | Less surface to support; stack kept portable (S3-compatible, plain Postgres, env config)        | Self-hostable from day one                                          |
| 10  | Repro context via "Record Screen", no pre-click buffer                | Captures the events leading to the bug without `<all_urls>` or always-on hooks                  | Pre-click buffer via optional per-site host permissions             |
| 11  | Recording cap 30 min, configurable in `packages/shared/src/config.ts` | Long repros fit; size cap derived from duration so they never drift                             | Fixed 5 min cap                                                     |
| 12  | Pinned manifest `key` + API-origin host permission                    | Stable ID for OAuth redirect and CORS; backend calls independent of CORS                        | Wildcard hosts; per-build IDs                                       |

## 9. Testing strategy

- Unit (Vitest): redaction, serialization, stitching math, DPR crop math, Zod schemas.
- Integration: hook scripts against a fixture page (JSDOM/Playwright).
- E2E (Playwright with the extension loaded): capture → edit → upload → open viewer.
- Manual checklist for recording and permissions in `docs/PLAN.md` Phase 6.
