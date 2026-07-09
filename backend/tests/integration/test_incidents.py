"""Integration tests for the incident-reporting pipeline."""
from __future__ import annotations

from app.core.security import create_access_token, hash_password
from app.db.models.user import User, UserRole


def _user(db, role=UserRole.USER, email="emp@corp.com") -> User:
    u = User(email=email, hashed_password=hash_password("supersecret1"), role=role)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _headers(user) -> dict[str, str]:
    token = create_access_token(subject=str(user.id), role=user.role.value)
    return {"Authorization": f"Bearer {token}"}


_PAYLOAD = {
    "site": "chatgpt.com",
    "action": "sent",
    "risk_score": 88.0,
    "risk_level": "critical",
    "entity_count": 2,
    "findings_summary": [{"type": "CREDIT_CARD", "count": 1, "max_confidence": 0.95}],
    "masked_snippet": "my card •••• 1111 and aadhaar •••• 6783",
}


def test_employee_can_report_incident(client, db_session):
    emp = _user(db_session)
    r = client.post("/api/v1/incidents", headers=_headers(emp), json=_PAYLOAD)
    assert r.status_code == 201
    body = r.json()
    assert body["site"] == "chatgpt.com"
    assert "••••" in body["masked_snippet"]  # masked, not raw
    assert body["actor_label"] == "emp@corp.com"


def test_employee_cannot_list_incidents(client, db_session):
    emp = _user(db_session, role=UserRole.USER)
    r = client.get("/api/v1/incidents", headers=_headers(emp))
    assert r.status_code == 403  # only analyst/admin


def test_admin_can_list_and_download_report(client, db_session):
    emp = _user(db_session, email="e1@corp.com")
    admin = _user(db_session, role=UserRole.ADMIN, email="admin@corp.com")
    client.post("/api/v1/incidents", headers=_headers(emp), json=_PAYLOAD)

    lst = client.get("/api/v1/incidents", headers=_headers(admin))
    assert lst.status_code == 200
    assert len(lst.json()) == 1

    pdf = client.get("/api/v1/incidents/report.pdf", headers=_headers(admin))
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content[:5] == b"%PDF-"


def test_report_bad_risk_level_rejected(client, db_session):
    emp = _user(db_session)
    bad = dict(_PAYLOAD, risk_level="extreme")
    r = client.post("/api/v1/incidents", headers=_headers(emp), json=bad)
    assert r.status_code == 422
