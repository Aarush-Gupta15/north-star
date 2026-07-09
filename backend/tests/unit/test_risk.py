"""Unit tests for the deterministic risk-scoring model."""
from __future__ import annotations

from app.services.pii.risk import Finding, compute_risk_score, level_for


def test_empty_findings_is_zero_low():
    assert compute_risk_score([]) == 0.0
    assert level_for(0.0) == "low"


def test_single_aadhaar_is_high_or_critical():
    score = compute_risk_score([Finding("IN_AADHAAR", 0.9)])
    assert score >= 55  # a national ID alone is at least "high"
    assert level_for(score) in {"high", "critical"}


def test_more_findings_increase_score_monotonically():
    one = compute_risk_score([Finding("EMAIL_ADDRESS", 0.9)])
    many = compute_risk_score([Finding("EMAIL_ADDRESS", 0.9)] * 5)
    assert many > one


def test_score_is_capped_at_100():
    findings = [Finding("IN_AADHAAR", 1.0)] * 50 + [Finding("CREDIT_CARD", 1.0)] * 50
    assert compute_risk_score(findings) <= 100.0


def test_levels_have_correct_boundaries():
    assert level_for(10) == "low"
    assert level_for(30) == "medium"
    assert level_for(60) == "high"
    assert level_for(90) == "critical"
