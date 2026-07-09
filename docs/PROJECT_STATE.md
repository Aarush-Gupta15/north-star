# North Star — Project State

> **Living source of truth.** This file is the project's memory. Claude reads it
> at the start of each working session and updates it at the end. It also feeds
> the daily 9 AM standup email. The chat is the conversation; this file is the
> record.

**Last updated:** 2026-06-28
**Phase:** Focus shifted to the **Chrome extension** as the flagship product.
**Headline feature:** real-time type-guard — warns before you leak PII into any
text box, including AI chatbots (ChatGPT/Claude/Gemini). Web app + backend remain
as the optional dashboard/audit/report companion.
**Overall status:** 🟢 On track

---

## 1. Snapshot

| Area | Status | Notes |
|------|--------|-------|
| Monorepo + Docker + docs | ✅ Done | `docker compose up` brings up db, cache, api, web |
| Backend (FastAPI, layered) | ✅ Done | 21 tests pass, ruff clean, OpenAPI generates |
| PII engine (Presidio + Indian IDs) | ✅ Done | Aadhaar (Verhoeff), PAN, passport, email, phone, card (Luhn), IP |
| Risk scoring + LLM explanations | ✅ Done | Transparent 0–100 score; graceful fallback w/o API key |
| Frontend (React+TS, dark SaaS) | ✅ Done | tsc clean, vite build passes; login + scan workspace |
| Tests + GitHub Actions CI | ✅ Done | 24 tests; lint·type·test both stacks |
| **Analytics dashboard** | ✅ Done | Stat cards, top PII, 14-day SVG trend, risk breakdown; role-scoped + Redis-cached endpoint |
| **PDF audit reports** | ✅ Done | Branded PDF per scan (exec summary, risk, PII inventory, GDPR/DPDP findings, actions) + GDPR/DPDP compliance knowledge base |
| **Chrome extension (MV3)** | ✅ Done | Local full-page scan + inline highlight + risk overlay; popup; context menu; toolbar badge; optional summary-only sync to backend |
| Daily standup email automation | 🟢 Scheduled | Weekday 9 AM, true-send via AgentMail → aarushsre@gmail.com. Needs AgentMail connected + a "Run now" to pre-approve tools. |

---

## 2. Done (with dates)

- **2026-06-25** — Walking skeleton scaffolded end-to-end and verified runnable.
  - Backend: clean layers (API → service → repository → DB), JWT auth + bcrypt,
    RBAC dependency, SQLAlchemy 2.0 models (User, Scan, AuditLog), Alembic
    migration, Redis client, centralized config/logging/exception handling.
  - PII engine: Presidio path + pure-regex fallback; custom Indian recognizers.
  - Frontend: Vite React+TS, dark-mode UI, login/register + live scan view.
  - Ops: docker-compose, GitHub Actions CI, ADRs 0001–0002.
  - Verification: 21 backend tests green, ruff clean, frontend `tsc` clean +
    production build succeeds.

---

- **2026-06-25** — Analytics dashboard shipped end-to-end.
  - Backend: `GET /api/v1/analytics/dashboard` → `AnalyticsService` → new
    `ScanRepository` aggregations. Role-scoped (user = own, analyst/admin = org),
    Redis-cached (45s TTL) with live-compute fallback. Schemas in `analytics.py`.
  - Frontend: `DashboardPage` with stat cards (total/high-risk/posture/compliance),
    top-PII bar list, dependency-free SVG trend chart, risk breakdown; shared
    `Layout` with Dashboard/Scan nav tabs.
  - `scripts/seed.py` demo data generator; +3 analytics integration tests.
  - Verified: 24 backend tests green, ruff clean, frontend tsc clean + build OK.

- **2026-06-27** — PDF audit reports shipped end-to-end.
  - `app/services/compliance.py`: GDPR + India DPDP knowledge base mapping each
    PII type → obligations, severity, recommended action (reused by the upcoming
    compliance endpoint).
  - `app/services/report_service.py`: branded reportlab PDF rendered to bytes
    (exec summary, risk summary, PII inventory, compliance findings, actions,
    disclaimer). No raw PII in the report — metadata only.
  - `GET /api/v1/scans/{id}/report` streams the PDF with ownership check + audit
    log; frontend "Download PDF audit report" button (authed blob fetch).
  - +9 tests (compliance, renderer, endpoint). Verified: 31 backend tests green,
    ruff clean, frontend tsc clean + build OK. Sample at `docs/sample-report.pdf`.

- **2026-06-27** — Added `ui-preview.html`: a single-file, offline, interactive
  preview of the whole UI (login → dashboard → scan → printable report). Ports
  the real detectors + risk scoring to client-side JS so the scan genuinely
  works with no backend — for quick visual review and demos. Not part of the
  shipped app; a reviewer aid.

- **2026-06-28** — Chrome extension (MV3) shipped + backend `ingest` endpoint.
  - Backend: `POST /api/v1/scans/ingest` accepts a summary-only payload (no raw
    text) so client-side scans appear on the dashboard/audit log. Schema uses a
    `Literal` risk_level; +2 tests. 33 backend tests green.
  - Extension (`extension/`): MV3 with shared `engine.js` (ported detectors),
    `content.js` full-page scan + inline highlight + Shadow-DOM risk overlay,
    `background.js` (context menu, badge, optional sync), popup + options, icons,
    README. Detection is fully local; only summaries can be synced.
  - Verified: manifest valid, all scripts pass `node --check`, headless engine
    detects correctly; added an `extension` CI job.

- **2026-06-28** — ⭐ Real-time **type-guard** added (the extension's specialty).
  - `extension/src/input-guard.js`: one delegated capture-phase `input` listener
    watches every editable field — inputs, textareas, and `contenteditable`
    editors (how AI chatboxes are built) — debounced local detection, an anchored
    Shadow-DOM warning tooltip with one-click **Redact in field** (native-setter
    + input-event so React editors accept it), and an optional Enter/send block.
  - Wired into manifest (runs before content.js), options toggles (typeGuard on,
    blockSend off), README now leads with it, description mentions ChatGPT/Claude/Gemini.
  - Added a live **Type Guard ⭐** demo tab to `ui-preview.html` so it can be felt offline.
  - Verified: all scripts pass `node --check`, headless mask leaves zero PII behind.

- **2026-07-06** — Chrome Web Store publishing kit prepared.
  - Trimmed unused `scripting` permission (cleaner review).
  - `extension/PRIVACY_POLICY.md` (local-only, no data collection — needs public
    hosting for the listing URL), `docs/PUBLISHING.md` (test-across-sites guide +
    full store listing copy + permission justifications + step-by-step submit).
  - Store-ready ZIP: `north-star-privacy-guard-v0.2.0.zip` (repo root).
  - **Publishing itself is Aarush's to do** (Google account + $5 fee + review) —
    I cannot submit on his behalf. Native mobile/desktop apps are out of scope
    (extension = browser only; covers web apps like WhatsApp Web / ChatGPT web).

- **2026-07-06** — Type-guard reworked to Grammarly-style + detection greatly expanded (v0.2.1).
  - `input-guard.js` rewritten: continuous **inline underlines** drawn under each
    detected span *inside* the field (mirror-element rects for input/textarea,
    `Range.getClientRects()` for contenteditable), updating live on input/scroll/
    resize. Persistent corner badge opens a popover **listing what was typed**
    with masked previews (e.g. `•••• 1111`) + "Redact all".
  - `engine.js` catalogue expanded to ~28 types: cards, CVV, passwords, bank
    acct/IBAN/IFSC/SWIFT/UPI, SSN, passport, voter ID, GSTIN, DOB, API keys
    (AWS/Google/GitHub/OpenAI/Slack), JWT, private keys, crypto (ETH/BTC),
    MAC/IP, email, phone. Context-gated matches (password/CVV/DOB/SWIFT/bank).
  - Mirrored the expanded catalogue + masked list into `ui-preview.html` Type Guard demo.
  - Store ZIP: `north-star-privacy-guard-v0.2.1.zip`. Verified: all scripts pass
    `node --check`, headless detection across the catalogue correct.
  - Note: backend Python detectors NOT yet expanded to match (extension-first focus).

- **2026-07-06** — Fixed password/secret detection (v0.2.2).
  - Root cause: passwords/alphabetic secrets can't be detected by shape, and the
    old `password:` regex needed a colon — so natural phrasing didn't fire.
  - Broadened credential context (accepts "is"/space/= /-), added SECRET / OTP /
    PIN detectors, and a **strong-secret heuristic** (mixed upper+lower+digit
    +symbol, or long mixed-case+digit token) → catches `MyP@ssw0rd`, `Th1s!Secret`.
    Verified it does NOT fire on normal prose, product names, or URLs.
  - Added a red **advisory banner** in the guard popover when credentials are
    present: "Never paste passwords or secret keys into a website or chatbot…".
  - Mirrored into `ui-preview.html`. Store ZIP: `north-star-privacy-guard-v0.2.2.zip`.

- **2026-07-06** — Real-world test fix (v0.2.3). User typed `my passowrd is
  48#efhljhdfw` on chatgpt.com and it wasn't flagged. Causes: (1) "passowrd"
  typo defeats context rule (unfixable), (2) heuristic required an uppercase
  letter. Reworked heuristic to key on **secret symbols** (`# @ ! $ % ^ & * + = ~ ?`,
  excluding `- . _ , / :` common in prose) → catches lowercase+digit+symbol
  passwords, still ignores `iPhone13`, `well-known`, URLs, emails. Verified.
  Store ZIP: `north-star-privacy-guard-v0.2.3.zip`.

- **2026-07-06** — Launch/portfolio assets created in `marketing/`:
  `index.html` (landing page → host on GitHub Pages), `North-Star-Pitch.pdf`
  (1-page brief), `RESUME_AND_LINKEDIN.md` (résumé bullets + LinkedIn post +
  elevator pitch), `GO_TO_MARKET.md` (positioning as "DLP for AI", open-core
  model, launch checklist, interview talking points). Positioning locked:
  **"Grammarly for privacy."** Mobile (Android IME "North Star Guard — Keyboard")
  parked as a separate future project.
- User still to do: record a demo GIF, create a public GitHub repo, publish to
  the Web Store, host the privacy policy + landing page.

- **2026-07-07** — Fixed "Scan this page" under-detection (v0.2.4). User typed
  phone+email+bank+password into ChatGPT; the page-scan card showed only email.
  Cause: `content.js` scanned each DOM text node in isolation, but rich editors
  (ChatGPT) split text into per-word nodes — so context-based matches (bank acct,
  password) and cross-node data were lost; only self-contained email survived.
  Fix: `buildTextMap()` concatenates all text nodes (space-separated, offset-
  mapped), detect runs ONCE on the whole string, matches map back to nodes for
  highlighting; native field values are also scanned for the count; DOM inside
  live contenteditable editors is counted but NOT rewritten (avoids breaking the
  editor — the type-guard underlines those live). Verified: fragmented per-word
  case now finds all 4. Store ZIP: `north-star-privacy-guard-v0.2.4.zip`.

- **2026-07-07** — Context-based labelling + overlap resolver (v0.2.5). User
  typed "aadhar card 432783243 / pan card 3287942 / credit card 8329329042 / cv
  483" and everything showed as PHONE_NUMBER (values aren't real formats, so they
  fell back to phone). Added context detectors: if the user *names* the field
  ("aadhaar/pan/credit card …", "cv" with card context), trust the label even for
  non-checksum values. Replaced containment dedupe with an **overlap resolver**
  that keeps the highest-severity finding per region (Aadhaar/card beat phone).
  Guarded "cv" so résumé "CV 2024" doesn't false-fire. Mirrored to preview.
  Store ZIP: `north-star-privacy-guard-v0.2.5.zip`.

- **2026-07-07** — "Redact all" that rewrites the box, Grammarly-style (v0.2.6).
  Added a prominent **✨ Redact all** button to the page-scan overlay card that
  replaces every detected value with `[REDACTED]` directly in all editable fields
  (contenteditable + textarea/input). Contenteditable uses select-all +
  `execCommand("insertText")` so rich editors (ChatGPT/Claude ProseMirror/Lexical)
  apply it through their own input pipeline and stay in sync (fallback: textContent).
  Same robust path applied to the type-guard popover's redact. Added a guard so the
  `[REDACTED]` placeholder is never re-detected (was re-flagging as PAN/password).
  Verified: after redact, 0 leftover PII. Store ZIP: `north-star-privacy-guard-v0.2.6.zip`.

- **2026-07-07** — Custom user/company keyword rules (v0.2.7). The **Options page**
  (a local HTML page, opened via right-click extension → Options) now lets anyone
  manage their own sensitive terms — three kinds: exact words/phrases, label
  keywords (flag the value after them, e.g. "employee id"), and advanced regex
  (e.g. internal API-key formats). Stored in `chrome.storage.sync` (local); the
  engine auto-loads them and subscribes to changes, so all surfaces (type-guard,
  page-scan, popup, selection) detect them everywhere. Includes a live tester in
  the options page. Strong open-core/enterprise angle. Verified. Store ZIP:
  `north-star-privacy-guard-v0.2.7.zip`.

- **2026-07-07** — Company-managed policy + starter packs + import/export (v0.2.8).
  Answers "the company decides what to hide, employees don't configure anything":
  (1) **Managed policy** via Chrome `chrome.storage.managed` — IT pushes rules
  org-wide (GPO/MDM), enforced + locked; engine merges managed + user rules;
  Options shows a "🏢 Company policy active" banner. `managed_schema.json` declared
  in manifest. (2) **Starter packs** (General/Dev/Finance/Healthcare) one-click.
  (3) **Import/Export** `north-star-policy.json` so an admin builds once and
  teammates import. New `extension/ENTERPRISE.md` deployment guide. Verified merge
  logic. Store ZIP: `north-star-privacy-guard-v0.2.8.zip`. Strong open-core selling point.

- **2026-07-07** — DLP incident reporting to management (extension v0.3.0). When an
  employee **sends** flagged sensitive data despite the warning, the extension posts
  a **masked** incident (metadata + last-4 snippet like `card •••• 1111`, never raw)
  to the backend. Backend: `Incident` model + migration 0002, `POST /incidents`
  (any user), `GET /incidents` + `GET /incidents/report.pdf` weekly digest (analyst/
  admin only), incident service/repo. Engine: `maskValue` + `redactSnippet`.
  input-guard detects Enter-with-PII → background posts to configured endpoint;
  `reportIncidents` toggle (Options) + managed-policy enforced (IT can force it on).
  Verified: 41 backend tests green, ruff clean, extension scripts valid, sample
  digest PDF at `marketing/sample-incident-digest.pdf`. Store ZIP:
  `north-star-privacy-guard-v0.3.0.zip`. Transparent, metadata-only, privacy-respecting DLP.

- **2026-07-07** — Admin **Incidents page** in the React dashboard. Management-only
  (admin/analyst) nav tab "Incidents 🛡️" showing a table: employee (actor_label),
  when, site, risk badge, data types, and the **masked** snippet (`card •••• 1111`).
  Day-range filter (7/30/90) + **⬇ Download PDF** button (calls `/incidents/report.pdf`).
  API client: `incidents()` + `downloadIncidentReport()`; nav tab hidden for
  regular users. Seed script now adds 5 demo incidents (demo user is an analyst,
  so the tab shows). Verified: 37 backend tests, ruff clean, frontend tsc clean +
  build OK. The PDF download button the user asked about now lives on this page.

- **2026-07-07** — Formalised the product as **two editions** in `docs/EDITIONS.md`:
  **Personal** (free, local-only extension — individuals) and **Organization**
  (managed policy + incident reporting + dashboard — companies, already built).
  Same engine; a config/deployment split, not a code fork. Maps to the open-core
  business model.

- **2026-07-08** — Two-editions packaging shipped.
  - **Landing page** (`marketing/index.html`) reworked: project description at top,
    then a clear **Individual vs Organization** plans section (open-core framing).
  - **README** now leads with a two-editions table; full detail in `docs/EDITIONS.md`.
  - **Personal build** created: `extension-personal/` — a trimmed, local-only copy
    (no `host_permissions`, no managed-policy schema, no backend/reporting UI,
    renamed v1.0.0). Verified: scripts valid, engine detects, permissions minimal.
    Package: `north-star-personal-v1.0.0.zip`. The full `extension/` folder remains
    the Organization edition.

## 3. In progress

- Nothing active — choosing the next extension enhancement.

---

## 4. Blocked / waiting

- **Standup email send** — the official Gmail connector drafts but does not
  auto-send. Decision pending on draft-only vs. a true-send path.

---

## 5. Decisions log (the "why")

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-25 | Walking skeleton first | Thin end-to-end slice beats disconnected files; everything later drops into a working spine. |
| 2026-06-25 | Presidio + regex; LLM for explanations only | Detection must be deterministic, offline, free per scan; LLM non-determinism confined to explanations. (ADR 0002) |
| 2026-06-25 | No raw PII in the database | Persist only finding summaries/score — data minimisation enforced at the schema. |
| 2026-06-25 | Lazy DB engine | Importing the app never forces a DB driver; tests run on SQLite, prod on Postgres. |
| 2026-06-25 | PROJECT_STATE.md as living memory | Chat scrollback degrades past the context window; a versioned file is durable continuity + portfolio documentation. |
| 2026-06-25 | Standup via AgentMail true-send, weekdays 9 AM | Aarush wants it in his inbox with zero clicks; official Gmail connector only drafts, so AgentMail sends from an agent inbox. Gmail draft kept as fallback. |
| 2026-06-25 | Dashboard scope by JWT role; Redis cache with live fallback; dependency-free SVG chart | RBAC drives data scope (user=own, analyst/admin=org); caching is an optimization not a dependency; hand-built chart keeps the bundle lean and shows craft. |
| 2026-06-27 | **Renamed project "Privacy Copilot" → "North Star"** | Full rename across brand, slugs (`north-star`), DB (`northstar`), package names, PDF branding, demo emails (`demo@northstar.dev`), docs, UI preview, and the standup task. Re-verified green. (Imported knowledge source is still labelled "Privacy Copilot" — read-only, can't rename.) |

---

## 6. Next up (roadmap, recommended order)

1. ~~Dashboard + analytics~~ ✅ Done 2026-06-25.
2. ~~PDF audit reports~~ ✅ Done 2026-06-27.
3. **GDPR / India DPDP compliance recommendations** engine (knowledge base already built in `compliance.py` — just needs its own endpoint + UI).
4. **OCR for image uploads** + secure file handling.
5. **Hardening + Azure deploy** — rate limiting, CSRF, refresh tokens, secrets → Key Vault, then deploy.

---

## 7. Open questions

- Standup email: draft-only (Gmail, review then send) vs. true auto-send (different sender)? **→ awaiting Aarush.**
- Confirm 9 AM is local time and the right cadence (daily vs. weekdays only).

---

## 8. How the daily standup email is generated

A scheduled task runs daily at 9 AM local time. Each run is stateless, so it:
1. Reads this file (`docs/PROJECT_STATE.md`).
2. Summarises sections 2–3 (recently done + in progress) and section 6 (next up).
3. Prepares a Gmail draft to **aarushsre@gmail.com** titled "North Star — Daily Standup (YYYY-MM-DD)".
4. (When true-send is enabled, it sends instead of drafting.)
