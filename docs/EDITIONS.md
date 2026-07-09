# North Star — Editions

North Star ships as **one product in two editions**. They share the same local
detection engine (`extension/src/engine.js`) — the difference is configuration
and deployment, not a code fork.

---

## 🧍 Personal edition (for individuals) — free, local-only

For a person who just wants to stop leaking their own data into websites and AI
chatbots. **No account, no server, nothing leaves the device.**

**What's included:**
- The **Chrome extension** running 100% locally.
- Real-time **type-guard** — warns as you type in any field (incl. ChatGPT/Claude/Gemini).
- Inline highlighting + **one-click Redact**.
- Whole-page scan, right-click scan, toolbar badge.
- **28+ built-in detectors** (cards, Aadhaar, PAN, passwords, secrets, crypto, etc.).
- **Personal custom rules** — add your own words/keywords/regex in the extension Options.
- Starter packs + import/export of a rule file.

**What it deliberately does NOT do:**
- No backend, no dashboard, no reporting, no monitoring. Fully private.

**How to run it:** install the extension (Web Store or "Load unpacked"). That's it.

---

## 🏢 Organization edition (for companies) — managed + oversight

For a company that needs to enforce a data policy and see when employees leak
sensitive data. **Everything in Personal, plus central control and reporting.**

**What's added on top of Personal:**
- **Managed policy** (Chrome `chrome.storage.managed`) — IT pushes the sensitive-term
  rules org-wide; they're **enforced and locked** so employees can't disable them.
- **Incident reporting** — when an employee *sends* flagged data despite a warning,
  the extension posts a **masked** incident (metadata + last-4 snippet, never the
  raw value) to the company backend.
- **Web dashboard** (React + FastAPI + PostgreSQL + Redis):
  - **Analytics** — total scans, high-risk count, privacy posture, compliance score,
    top data types, trends.
  - **Incidents page** (admin/analyst only) — which employee, when, which site,
    data types, masked snippet — plus a **weekly PDF digest**.
  - **DPDP Act 2023 + DPDP Rules 2025** (and **GDPR**) compliance mapping and PDF audit reports.
- **Roles (RBAC)** — admin / analyst / user.
- **DevOps** — Docker Compose, GitHub Actions CI, Azure-ready.

**How to run it:** deploy the backend (`docker compose up`), and configure the
extension (API URL + token, or push both via managed policy) with incident
reporting enabled. See `extension/ENTERPRISE.md`.

---

## Feature matrix

| Capability | 🧍 Personal | 🏢 Organization |
|---|:---:|:---:|
| Local real-time detection & warnings | ✅ | ✅ |
| Inline highlight + one-click redact | ✅ | ✅ |
| 28+ built-in data types | ✅ | ✅ |
| Personal custom rules (words/keywords/regex) | ✅ | ✅ |
| Import/export a rule file | ✅ | ✅ |
| Runs 100% locally, nothing transmitted | ✅ | ✅ (detection stays local) |
| **Company-managed, locked policy** | — | ✅ |
| **Incident reporting to management (masked)** | — | ✅ |
| **Admin dashboard + analytics** | — | ✅ |
| **Incidents page + weekly PDF digest** | — | ✅ |
| **DPDP Act 2023 + Rules 2025 / GDPR compliance mapping & reports** | — | ✅ |
| **Roles / RBAC** | — | ✅ |
| Backend + database required | No | Yes |

---

## Why this maps to an open-core business

- **Personal** is the free, open-source wedge that drives adoption and word of mouth.
- **Organization** is the paid tier: companies pay for oversight, policy enforcement,
  and compliance reporting — sold to the *company*, not the individual.

Same engine, two audiences. That's the whole go-to-market (see `marketing/GO_TO_MARKET.md`).
