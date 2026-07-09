"""Privacy Risk Score — transparent, deterministic, hand-reproducible.

Regulators and auditors must be able to reproduce a score with a calculator, so
this is an explicit weighted function, never an opaque model.

Score (0–100) = clamp( base_severity_contribution + volume_contribution ).

Each detected entity contributes ``sensitivity_weight × confidence``. Multiple
findings of the same high-sensitivity type compound (a leak of 50 Aadhaar
numbers is worse than one), but with diminishing returns so a single very
sensitive item already lands in the danger zone.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

# Sensitivity weights (0–1). Calibrated so a single national ID or card alone
# pushes into "high"; lower-sensitivity items need volume to matter.
SENSITIVITY_WEIGHTS: dict[str, float] = {
    "IN_AADHAAR": 1.00,
    "CREDIT_CARD": 1.00,
    "IN_PAN": 0.90,
    "IN_PASSPORT": 0.90,
    "US_PASSPORT": 0.90,
    "MEDICAL_LICENSE": 0.85,
    "IBAN_CODE": 0.85,
    "MEDICAL": 0.80,
    "FINANCIAL": 0.80,
    "US_SSN": 1.00,
    "PHONE_NUMBER": 0.55,
    "EMAIL_ADDRESS": 0.45,
    "LOCATION": 0.45,
    "PERSON": 0.40,
    "IP_ADDRESS": 0.35,
    "DATE_TIME": 0.15,
    "URL": 0.15,
}
_DEFAULT_WEIGHT = 0.30

_THRESHOLDS = [(80.0, "critical"), (55.0, "high"), (25.0, "medium"), (0.0, "low")]


@dataclass(frozen=True)
class Finding:
    type: str
    confidence: float


def _weight(entity_type: str) -> float:
    return SENSITIVITY_WEIGHTS.get(entity_type, _DEFAULT_WEIGHT)


def level_for(score: float) -> str:
    for threshold, label in _THRESHOLDS:
        if score >= threshold:
            return label
    return "low"


def compute_risk_score(findings: list[Finding]) -> float:
    """Return a 0–100 risk score.

    - The single most sensitive finding sets a strong floor (severity term).
    - Additional findings add volume with logarithmic diminishing returns.
    """
    if not findings:
        return 0.0

    weighted = sorted((_weight(f.type) * _clamp01(f.confidence) for f in findings), reverse=True)

    # Severity term: dominated by the worst finding, scaled to ~0–70.
    severity = weighted[0] * 70.0

    # Volume term: remaining findings add up to ~30 more, with diminishing returns.
    remaining = sum(weighted[1:])
    volume = (1 - math.exp(-remaining)) * 30.0

    return round(min(100.0, severity + volume), 1)


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))
