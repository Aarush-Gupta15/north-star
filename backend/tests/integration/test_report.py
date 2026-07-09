"""Integration test: scan → download PDF report through the API."""
from __future__ import annotations

_CREDS = {"email": "rep@example.com", "password": "supersecret1"}


def _auth(client) -> dict[str, str]:
    client.post("/api/v1/auth/register", json=_CREDS)
    token = client.post("/api/v1/auth/login", json=_CREDS).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_download_report_returns_pdf(client):
    headers = _auth(client)
    scan_id = client.post(
        "/api/v1/scans",
        headers=headers,
        json={"text": "ada@example.com card 4111 1111 1111 1111", "explain": False},
    ).json()["id"]

    r = client.get(f"/api/v1/scans/{scan_id}/report", headers=headers)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:5] == b"%PDF-"
    assert "attachment" in r.headers.get("content-disposition", "")


_MISSING = "/api/v1/scans/00000000-0000-0000-0000-000000000000/report"


def test_report_requires_auth(client):
    assert client.get(_MISSING).status_code == 401


def test_report_404_for_unknown_scan(client):
    headers = _auth(client)
    r = client.get(_MISSING, headers=headers)
    assert r.status_code == 404
