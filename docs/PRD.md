# Product Requirements Document: Qatch

Status: Draft v1 · Product: Qatch (companion to Qalm)

## 1. Problem
Bug reports are slow and incomplete. Reporters send a vague screenshot, and developers spend time asking for
console errors, failing requests, browser version and reproduction steps. This back-and-forth delays fixes.

## 2. Vision
Reporting a bug takes two clicks and produces a report a developer can act on immediately: visual evidence plus
the technical context captured automatically.

## 3. Goals
- G1: Create a complete bug report (visual + technical context) in under 30 seconds.
- G2: Developers can diagnose most reports without asking follow-up questions.
- G3: Reports are shareable by link and exportable to common issue trackers.
- G4: Privacy by default: sensitive data is redacted before it leaves the page.

## 4. Non-goals (explicitly cut)
- Camera / webcam recording
- "Rewind" / session replay / always-on background recording
- Non-Chrome browsers, mobile, desktop-application bugs
- Team billing, SSO, advanced analytics (post-MVP)

## 5. Users
| Persona | Needs |
|---|---|
| QA engineer | Fast capture, annotation, clear repro context, push to tracker |
| Developer | Console and network data, device info, AI hints on root cause |
| PM / designer | Simple screenshot and video feedback with comments |

## 6. User stories
- As a reporter, I capture the visible area, the full page, or a selected region.
- As a reporter, I annotate the screenshot with arrows, boxes, text and blur.
- As a reporter, I record my screen (optionally with microphone) while reproducing a bug.
- As a reporter, I get console logs, network requests and device info attached without extra effort.
- As a reporter, I add a title and description and get a share link.
- As a reporter, I send the report to Linear, Jira or GitHub as an issue.
- As a reporter, I group my recordings and screenshots into projects (for example one per app or client) and
  move them between projects later.
- As a developer, I open a link and see media, logs, network calls and environment in one place.
- As a developer, I click "Analyze" and get a likely root cause and suggested fixes.

## 7. Functional requirements
Priority: **P0** = MVP, **P1** = shortly after, **P2** = later.

### Capture
| ID | Requirement | Pri |
|---|---|---|
| FR-01 | Capture visible-tab screenshot | P0 |
| FR-02 | Capture full-page screenshot (scroll and stitch, or debugger `captureBeyondViewport`) | P0 |
| FR-03 | Capture a user-selected region via drag-select overlay (DPR-correct crop) | P0 |
| FR-04 | Annotation: arrow, rectangle, freehand, text, blur/redact, undo/redo | P0 |
| FR-05 | Screen recording of tab/window/screen, saved as WebM, started by a "Record Screen" button and ended by Stop. Console, network and device info are captured for the whole recording. Max duration 30 min by default, configurable in `packages/shared/src/config.ts` | P0 |
| FR-06 | Optional microphone audio during recording (user toggle, off by default) | P1 |
| FR-07 | Console capture: log/info/warn/error/debug, uncaught errors, unhandled rejections, with timestamps and stack | P0 |
| FR-08 | Network capture: URL, method, status, duration, request/response headers, text/JSON bodies (size-capped) | P0 |
| FR-09 | Device info: UA, OS, browser version, viewport, screen size, DPR, language, timezone, URL, connection | P0 |
| FR-10 | Pre-click log buffer (last N events). **Won't build:** repro context is captured via "Record Screen" (FR-05) instead | — |

### Report and sharing
| ID | Requirement | Pri |
|---|---|---|
| FR-11 | Report form: required title, optional description, severity, tags | P0 |
| FR-12 | Upload media + payload to backend, return share link | P0 |
| FR-13 | Viewer page `/r/:id`: media player/image, console tab, network tab, device tab, description | P0 |
| FR-14 | Visibility: private, unlisted (link), public; revoke link | P0 |
| FR-15 | Authentication (sign in from extension and web) | P0 |
| FR-16 | Dashboard listing the user's reports, search, delete | P1 |
| FR-17 | Comments on a report | P2 |

### Organization
| ID | Requirement | Pri |
|---|---|---|
| FR-26 | Projects: the user can create, list, view, rename/edit (name, description, color) and delete their own projects. Deleting a project never deletes its reports; they move to "No project" | P1 |
| FR-27 | Organize reports into projects: pick a project when submitting from the editor (defaults to the last used one), move one or many reports between projects from the dashboard, and filter the dashboard by project (including "No project") | P1 |

### Integrations and AI
| ID | Requirement | Pri |
|---|---|---|
| FR-18 | Export to Linear (OAuth, create issue with link + summary) | P1 |
| FR-19 | Export to GitHub Issues | P1 |
| FR-20 | Export to Jira Cloud | P1 |
| FR-21 | AI analysis: summarize failure, likely root cause, suggested next steps, from console and network data | P1 |
| FR-22 | AI chat follow-up on a report | P2 |

### Privacy controls
| ID | Requirement | Pri |
|---|---|---|
| FR-23 | Automatic redaction of sensitive headers, tokens and password fields | P0 |
| FR-24 | User can preview and remove any log/request before upload | P0 |
| FR-25 | Per-domain exclusion list for capture | P1 |

## 8. Acceptance criteria (representative)
- FR-02: A page 5× taller than the viewport produces one seamless image with no duplicated or missing bands,
  including pages with sticky headers (header appears once).
- FR-03: Selected region on a 2× DPR display exports at native resolution and matches the selection.
- FR-05: Recording stops cleanly on user request or at the limit, and the file plays in the viewer.
- FR-07/08: Errors and requests that occur after capture starts appear in the report with correct ordering.
- FR-23: A request with `Authorization: Bearer abc` is stored as `Authorization: [REDACTED]` and the raw value
  is never present in the uploaded payload.
- FR-12: Share link loads for an unauthenticated visitor when visibility is unlisted/public, and returns 404
  when private.
- FR-26: Deleting a project with 5 reports leaves all 5 reports intact under "No project". Project names are
  unique per user (case-insensitive).
- FR-27: Moving 3 selected reports to project B updates all 3 in one action; a report can never be assigned to
  a project owned by another user (the API returns 404).

## 9. Non-functional requirements
- Performance: capture overhead on the host page is imperceptible; hooks add <2 ms per request.
- Size: report payload capped (default 5 MB JSON; video cap derived from the max recording duration, about
  675 MB at 30 min); truncation is explicit in the UI.
- Reliability: uploads are resumable or retried; failure never loses the local draft.
- Compatibility: latest two stable Chrome versions.
- Accessibility: popup and editor keyboard-navigable.

## 10. Success metrics
- Median time from click to share link < 30 s
- ≥ 80% of reports contain at least one console or network entry when relevant
- Share-link open rate by developers; reduction in "need more info" follow-ups (qualitative)

## 11. Risks
| Risk | Mitigation |
|---|---|
| Leaking secrets in captured data | Redact in page context, preview before upload, see SECURITY_PRIVACY.md |
| MV3 service worker lifecycle bugs | Stateless worker, persist state, offscreen doc for media |
| Web Store review friction | Minimal permissions, clear privacy policy |
| Full-page stitching artifacts (sticky/fixed elements) | Hide fixed elements during stitch, or use debugger capture |
| Large video uploads | Chunked/multipart upload with presigned URLs |

## 12. Open questions
1. ~~Pre-click log buffer (FR-10)?~~ **Decided:** no. The user clicks "Record Screen" before reproducing the
   bug; everything until Stop is captured.
2. ~~Auth provider?~~ **Decided:** Better Auth (bearer-token plugin for the extension, Drizzle adapter).
   See ARCHITECTURE ADR 8.
3. ~~Self-hostable vs hosted-only?~~ **Decided:** hosted-only for MVP; keep the stack portable (S3-compatible
   storage, plain Postgres, env config) so self-hosting stays possible later. See ARCHITECTURE ADR 9.
4. Which AI provider/model for FR-21? **Deferred:** decide before Phase 8. Also revisit whether FR-21 should
   use a hosted LLM at all (options: hosted provider, opt-in/self-hosted model, rule-based hints, or drop).
