"""Unit tests for the PiiEngine orchestration (regex backend path)."""
from __future__ import annotations

from app.services.pii.engine import PiiEngine


def _regex_engine() -> PiiEngine:
    """Force the dependency-free regex backend so this test never needs spaCy."""
    engine = PiiEngine.__new__(PiiEngine)
    engine._analyzer = None  # type: ignore[attr-defined]
    engine.backend = "regex"
    return engine


def test_scan_detects_and_redacts():
    engine = _regex_engine()
    text = "Email ada@example.com card 4111 1111 1111 1111"
    result = engine.scan(text, explain=True)

    types = {e.type for e in result.entities}
    assert "EMAIL_ADDRESS" in types
    assert "CREDIT_CARD" in types

    # Original values must be gone from the redacted output.
    assert "ada@example.com" not in result.redacted_text
    assert "[EMAIL_ADDRESS]" in result.redacted_text
    assert result.risk_score > 0


def test_summary_aggregates_counts():
    engine = _regex_engine()
    result = engine.scan("a@x.com b@y.com c@z.com", explain=False)
    email = next(s for s in result.summary if s["type"] == "EMAIL_ADDRESS")
    assert email["count"] == 3


def test_explanation_falls_back_without_api_key():
    engine = _regex_engine()
    result = engine.scan("call +1 415 555 0132", explain=True)
    # Template fallback always returns a non-empty string.
    assert result.explanation and len(result.explanation) > 10


def test_clean_text_scores_zero():
    engine = _regex_engine()
    result = engine.scan("the quick brown fox jumps over the lazy dog", explain=False)
    assert result.entity_count == 0
    assert result.risk_score == 0.0
    assert result.risk_level == "low"
