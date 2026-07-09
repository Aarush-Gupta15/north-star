"""End-to-end API test: register → login → scan, through every layer.

Runs against the in-memory SQLite DB from conftest, exercising the real router,
dependencies, services, repositories, and the PII engine together.
"""
from __future__ import annotations


def _auth_headers(client) -> dict[str, str]:
    client.post(
        "/api/v1/auth/register",
        json={"email": "ada@example.com", "password": "supersecret1", "full_name": "Ada"},
    )
    token = client.post(
        "/api/v1/auth/login",
        json={"email": "ada@example.com", "password": "supersecret1"},
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_health_ok(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_register_rejects_duplicate(client):
    payload = {"email": "dup@example.com", "password": "supersecret1"}
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    r = client.post("/api/v1/auth/register", json=payload)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "conflict"


def test_scan_requires_auth(client):
    r = client.post("/api/v1/scans", json={"text": "ada@example.com"})
    assert r.status_code == 401


def test_full_scan_flow(client):
    headers = _auth_headers(client)
    r = client.post(
        "/api/v1/scans",
        headers=headers,
        json={"text": "Reach Ada at ada@example.com or 4111 1111 1111 1111", "explain": True},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["entity_count"] >= 2
    assert body["risk_level"] in {"medium", "high", "critical"}
    assert "[EMAIL_ADDRESS]" in body["redacted_text"]
    assert body["explanation"]

    # The scan should now appear in the user's history.
    history = client.get("/api/v1/scans", headers=headers).json()
    assert len(history) == 1
    assert history[0]["id"] == body["id"]


def test_ingest_summary_records_scan_without_raw_text(client):
    headers = _auth_headers(client)
    payload = {
        "source_type": "extension",
        "char_count": 1200,
        "risk_score": 72.5,
        "risk_level": "high",
        "entity_count": 4,
        "findings_summary": [
            {"type": "EMAIL_ADDRESS", "count": 2, "max_confidence": 0.95},
            {"type": "IN_PAN", "count": 1, "max_confidence": 0.85},
        ],
    }
    r = client.post("/api/v1/scans/ingest", headers=headers, json=payload)
    assert r.status_code == 201
    body = r.json()
    assert body["risk_level"] == "high"
    assert body["source_type"] == "extension"

    # It shows up in history and on the dashboard.
    history = client.get("/api/v1/scans", headers=headers).json()
    assert len(history) == 1
    dash = client.get("/api/v1/analytics/dashboard", headers=headers).json()
    assert dash["total_scans"] == 1
    assert any(p["type"] == "EMAIL_ADDRESS" for p in dash["top_pii"])


def test_ingest_rejects_bad_risk_level(client):
    headers = _auth_headers(client)
    r = client.post(
        "/api/v1/scans/ingest",
        headers=headers,
        json={"risk_score": 50, "risk_level": "extreme", "entity_count": 1},
    )
    assert r.status_code == 422  # Literal validation rejects unknown level


def test_login_wrong_password(client):
    client.post("/api/v1/auth/register", json={"email": "x@y.com", "password": "supersecret1"})
    r = client.post("/api/v1/auth/login", json={"email": "x@y.com", "password": "wrongpass1"})
    assert r.status_code == 401
