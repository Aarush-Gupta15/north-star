"""Unit tests for the pure-Python detectors and validators.

These need no database, network, or spaCy model — they test the deterministic
core that everything else relies on.
"""
from __future__ import annotations

from app.services.pii import patterns


def test_verhoeff_validates_known_good_and_rejects_bad():
    # 234123456783 carries a valid Verhoeff check digit; altering it must fail.
    assert patterns.verhoeff_is_valid("234123456783") is True
    assert patterns.verhoeff_is_valid("234123456784") is False


def test_luhn_accepts_test_visa_and_rejects_random():
    assert patterns.luhn_is_valid("4111111111111111") is True
    assert patterns.luhn_is_valid("1234567812345678") is False


def test_find_emails():
    spans = patterns.find_emails("ping me at ada@example.co.uk please")
    assert [s[2] for s in spans] == ["ada@example.co.uk"]


def test_find_aadhaar_requires_valid_checksum():
    valid = patterns.find_aadhaar("Aadhaar 2341 2345 6783 on file")
    assert valid and valid[0][2].replace(" ", "") == "234123456783"
    # Wrong checksum → not reported.
    assert patterns.find_aadhaar("Aadhaar 2341 2345 6784") == []


def test_find_pan_format():
    spans = patterns.find_pan("PAN ABCDE1234F issued")
    assert [s[2] for s in spans] == ["ABCDE1234F"]


def test_find_cards_uses_luhn():
    assert patterns.find_cards("card 4111 1111 1111 1111") != []
    assert patterns.find_cards("card 4111 1111 1111 1112") == []


def test_find_ipv4():
    spans = patterns.find_ipv4("host 192.168.1.42 down; 999.1.1.1 ignored")
    assert [s[2] for s in spans] == ["192.168.1.42"]
