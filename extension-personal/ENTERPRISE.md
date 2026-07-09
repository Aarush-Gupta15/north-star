# North Star — Enterprise / Company Deployment

Two ways a company can decide *what employees must never paste* — so employees
don't have to think about it, and can't accidentally turn protection off.

---

## Option 1 — Shareable policy file (simplest)

Good for small teams; no IT infrastructure needed.

1. One person (an admin) opens the extension **Options** page, builds the rule
   set (or applies a **starter pack**), and clicks **⬇ Export policy** →
   `north-star-policy.json`.
2. Share that file with the team (email, Slack, shared drive).
3. Each teammate opens **Options** → **⬆ Import policy** → picks the file. Done —
   their extension now enforces the company rules (merged with any personal ones).

Example `north-star-policy.json`:

```json
{
  "northStarPolicy": 1,
  "customRules": {
    "terms": ["Project Falcon", "acme-internal.com", "Confidential-2026"],
    "keywords": ["employee id", "salary", "api key", "access token"],
    "regexes": ["EMP\\d{6}", "ACME-[A-Z0-9]{16}"]
  }
}
```

---

## Option 2 — Managed policy pushed by IT (zero-touch, enforced)

Best for real organisations. IT pushes the policy centrally via Chrome's
**managed storage**; it applies to every managed browser automatically, employees
do nothing, and the rules are **locked** (can't be removed by the user). North
Star reads this via `chrome.storage.managed` and merges it with the user's rules.

**How IT deploys it** (once the extension has a Web Store ID):

- **Windows (Group Policy / registry)** or **macOS (configuration profile / MDM
  like Jamf, Intune)**: push the extension's managed configuration with a
  `customRules` object matching `managed_schema.json`.

Example managed configuration (the value IT sets for the extension):

```json
{
  "reportIncidents": true,
  "apiUrl": "https://northstar.yourcompany.com/api/v1",
  "token": "<reporting-access-token>",
  "customRules": {
    "terms": ["Project Falcon", "acme-internal.com"],
    "keywords": ["employee id", "salary", "api key"],
    "regexes": ["EMP\\d{6}", "ACME-[A-Z0-9]{16}"]
  }
}
```

`reportIncidents: true` turns on **incident reporting**: if an employee sends
flagged sensitive data despite the warning, a **masked** incident (metadata + a
last-4 snippet like `card •••• 1111` — never the raw value) is posted to the
company backend. Admins/analysts see them at `GET /incidents` and can download a
weekly digest PDF at `GET /incidents/report.pdf`. Because it's set via managed
policy, employees can't disable it. (Note: for a non-localhost backend, add your
API origin to `host_permissions` in `manifest.json`.)

When active, employees see a **"🏢 Company policy active"** banner in Options,
and those rules are enforced everywhere (type-guard, page scan, popup) — while
still allowing them to add their own personal rules on top.

> The schema IT fills in is declared in `manifest.json` →
> `"storage": { "managed_schema": "managed_schema.json" }`.

---

## What to put in a policy (guidance for non-experts)

If a team doesn't know where to start, apply a **starter pack** in Options and
adjust:

- **General company:** classification labels (`Confidential`, `Internal Use
  Only`), `employee id`, `salary`, `home address`.
- **Software / Dev:** `api key`, `secret key`, `access token`, `db password`, and
  regexes for AWS / GitHub / OpenAI key formats.
- **Finance:** `account number`, `ifsc`, `invoice no`, `gst`.
- **Healthcare:** `patient id`, `mrn`, `diagnosis`, `insurance id`.

Built-in detection (cards, Aadhaar, PAN, passwords, emails, phones, etc.) is
always on regardless of policy.
