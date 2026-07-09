<div align="center">

# 🛡️ North Star

**AI-powered privacy assistant — detect, redact, score, and report on sensitive
personal data before it's shared or stored.**

[![CI](https://github.com/your-org/north-star/actions/workflows/ci.yml/badge.svg)](./.github/workflows/ci.yml)
![Python](https://img.shields.io/badge/python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-async-009688)
![React](https://img.shields.io/badge/React-TypeScript-61dafb)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

---

## What it does

North Star scans text (and, later, files/images via OCR) for Personally
Identifiable Information, then:

- **Detects** names, emails, phone numbers, credit cards, IP addresses, and
  India-specific IDs — **Aadhaar, PAN, passport** — plus financial/medical hints.
- **Redacts / anonymises** the sensitive spans.
- **Scores** a transparent, reproducible **Privacy Risk Score (0–100)**.
- **Explains** each risk in plain language (LLM-assisted, with graceful fallback).
- **Recommends** DPDP Act 2023 / DPDP Rules 2025 (and GDPR) remediation steps.
- **Logs** every action to an append-only audit trail.

Built to production patterns: layered architecture, repository + service layers,
JWT auth with RBAC, Dockerised, CI on every push.

## Two editions

North Star ships as **one product in two editions** — same local detection
engine, different scope. Full breakdown in [`docs/EDITIONS.md`](docs/EDITIONS.md).

| | 🧍 **Individual** (free) | 🏢 **Organization** |
|---|---|---|
| **For** | A person protecting their own data | A company enforcing a data policy |
| **How** | Chrome extension, 100% local | Extension + managed policy + backend |
| **Core** | Real-time guard, redaction, 28+ types, custom rules | Everything in Individual, **plus** ↓ |
| **Adds** | — | Managed/locked policy, masked incident reporting, admin dashboard, weekly PDF digests, DPDP Act 2023 + Rules 2025 (& GDPR) mapping, RBAC |
| **Data** | Nothing leaves the device | Detection stays local; only **masked** summaries sync |

The Individual edition is the free, open-source wedge; the Organization edition
is the paid tier that sells oversight to companies — an **open-core** model.

## Architecture at a glance

React + TypeScript SPA → FastAPI (API → Service → Repository → Postgres) with
Redis for caching/rate-limiting. The detection engine is a framework-free Python
package so it's unit-testable in isolation. Full reasoning in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and the
[ADR log](docs/adr/).

## Quick start

```bash
# 1. Configure environment
cp .env.example .env          # then edit secrets

# 2. Bring up the full stack (db + cache + api + web)
docker compose up --build

# API     → http://localhost:8000
# OpenAPI → http://localhost:8000/docs
# Web app → http://localhost:5173
```

### Run the backend on its own

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
python -m spacy download en_core_web_lg   # NER model used by Presidio
uvicorn app.main:app --reload
pytest                                     # run the test suite
```

## Repository layout

```
north-star/
├── backend/            FastAPI service (layered: api → service → repository → db)
│   └── app/services/pii/   the detection engine (Presidio + Indian recognizers)
├── frontend/           React + TypeScript (Vite) SPA
├── docs/               ARCHITECTURE.md + Architecture Decision Records
├── docker-compose.yml  one-command local stack
└── .github/workflows/  CI: lint · type-check · test
```

## Roadmap

The walking skeleton (auth + a full end-to-end scan) is the foundation. Next
iterations, each landing green: OCR ingestion → PDF audit reports → analytics
dashboard → consent & retention workflows → Azure deployment.

## License

MIT
