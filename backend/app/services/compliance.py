"""GDPR + India DPDP compliance knowledge base.

Maps each detected PII type to the obligations it triggers and a concrete
recommended action. Kept as plain data (not buried in the report renderer) so it
is independently testable and reused by both the PDF report and the upcoming
standalone compliance endpoint.

Citations are deliberately high-level (article / section references) — this is
decision-support, not legal advice. The report carries that disclaimer.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ComplianceRule:
    label: str  # human-friendly name of the data type
    category: str  # "identifier" | "financial" | "contact" | "special" | "technical"
    severity: str  # "low" | "medium" | "high" | "critical"
    gdpr: str  # relevant GDPR reference(s)
    dpdp: str  # relevant India DPDP reference(s)
    recommendation: str


# Default applied to any detected type not explicitly mapped.
_DEFAULT_RULE = ComplianceRule(
    label="Personal data",
    category="identifier",
    severity="medium",
    gdpr="Art. 5 (principles), Art. 6 (lawful basis)",
    dpdp="S. 4 (lawful purpose), S. 6 (consent)",
    recommendation="Confirm a lawful basis and minimise/redact before sharing or storing.",
)

RULES: dict[str, ComplianceRule] = {
    "IN_AADHAAR": ComplianceRule(
        label="Aadhaar number",
        category="identifier",
        severity="critical",
        gdpr="Art. 9 (special category, national ID), Art. 32 (security)",
        dpdp="S. 8 (security safeguards); Aadhaar Act S. 29 (use restrictions)",
        recommendation="Never store in plain text. Mask to last 4 digits, encrypt at rest, "
        "and restrict access. Aadhaar has specific statutory handling rules in India.",
    ),
    "IN_PAN": ComplianceRule(
        label="PAN (tax ID)",
        category="identifier",
        severity="high",
        gdpr="Art. 6 (lawful basis), Art. 32 (security)",
        dpdp="S. 4 (lawful purpose), S. 8 (security safeguards)",
        recommendation="Collect only when tax-required; mask in the UI and encrypt at rest.",
    ),
    "IN_PASSPORT": ComplianceRule(
        label="Passport number",
        category="identifier",
        severity="high",
        gdpr="Art. 9 (national identifier), Art. 32 (security)",
        dpdp="S. 8 (security safeguards)",
        recommendation="Treat as a government identifier; encrypt and limit retention to purpose.",
    ),
    "US_SSN": ComplianceRule(
        label="Social Security Number",
        category="identifier",
        severity="critical",
        gdpr="Art. 87 (national identifiers), Art. 32 (security)",
        dpdp="S. 8 (security safeguards)",
        recommendation="High-value identifier — encrypt, mask, and tightly restrict access.",
    ),
    "CREDIT_CARD": ComplianceRule(
        label="Payment card number",
        category="financial",
        severity="critical",
        gdpr="Art. 32 (security of processing)",
        dpdp="S. 8 (security safeguards)",
        recommendation="Do not store card numbers; tokenise via a PCI-DSS compliant processor.",
    ),
    "IBAN_CODE": ComplianceRule(
        label="Bank account (IBAN)",
        category="financial",
        severity="high",
        gdpr="Art. 32 (security of processing)",
        dpdp="S. 8 (security safeguards)",
        recommendation="Encrypt at rest and restrict access to payment workflows only.",
    ),
    "EMAIL_ADDRESS": ComplianceRule(
        label="Email address",
        category="contact",
        severity="medium",
        gdpr="Art. 6 (lawful basis), Art. 21 (right to object)",
        dpdp="S. 6 (consent), S. 12 (right to erasure)",
        recommendation="Process on a clear lawful basis; honour unsubscribe/erasure requests.",
    ),
    "PHONE_NUMBER": ComplianceRule(
        label="Phone number",
        category="contact",
        severity="medium",
        gdpr="Art. 6 (lawful basis)",
        dpdp="S. 6 (consent)",
        recommendation="Collect with consent; avoid using for purposes beyond the original one.",
    ),
    "PERSON": ComplianceRule(
        label="Person name",
        category="identifier",
        severity="low",
        gdpr="Art. 5 (data minimisation)",
        dpdp="S. 4 (lawful purpose)",
        recommendation="Retain only if necessary for the stated purpose.",
    ),
    "LOCATION": ComplianceRule(
        label="Address / location",
        category="contact",
        severity="medium",
        gdpr="Art. 5 (minimisation), Art. 6 (lawful basis)",
        dpdp="S. 4 (lawful purpose), S. 6 (consent)",
        recommendation="Store at the coarsest granularity that serves the purpose.",
    ),
    "MEDICAL": ComplianceRule(
        label="Medical information",
        category="special",
        severity="critical",
        gdpr="Art. 9 (special category data — explicit consent)",
        dpdp="S. 6 (consent); treated as sensitive",
        recommendation="Requires explicit consent and heightened safeguards; segregate access.",
    ),
    "FINANCIAL": ComplianceRule(
        label="Financial information",
        category="financial",
        severity="high",
        gdpr="Art. 32 (security of processing)",
        dpdp="S. 8 (security safeguards)",
        recommendation="Encrypt at rest and limit access to authorised finance roles.",
    ),
    "IP_ADDRESS": ComplianceRule(
        label="IP address",
        category="technical",
        severity="low",
        gdpr="Art. 4(1) (personal data per Breyer); Recital 30",
        dpdp="S. 4 (lawful purpose)",
        recommendation="Treat as personal data; anonymise/truncate in logs where possible.",
    ),
}


def rule_for(entity_type: str) -> ComplianceRule:
    return RULES.get(entity_type, _DEFAULT_RULE)


def findings_for_types(entity_types: list[str]) -> list[tuple[str, ComplianceRule]]:
    """Return (entity_type, rule) pairs, ordered by severity (critical first)."""
    order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    pairs = [(t, rule_for(t)) for t in entity_types]
    return sorted(pairs, key=lambda p: order.get(p[1].severity, 9))
