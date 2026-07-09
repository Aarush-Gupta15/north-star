"""Pure-Python PII detectors: regex patterns + validators.

This module has ZERO third-party dependencies on purpose. It is the source of
truth for every structured PII type and is exhaustively unit-tested in
isolation. The Presidio recognizers in ``recognizers/indian.py`` reuse these
exact patterns/validators, so the behaviour tested here is the behaviour that
runs in production — no drift between the fast path and the framework path.

Each detector returns ``(start, end, matched_text)`` tuples.
"""
from __future__ import annotations

import re
from collections.abc import Callable, Iterator

# --- Validators -------------------------------------------------------------

# Verhoeff multiplication, permutation and inverse tables (used by Aadhaar).
_VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
_VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]


def verhoeff_is_valid(number: str) -> bool:
    """Validate a numeric string against the Verhoeff checksum (Aadhaar uses it)."""
    digits = [int(d) for d in reversed(number) if d.isdigit()]
    c = 0
    for i, item in enumerate(digits):
        c = _VERHOEFF_D[c][_VERHOEFF_P[i % 8][item]]
    return c == 0


def luhn_is_valid(number: str) -> bool:
    """Validate a credit-card-like number with the Luhn checksum."""
    digits = [int(d) for d in number if d.isdigit()]
    if len(digits) < 12:
        return False
    checksum = 0
    parity = len(digits) % 2
    for i, d in enumerate(digits):
        if i % 2 == parity:
            d *= 2
            if d > 9:
                d -= 9
        checksum += d
    return checksum % 10 == 0


# --- Patterns ---------------------------------------------------------------

EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")

# International-ish phone: optional +country, separators, 9-13 digits overall.
PHONE_RE = re.compile(
    r"(?<!\d)(?:\+?\d{1,3}[\s.\-]?)?(?:\(?\d{2,4}\)?[\s.\-]?)?\d{3,4}[\s.\-]?\d{4}(?!\d)"
)

IPV4_RE = re.compile(
    r"\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b"
)

# 13–16 digit card numbers with optional space/dash grouping.
CARD_RE = re.compile(r"(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)")

# India Aadhaar: 12 digits, often grouped 4-4-4, first digit 2–9.
AADHAAR_RE = re.compile(r"(?<!\d)[2-9]\d{3}\s?\d{4}\s?\d{4}(?!\d)")

# India PAN: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).
PAN_RE = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")

# Indian passport: 1 letter + 7 digits (with optional space).
PASSPORT_RE = re.compile(r"\b[A-PR-WYa-pr-wy][0-9]\s?[0-9]{6}\b")


# --- Detector helpers -------------------------------------------------------

Span = tuple[int, int, str]


def _scan(
    text: str,
    regex: re.Pattern[str],
    validator: Callable[[str], bool] | None = None,
) -> Iterator[Span]:
    for m in regex.finditer(text):
        raw = m.group(0)
        if validator is not None and not validator(raw):
            continue
        yield (m.start(), m.end(), raw)


def find_emails(text: str) -> list[Span]:
    return list(_scan(text, EMAIL_RE))


def find_phones(text: str) -> list[Span]:
    return list(_scan(text, PHONE_RE))


def find_ipv4(text: str) -> list[Span]:
    return list(_scan(text, IPV4_RE))


def find_cards(text: str) -> list[Span]:
    return list(_scan(text, CARD_RE, luhn_is_valid))


def find_aadhaar(text: str) -> list[Span]:
    out: list[Span] = []
    for start, end, raw in _scan(text, AADHAAR_RE):
        if verhoeff_is_valid(raw):
            out.append((start, end, raw))
    return out


def find_pan(text: str) -> list[Span]:
    return list(_scan(text, PAN_RE))


def find_passport(text: str) -> list[Span]:
    return list(_scan(text, PASSPORT_RE))
