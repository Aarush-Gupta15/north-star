"""Unit tests for the compliance knowledge base and PDF report rendering."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.db.models.user import User, UserRole
from app.services import compliance
from app.services.report_service import ReportService


def test_rule_lookup_known_and_default():
    aadhaar = compliance.rule_for("IN_AADHAAR")
    assert aadhaar.severity == "critical"
    assert "Aadhaar" in aadhaar.gdpr or "national" in aadhaar.gdpr.lower()
    # Unknown type falls back to the default rule, never crashes.
    fallback = compliance.rule_for("SOMETHING_NEW")
    assert fallback.label == "Personal data"


def test_findings_sorted_by_severity():
    pairs = compliance.findings_for_types(["EMAIL_ADDRESS", "IN_AADHAAR", "PHONE_NUMBER"])
    severities = [rule.severity for _t, rule in pairs]
    assert severities[0] == "critical"  # Aadhaar floats to the top


class _FakeScan:
    """Minimal stand-in so the renderer test needs no database."""

    def __init__(self):
        self.id = uuid.uuid4()
        self.risk_score = 88.0
        self.risk_level = "critical"
        self.entity_count = 3
        self.char_count = 142
        self.findings_summary = [
            {"type": "IN_AADHAAR", "count": 1, "max_confidence": 0.85},
            {"type": "EMAIL_ADDRESS", "count": 2, "max_confidence": 0.95},
        ]
        self.created_at = datetime.now(timezone.utc)


def _owner() -> User:
    return User(id=uuid.uuid4(), email="owner@example.com", role=UserRole.USER,
                hashed_password="x", is_active=True)


def test_report_renders_valid_pdf_bytes():
    pdf = ReportService().build_pdf(_FakeScan(), _owner())
    assert isinstance(pdf, bytes) and len(pdf) > 1000
    assert pdf[:5] == b"%PDF-"  # valid PDF magic header


def test_report_handles_clean_scan():
    scan = _FakeScan()
    scan.entity_count = 0
    scan.findings_summary = []
    scan.risk_level = "low"
    scan.risk_score = 0.0
    pdf = ReportService().build_pdf(scan, _owner())
    assert pdf[:5] == b"%PDF-"
