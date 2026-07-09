"""Integration tests for the analytics dashboard endpoint."""
from __future__ import annotations


def _register_and_login(client) -> dict[str, str]:
    client.post(
        "/api/v1/auth/register",
        json={"email": "ana@example.com", "password": "supersecret1", "full_name": "Ana"},
    )
    token = client.post(
        "/api/v1/auth/login",
        json={"email": "ana@example.com", "password": "supersecret1"},
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_dashboard_requires_auth(client):
    assert client.get("/api/v1/analytics/dashboard").status_code == 401


def test_dashboard_empty_state(client):
    headers = _register_and_login(client)
    r = client.get("/api/v1/analytics/dashboard", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total_scans"] == 0
    assert body["privacy_posture_score"] == 100.0
    assert body["compliance_score"] == 100.0
    assert len(body["trend"]) == 14  # always a full 14-day window
    assert body["top_pii"] == []


def test_dashboard_reflects_scans(client):
    headers = _register_and_login(client)
    # Two scans: one card+email (high), one clean.
    client.post(
        "/api/v1/scans",
        headers=headers,
        json={"text": "ada@example.com card 4111 1111 1111 1111", "explain": False},
    )
    client.post(
        "/api/v1/scans",
        headers=headers,
        json={"text": "the quick brown fox", "explain": False},
    )

    body = client.get("/api/v1/analytics/dashboard", headers=headers).json()
    assert body["total_scans"] == 2
    assert body["scope"] == "you"  # regular user sees own scope
    types = {p["type"] for p in body["top_pii"]}
    assert "EMAIL_ADDRESS" in types and "CREDIT_CARD" in types
    # Risk breakdown counts should sum to the number of scans.
    b = body["risk_breakdown"]
    assert b["low"] + b["medium"] + b["high"] + b["critical"] == 2
