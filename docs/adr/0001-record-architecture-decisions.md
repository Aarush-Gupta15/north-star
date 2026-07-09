# ADR 0001 — Use Architecture Decision Records

- **Status:** Accepted
- **Date:** 2026-06-25

## Context
This project will accrue many non-obvious decisions (detector choice, auth
scheme, scoring model, cloud target). Future-us and reviewers need the *reasoning*,
not just the result, to avoid relitigating settled questions.

## Decision
We record significant architectural decisions as short, numbered, immutable
Markdown files in `docs/adr/`. Superseding a decision means adding a new ADR
that references the old one — we never silently rewrite history.

## Consequences
- A traceable decision log that doubles as onboarding material.
- Small per-decision overhead; pays for itself the first time a choice is questioned.
