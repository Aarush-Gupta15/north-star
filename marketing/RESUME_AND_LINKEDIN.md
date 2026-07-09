# Résumé bullets + LinkedIn post — North Star

Copy-paste ready. Fill in the bracketed metrics once you have them (installs,
GitHub stars, etc.). Numbers make bullets 10× stronger — even "50+ installs" or
"detects 28 data types" counts.

---

## Résumé / CV bullets

**Pick 3–4. Lead with impact, name the tech, quantify where you can.**

**North Star — Privacy Guard · Chrome Extension + Full-Stack Web App** _(Personal project, 2026)_

- Built and shipped a **Chrome extension (Manifest V3)** that detects sensitive
  data in real time as users type into any web field — including AI chatbots
  (ChatGPT, Claude, Gemini) — preventing accidental leaks of passwords, cards,
  Aadhaar/PAN, and API keys; **published to the Chrome Web Store** with [N] users.
- Engineered a **fully-local detection engine** (28+ PII/secret types) in
  JavaScript with **Luhn and Verhoeff checksum validation** to minimise false
  positives; all analysis runs on-device, so no user text ever leaves the browser.
- Implemented **Grammarly-style inline highlighting** inside non-editable fields
  by measuring per-span on-screen rectangles (mirror-element + Range APIs),
  updating continuously on input/scroll with one-click redaction.
- Designed the companion platform: **FastAPI + PostgreSQL + Redis** backend
  (layered architecture, repository & service patterns, JWT auth + RBAC), a
  **React + TypeScript** dashboard, **Dockerised** with **GitHub Actions CI**
  (33 passing tests, linting, type-checks).
- Added compliance mapping to India's **DPDP Act, 2023 & DPDP Rules, 2025** (and
  **GDPR**) and auto-generated **PDF audit reports**; built privacy-by-design in
  — raw PII is never persisted, only summaries.

**Short version (one line, for a dense résumé):**

- **North Star** — Shipped a Manifest V3 Chrome extension (React/TS + FastAPI)
  that warns users in real time before pasting passwords, cards, or IDs into AI
  chatbots; 28+ data types detected 100% on-device; Dockerised backend with CI
  and 33 tests.

---

## LinkedIn launch post

> 🛡️ I built **North Star** — think *Grammarly, but for your privacy*.
>
> We're all pasting things into ChatGPT and Claude all day. Sometimes that's a
> password, a card number, an Aadhaar, or an API key — and once it's sent, it's
> gone.
>
> North Star is a Chrome extension that watches any text box and warns you **the
> moment you type something sensitive**, right before you hit send — with one
> click to redact it. It detects 28+ types of sensitive data (cards, Aadhaar,
> PAN, passwords, secrets, crypto keys…).
>
> The part I'm proudest of: it's **100% local**. A privacy tool shouldn't itself
> be a privacy risk, so every check runs inside your browser — no server, no
> account, nothing leaves your device.
>
> Under the hood: a Manifest V3 extension with a bundled JS detection engine
> (Luhn/Verhoeff checksums to cut false alarms), plus an optional FastAPI +
> React dashboard for teams, Dockerised with CI.
>
> It's free and open-source. Would love your feedback 👇
> 🔗 [Chrome Web Store link]  ·  ⭐ [GitHub link]
>
> #Privacy #AI #CyberSecurity #ChromeExtension #OpenSource #BuildInPublic

**Tips:** post Tue–Thu morning; reply to every comment in the first hour (boosts
reach); attach the demo GIF; tag 2–3 relevant people/communities, not more.

---

## Elevator pitch (verbal, ~15 seconds)

> "North Star is Grammarly for privacy — a Chrome extension that warns you before
> you paste sensitive data like passwords or card numbers into ChatGPT or any
> website. It runs entirely in your browser, so nothing ever leaves your device.
> It's free, open-source, and on the Chrome Web Store."
