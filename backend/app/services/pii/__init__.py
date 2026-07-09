"""PII detection engine — a framework-free package.

Importable and testable without a database or web server. ``PiiEngine`` is the
public entry point; everything else here supports it.
"""
from app.services.pii.engine import PiiEngine, get_engine

__all__ = ["PiiEngine", "get_engine"]
