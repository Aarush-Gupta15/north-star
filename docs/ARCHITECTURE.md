# North Star — System Architecture

> AI-powered privacy assistant that detects, classifies, redacts, scores, and
> reports on sensitive personal data (PII) before it is shared or stored.

This document is the single source of truth for *why* the system is shaped the
way it is. Code shows *how*; this shows *why*.

---

## 1. High-level shape

```
┌──────────────┐      HTTPS/JSON      ┌─────────────────────────────────────┐
│  React + TS  │  ───────────────────▶│            FastAPI (ASGI)           │
│  (Vite SPA)  │◀───────────────────  │                                     │
└──────────────┘   JWT bearer auth    │  API layer  →  Service layer        │
                                      │       ↑              │              │
                                      │  Schemas (Pydantic)  ▼              │
                                      │              Repository layer       │
                                      │                     │               │
                                      └─────────────────────┼───────────────┘
                                            │               │
                                   ┌────────▼─────┐   ┌──────▼──────┐
                                   │  PostgreSQL  │   │    Redis    │
                                   │ (system of   │   │ (cache /    │
                                   │  record)     │   │  rate limit)│
                                   └──────────────┘   └─────────────┘
```

The detection brain (Presidio + custom recognizers + risk scoring + LLM
explanations) lives **inside the service layer** as an isolated, framework-free
Python package, so it can be unit-tested without a database, web server, or
network.

## 2. Layered backend (why each layer exists)

We deliberately separate four concerns. Each layer only talks to the one
directly beneath it. This is the spine that keeps the codebase changeable.

| Layer | Responsibility | Knows about | Must NOT know about |
|-------|----------------|-------------|---------------------|
| **API** (`app/api`) | HTTP: routing, status codes, auth deps, request/response shaping | Schemas, Services | SQLAlchemy, raw SQL |
| **Service** (`app/services`) | Business rules, orchestration, transactions | Repositories, domain logic | FastAPI `Request`/`Response` |
| **Repository** (`app/repositories`) | Data access — the *only* place that builds queries | SQLAlchemy models, Session | HTTP, business policy |
| **Model/DB** (`app/db`) | Table mappings, schema, migrations | The database | Everything above it |

**Why bother?** Three concrete payoffs:
1. **Testability** — services are tested against an in-memory repo or SQLite; the
   PII engine is tested with zero infrastructure.
2. **Swappability** — moving from Postgres to another store, or Presidio to a
   different detector, touches one layer, not the whole app (Dependency
   Inversion — the *D* in SOLID).
3. **Readability** — a new engineer can predict where any given line of code
   lives.

### Repository pattern
Every entity gets a repository exposing intention-revealing methods
(`get_by_email`, `create`, `list_for_user`) instead of leaking query-builders
into services. A generic `BaseRepository[Model]` removes CRUD boilerplate
(DRY) while concrete repos add entity-specific reads.

### Service layer
Services own *use cases*: "register a user", "scan a document", "produce an
audit report". They compose repositories + the PII engine and own the
transaction boundary. Controllers (API endpoints) stay thin — parse, delegate,
serialize.

## 3. The PII detection engine

A standalone package: `app/services/pii/`.

```
pii/
├── engine.py            # PiiEngine: orchestrates analysis + anonymization
├── recognizers/
│   └── indian.py        # Aadhaar, PAN, Indian passport (regex + checksum/context)
├── risk.py              # deterministic Privacy Risk Score (0–100)
└── explain.py           # LLM-backed plain-language explanations (graceful fallback)
```

**Design decision — Presidio + regex, LLM only for explanations.**
Detection must be *deterministic, fast, offline, and free per scan*, so the core
uses Microsoft Presidio (spaCy NER + recognizers) extended with custom Indian
recognizers. The LLM is used **only** to translate findings into human-readable
risk explanations — a place where non-determinism is acceptable and the system
degrades gracefully to templated text if no API key is configured. This keeps
unit tests stable and avoids per-scan cost/latency on the hot path.

**Risk scoring** is a transparent, weighted function of (entity sensitivity ×
confidence × count), not an opaque model — auditors and regulators must be able
to reproduce a score by hand. See `risk.py` for the weight table.

## 4. Data model (walking-skeleton subset)

- **User** — identity, hashed password, `role` (admin | analyst | user) for RBAC.
- **Scan** — one detection run: input metadata, risk score, detected-entity
  summary (no raw PII stored — *data minimisation*), timestamps, owner.
- **AuditLog** — append-only record of security-relevant actions (who did what,
  when) underpinning the GDPR/DPDP audit-trail requirement.

Raw sensitive content is **never persisted**. We store findings and redacted
output, not the original PII — Privacy by Design and Storage Limitation baked
into the schema itself.

## 5. Security posture (skeleton → production)

| Control | Skeleton | Production target |
|---------|----------|-------------------|
| AuthN | JWT (HS256), bcrypt password hashing | rotate keys; consider RS256 |
| AuthZ | RBAC dependency (`require_role`) | per-resource ownership checks |
| Transport | CORS-locked API | TLS termination at ingress (HTTPS) |
| Input | Pydantic validation everywhere | + payload size limits, file AV scan hook |
| Injection | ORM-parameterised queries (no string SQL) | static analysis in CI |
| Secrets | `.env` (gitignored) | Azure Key Vault / managed identity |
| Abuse | Redis-backed rate-limit hook | per-route + per-IP quotas |

## 6. Deployment direction

Local: `docker compose up`. CI (GitHub Actions): lint → type-check → test for
both backend and frontend. Target cloud: Azure (Container Apps + managed
Postgres + managed Redis), with secrets in Key Vault. Each piece is introduced
incrementally so the skeleton always stays green.

## 7. What is intentionally a stub right now

The walking skeleton proves the spine works end-to-end. These are scaffolded
with clean seams and filled in over later iterations: OCR ingestion, PDF audit
reports, analytics dashboards, consent/retention workflows, virus-scan hook,
and the full RBAC matrix. Each has a defined home in the layout already.
