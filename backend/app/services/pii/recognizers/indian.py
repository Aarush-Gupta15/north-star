"""Presidio recognizers for India-specific identifiers.

Generic PII tools miss Aadhaar/PAN/passport. We register custom recognizers
built on the SAME regex/validators as ``patterns.py`` so the framework path and
the pure-Python fast path can never disagree.

Imports of Presidio are deferred inside the factory so this module (and the
tests that touch the patterns) stay importable even where Presidio isn't
installed.
"""
from __future__ import annotations

from typing import Any

from app.services.pii import patterns


def build_indian_recognizers() -> list[Any]:
    """Construct Presidio ``PatternRecognizer`` objects. Aadhaar additionally
    applies a Verhoeff checksum via a validation hook to cut false positives."""
    from presidio_analyzer import Pattern, PatternRecognizer

    class AadhaarRecognizer(PatternRecognizer):
        def validate_result(self, pattern_text: str) -> bool | None:
            return patterns.verhoeff_is_valid(pattern_text)

    aadhaar = AadhaarRecognizer(
        supported_entity="IN_AADHAAR",
        patterns=[Pattern("aadhaar", patterns.AADHAAR_RE.pattern, 0.6)],
        context=["aadhaar", "uid", "uidai"],
    )
    pan = PatternRecognizer(
        supported_entity="IN_PAN",
        patterns=[Pattern("pan", patterns.PAN_RE.pattern, 0.7)],
        context=["pan", "permanent account number", "income tax"],
    )
    passport = PatternRecognizer(
        supported_entity="IN_PASSPORT",
        patterns=[Pattern("passport", patterns.PASSPORT_RE.pattern, 0.5)],
        context=["passport"],
    )
    return [aadhaar, pan, passport]
