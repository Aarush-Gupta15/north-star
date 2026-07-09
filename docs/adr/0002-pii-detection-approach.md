# ADR 0002 — PII detection via Presidio + regex; LLM for explanations only

- **Status:** Accepted
- **Date:** 2026-06-25

## Context
The core feature is detecting PII (names, emails, phones, Aadhaar, PAN,
passport, cards, IPs, etc.). Options considered:
1. **LLM-first** — send text to an LLM and ask for structured findings.
2. **Pure regex + spaCy NER** — fully hand-rolled.
3. **Presidio + custom regex recognizers; LLM only for human explanations.**

## Decision
Option **3**.

Detection sits on the hot path and feeds a compliance score, so it must be
**deterministic, reproducible, offline, fast, and free per scan**. Microsoft
Presidio gives a production-grade analyzer/anonymizer framework with spaCy NER
and pluggable recognizers; we extend it with custom recognizers for
India-specific identifiers (Aadhaar with Verhoeff checksum, PAN, passport) that
generic tools miss. The LLM is confined to generating plain-language risk
explanations — non-determinism there is harmless and the system falls back to
templated text when no API key is present.

## Consequences
- **+** Stable, hand-reproducible scores; testable without network; no per-scan cost.
- **+** Clear extension seam: new PII type = new recognizer class.
- **−** spaCy model adds image size / cold-start weight (acceptable; cached in Docker layer).
- **−** Regex recognizers need careful tuning to balance false positives/negatives — covered by unit tests.

## Supersedes / Superseded by
None.
