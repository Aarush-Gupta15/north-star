"""Plain-language risk explanations.

The ONLY place the LLM touches the hot path — and even here it's optional. If no
API key is configured (tests, offline dev), we return a deterministic templated
explanation so the feature degrades gracefully and tests stay stable.

We send the LLM only aggregate, non-identifying findings (types + counts), never
the raw PII values — data minimisation applies to our own prompts too.
"""
from __future__ import annotations

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_FRIENDLY = {
    "IN_AADHAAR": "Aadhaar number",
    "IN_PAN": "PAN (tax ID)",
    "IN_PASSPORT": "passport number",
    "CREDIT_CARD": "credit/debit card number",
    "EMAIL_ADDRESS": "email address",
    "PHONE_NUMBER": "phone number",
    "IP_ADDRESS": "IP address",
    "PERSON": "person's name",
    "LOCATION": "address/location",
}


def _friendly(entity_type: str) -> str:
    return _FRIENDLY.get(entity_type, entity_type.replace("_", " ").lower())


def _template_explanation(summary: list[dict], risk_level: str) -> str:
    if not summary:
        return "No personal data was detected in this text."
    parts = [f"{item['count']}× {_friendly(item['type'])}" for item in summary]
    listed = ", ".join(parts)
    return (
        f"This text contains {listed}. Overall privacy risk is **{risk_level}**. "
        "Consider redacting or anonymising these values before sharing or storing them, "
        "and confirm you have a lawful basis (consent or contract) to process them."
    )


def explain_findings(summary: list[dict], risk_level: str) -> str:
    """Return a human-readable explanation. Uses the LLM when configured,
    otherwise a deterministic template."""
    if not settings.ANTHROPIC_API_KEY:
        return _template_explanation(summary, risk_level)

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        types_blob = ", ".join(f"{i['count']}x {i['type']}" for i in summary) or "none"
        msg = client.messages.create(
            model=settings.LLM_MODEL,
            max_tokens=300,
            system=(
                "You are a privacy compliance assistant. Explain detected PII risk in "
                "2-4 plain-language sentences for a non-expert. Reference GDPR/India DPDP "
                "where relevant. Never invent specific personal values."
            ),
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Detected PII (type x count): {types_blob}. "
                        f"Overall risk level: {risk_level}. "
                        "Explain the risk and recommend next steps."
                    ),
                }
            ],
        )
        return "".join(block.text for block in msg.content if block.type == "text").strip()
    except Exception as exc:  # network/key/quota — degrade, never fail the scan
        logger.warning("LLM explanation failed, using template fallback: %s", exc)
        return _template_explanation(summary, risk_level)
