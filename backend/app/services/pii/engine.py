"""PiiEngine — orchestrates detection, redaction, scoring, and explanation.

Two detection paths behind one interface:

* **Presidio path** (preferred): spaCy NER + built-in recognizers + our custom
  Indian recognizers. Catches names, locations, emails, phones, cards, IPs,
  Aadhaar, PAN, passport, and more.
* **Regex fallback**: pure ``patterns.py`` detectors. Used automatically when
  Presidio/spaCy aren't available (e.g. lightweight CI), so the engine never
  hard-fails and unit tests run with no heavy model download.

The engine is intentionally free of FastAPI/SQLAlchemy imports — it can be unit
tested, run from a CLI, or embedded in a worker unchanged.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from functools import lru_cache

from app.core.logging import get_logger
from app.services.pii import patterns
from app.services.pii.explain import explain_findings
from app.services.pii.risk import Finding, compute_risk_score, level_for

logger = get_logger(__name__)


@dataclass
class Entity:
    type: str
    text: str
    start: int
    end: int
    confidence: float


@dataclass
class EngineResult:
    entities: list[Entity]
    risk_score: float
    risk_level: str
    redacted_text: str
    summary: list[dict] = field(default_factory=list)
    explanation: str | None = None

    @property
    def entity_count(self) -> int:
        return len(self.entities)


# Maps our regex detector functions to canonical entity type names.
_REGEX_DETECTORS: list[tuple[str, float, callable]] = [
    ("EMAIL_ADDRESS", 0.95, patterns.find_emails),
    ("CREDIT_CARD", 0.9, patterns.find_cards),
    ("IN_AADHAAR", 0.85, patterns.find_aadhaar),
    ("IN_PAN", 0.85, patterns.find_pan),
    ("IN_PASSPORT", 0.6, patterns.find_passport),
    ("IP_ADDRESS", 0.8, patterns.find_ipv4),
    ("PHONE_NUMBER", 0.6, patterns.find_phones),
]


class PiiEngine:
    def __init__(self) -> None:
        self._analyzer = self._try_build_presidio()
        self.backend = "presidio" if self._analyzer is not None else "regex"
        logger.info("PiiEngine initialised with backend=%s", self.backend)

    # --- Construction -------------------------------------------------------

    @staticmethod
    def _try_build_presidio():
        """Build a Presidio AnalyzerEngine with custom recognizers, or return
        None if the dependency/model isn't present (we then use regex)."""
        try:
            from presidio_analyzer import AnalyzerEngine

            from app.services.pii.recognizers.indian import build_indian_recognizers

            analyzer = AnalyzerEngine()
            for rec in build_indian_recognizers():
                analyzer.registry.add_recognizer(rec)
            return analyzer
        except Exception as exc:  # missing presidio, missing spaCy model, etc.
            logger.warning("Presidio unavailable (%s); falling back to regex engine.", exc)
            return None

    # --- Detection ----------------------------------------------------------

    def detect(self, text: str) -> list[Entity]:
        if self._analyzer is not None:
            return self._detect_presidio(text)
        return self._detect_regex(text)

    def _detect_presidio(self, text: str) -> list[Entity]:
        results = self._analyzer.analyze(text=text, language="en")
        entities = [
            Entity(
                type=r.entity_type,
                text=text[r.start : r.end],
                start=r.start,
                end=r.end,
                confidence=round(float(r.score), 2),
            )
            for r in results
        ]
        return self._dedupe(entities)

    def _detect_regex(self, text: str) -> list[Entity]:
        entities: list[Entity] = []
        for entity_type, confidence, detector in _REGEX_DETECTORS:
            for start, end, raw in detector(text):
                entities.append(Entity(entity_type, raw, start, end, confidence))
        return self._dedupe(entities)

    @staticmethod
    def _dedupe(entities: list[Entity]) -> list[Entity]:
        """Drop entities fully contained within another (keep the longer/stronger
        span). Prevents e.g. a phone match swallowed inside a card match from
        double-counting."""
        ordered = sorted(entities, key=lambda e: (e.start, -(e.end - e.start)))
        kept: list[Entity] = []
        for e in ordered:
            if any(k.start <= e.start and e.end <= k.end and k is not e for k in kept):
                continue
            kept.append(e)
        return sorted(kept, key=lambda e: e.start)

    # --- Redaction ----------------------------------------------------------

    @staticmethod
    def redact(text: str, entities: list[Entity]) -> str:
        """Replace each detected span with ``[TYPE]``. Applied right-to-left so
        earlier offsets stay valid as we mutate the string."""
        redacted = text
        for e in sorted(entities, key=lambda e: e.start, reverse=True):
            redacted = redacted[: e.start] + f"[{e.type}]" + redacted[e.end :]
        return redacted

    # --- Summarisation ------------------------------------------------------

    @staticmethod
    def summarise(entities: list[Entity]) -> list[dict]:
        agg: dict[str, dict] = defaultdict(lambda: {"count": 0, "max_confidence": 0.0})
        for e in entities:
            agg[e.type]["count"] += 1
            agg[e.type]["max_confidence"] = max(agg[e.type]["max_confidence"], e.confidence)
        return [
            {"type": t, "count": v["count"], "max_confidence": round(v["max_confidence"], 2)}
            for t, v in sorted(agg.items(), key=lambda kv: -kv[1]["count"])
        ]

    # --- Public entry point -------------------------------------------------

    def scan(self, text: str, explain: bool = True) -> EngineResult:
        entities = self.detect(text)
        summary = self.summarise(entities)
        score = compute_risk_score([Finding(e.type, e.confidence) for e in entities])
        level = level_for(score)
        explanation = explain_findings(summary, level) if explain else None
        return EngineResult(
            entities=entities,
            risk_score=score,
            risk_level=level,
            redacted_text=self.redact(text, entities),
            summary=summary,
            explanation=explanation,
        )


@lru_cache
def get_engine() -> PiiEngine:
    """Process-wide singleton — building Presidio/spaCy is expensive, do it once."""
    return PiiEngine()
