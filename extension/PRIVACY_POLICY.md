# North Star — Privacy Guard · Privacy Policy

_Last updated: 2026-06-28_

North Star — Privacy Guard ("the extension") is designed around a single
principle: **your data stays on your device.**

## What the extension does

The extension scans text you type, paste, or select on web pages to detect
personally identifiable information (PII) — such as Aadhaar numbers, PAN, credit
card numbers, email addresses, phone numbers, and IP addresses — and warns you
before you share it. **All detection happens locally inside your browser.**

## Data we collect

**None.** The extension does not collect, transmit, sell, or share your personal
data. Specifically:

- We do **not** send the text you type or the pages you visit to any server.
- We do **not** use analytics, tracking, advertising, or fingerprinting.
- We do **not** have a backend that receives your content. Detection runs
  entirely on your device using JavaScript bundled in the extension.

## Optional, user-initiated sync

The extension includes an **optional** feature to sync a *summary* of a scan to a
North Star backend that **you** configure and control (for example, your own
self-hosted instance). This is off unless you explicitly enter an API URL and
access token in the extension's settings and click "Sync."

Even then, only **aggregate metadata** is sent — the *types* and *counts* of PII
detected and a risk score (e.g. "2 email addresses, 1 PAN, risk 72"). The actual
sensitive values and the page text are **never** transmitted.

## Data we store locally

The extension stores your preferences using Chrome's `storage` API (which may
sync across your own Chrome profile via your Google account): your toggle
settings and, if you choose to use sync, the API URL and access token you enter.
This information stays within your browser/Google profile and is never sent to us.

## Permissions and why they are needed

- **Host access to all sites** (via content scripts) — required so the guard can
  watch text fields on whatever page you're typing on. Used only to read field
  text locally for detection; nothing is exfiltrated.
- **`activeTab`** — to know which tab you invoked the popup on.
- **`contextMenus`** — to add the right-click "scan" menu items.
- **`storage`** — to remember your settings.
- **`notifications`** — to show a quick risk notification when you scan a selection.
- **`host_permissions: http://localhost:8000/*`** — only used if you enable the
  optional sync to a local North Star backend you run yourself.

## Regulatory alignment

North Star is built as a data-protection control and is designed to help you meet
your obligations under India's **Digital Personal Data Protection Act, 2023
(DPDP Act)** and the **DPDP Rules, 2025** (notified 14 November 2025), and to
align with the EU **GDPR**. It does this by keeping sensitive personal data on
your device (data minimisation and privacy by design/by default), avoiding
storage of raw personal data, and — in the Organization edition — providing
masked audit trails and PDF digests that support accountability and breach-risk
reduction, including the DPDP Rules' 72-hour breach-reporting window.

North Star is a safeguard that supports compliance; it is **not** legal advice or
a certification, and data-controller / Data Fiduciary responsibilities remain
with you or your organisation.

## Children's privacy

The extension is a general-purpose privacy tool and is not directed at children.

## Changes

If this policy changes, the updated version will be published with the extension
listing and dated above.

## Contact

Questions about this policy: **aarushsre@gmail.com**
