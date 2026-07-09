"""Seed demo data so the dashboard looks alive in local dev / screenshots.

Creates a demo user and a spread of scans across the last two weeks with varied
risk levels and PII types. Idempotent-ish: it tops up to a target scan count.

Usage (from the backend/ directory, DB running):
    python scripts/seed.py
"""
from __future__ import annotations

import os
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Make ``app`` importable when run as a plain script.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("SECRET_KEY", "dev-only-secret-change-me-0123456789abcdef0123456789abcdef")

from app.core.security import hash_password  # noqa: E402
from app.db.models.scan import Scan  # noqa: E402
from app.db.models.user import User, UserRole  # noqa: E402
from app.db.session import _session_factory  # noqa: E402
from app.services.pii.risk import Finding, compute_risk_score, level_for  # noqa: E402

DEMO_EMAIL = "demo@northstar.dev"
DEMO_PASSWORD = "DemoPass123"
TARGET_SCANS = 60

# Plausible PII mixes to sample from, weighted toward common types.
_PII_PROFILES = [
    [("EMAIL_ADDRESS", 0.95)],
    [("EMAIL_ADDRESS", 0.95), ("PHONE_NUMBER", 0.6)],
    [("IN_AADHAAR", 0.85), ("IN_PAN", 0.85)],
    [("CREDIT_CARD", 0.9), ("EMAIL_ADDRESS", 0.95)],
    [("PERSON", 0.5), ("LOCATION", 0.45), ("PHONE_NUMBER", 0.6)],
    [("IP_ADDRESS", 0.8)],
    [("IN_PASSPORT", 0.6), ("PERSON", 0.5)],
    [],  # a clean scan
]


def _summary(profile: list[tuple[str, float]]) -> list[dict]:
    out: dict[str, dict] = {}
    for ptype, conf in profile:
        item = out.setdefault(ptype, {"type": ptype, "count": 0, "max_confidence": conf})
        item["count"] += random.randint(1, 3)
        item["max_confidence"] = max(item["max_confidence"], conf)
    return list(out.values())


def main() -> None:
    session = _session_factory()()
    try:
        user = session.query(User).filter(User.email == DEMO_EMAIL).one_or_none()
        if user is None:
            user = User(
                email=DEMO_EMAIL,
                full_name="Demo Analyst",
                hashed_password=hash_password(DEMO_PASSWORD),
                role=UserRole.ANALYST,
            )
            session.add(user)
            session.flush()
            print(f"Created demo user {DEMO_EMAIL} / {DEMO_PASSWORD} (role=analyst)")

        existing = session.query(Scan).filter(Scan.owner_id == user.id).count()
        to_create = max(0, TARGET_SCANS - existing)
        now = datetime.now(timezone.utc)

        for _ in range(to_create):
            profile = random.choice(_PII_PROFILES)
            summary = _summary(profile)
            findings = [
                Finding(item["type"], item["max_confidence"])
                for item in summary
                for _ in range(item["count"])
            ]
            score = compute_risk_score(findings)
            created = now - timedelta(
                days=random.randint(0, 13), hours=random.randint(0, 23)
            )
            session.add(
                Scan(
                    owner_id=user.id,
                    source_type="text",
                    char_count=random.randint(80, 600),
                    risk_score=score,
                    risk_level=level_for(score),
                    entity_count=len(findings),
                    findings_summary=summary,
                    created_at=created,
                    updated_at=created,
                )
            )

        _seed_incidents(session, user.id)

        session.commit()
        print(f"Seed complete: {to_create} scans added (total {existing + to_create}).")
    finally:
        session.close()


def _seed_incidents(session, owner_id) -> None:
    """A few demo policy incidents so the admin Incidents page is populated."""
    from app.db.models.incident import Incident

    if session.query(Incident).count() > 0:
        return
    now = datetime.now(timezone.utc)
    demos = [
        ("ravi.kumar@corp.com", "chatgpt.com", "critical",
         [("CREDIT_CARD", 1), ("CVV", 1)], "my card •••• 1111 cvv •••• 483", 2),
        ("neha.shah@corp.com", "claude.ai", "high",
         [("PASSWORD", 1)], "the db password is •••• kf9x", 6),
        ("amit.verma@corp.com", "gemini.google.com", "critical",
         [("IN_AADHAAR", 1), ("IN_PAN", 1)], "aadhaar •••• 6783, pan •••• 234F", 20),
        ("ravi.kumar@corp.com", "chatgpt.com", "medium",
         [("EMAIL_ADDRESS", 1), ("PHONE_NUMBER", 1)], "a•••@gmail.com, •••• 3210", 26),
        ("neha.shah@corp.com", "web.whatsapp.com", "high",
         [("IN_AADHAAR", 1)], "employee aadhaar •••• 4521", 50),
    ]
    for label, site, level, types, snippet, hours_ago in demos:
        session.add(
            Incident(
                owner_id=owner_id,
                actor_label=label,
                site=site,
                action="sent",
                risk_score={"critical": 90.0, "high": 65.0, "medium": 40.0}[level],
                risk_level=level,
                entity_count=sum(c for _, c in types),
                findings_summary=[{"type": t, "count": c, "max_confidence": 0.9} for t, c in types],
                masked_snippet=snippet,
                created_at=now - timedelta(hours=hours_ago),
                updated_at=now - timedelta(hours=hours_ago),
            )
        )
    print("Seeded 5 demo incidents.")


if __name__ == "__main__":
    main()
