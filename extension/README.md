# North Star — Chrome Extension (Privacy Guard)

**Stops you leaking sensitive data into the web — especially AI chatbots.** As
you type or paste into *any* text box (ChatGPT, Claude, Gemini prompts, chat
apps, forms, comment fields), North Star detects personal data (Aadhaar, PAN,
passport, cards, emails, phones, IPs) in real time and warns you **before you
send it** — with one-click redaction. **All detection runs locally; nothing ever
leaves your browser.**

## What it does

- **⭐ Real-time type-guard (the headline feature)** — watches every editable
  field, including the `contenteditable` editors used by AI chatbots, and warns
  the instant you type/paste PII, with a **Redact in field** button that masks it
  in place. Optional stricter mode blocks Enter/send while PII is present.
- **Full-page scan + inline highlighting** — walks the page, highlights detected
  PII, and shows a floating risk overlay with a 0–100 score.
- **Right-click scanning** — "scan selection" gives a quick risk notification;
  "scan this page" triggers a full scan.
- **Popup** — paste-and-scan box, a "scan this page" button, and page status.
- **Toolbar badge** — PII count on the current tab, colour-coded by risk.
- **Optional dashboard sync** — posts only the findings summary to
  `POST /api/v1/scans/ingest`; raw text never leaves the browser.

## Privacy by design

Detection uses a local JS port of the North Star engine (`src/engine.js`) — the
same detectors and risk model as the backend. Nothing is sent anywhere unless
you explicitly configure a backend URL + token and click **Sync**, and even then
only aggregate metadata is transmitted.

## Install (load unpacked)

1. Open `chrome://extensions` in Chrome.
2. Toggle **Developer mode** (top-right).
3. Click **Load unpacked** and select this `extension/` folder.
4. Pin "North Star — Privacy Guard" from the puzzle-piece menu.

## Connect to the backend (optional)

1. Run the North Star backend (`docker compose up`), sign in, and copy the
   `access_token` returned by the login call.
2. Right-click the extension icon → **Options** (or the ⚙ in the popup).
3. Set **API base URL** (`http://localhost:8000/api/v1`) and paste the **token**.
4. Now the overlay's **Sync to dashboard** button records the scan summary.

> The token is stored in `chrome.storage.sync` (your browser only). The
> `host_permissions` in `manifest.json` is scoped to `http://localhost:8000/*`
> for local dev — add your deployed API origin there for production.

## Layout

```
extension/
├── manifest.json          MV3 manifest
├── src/
│   ├── engine.js          shared local detector + risk model (single source of truth)
│   ├── input-guard.js     ⭐ real-time PII warning for any text box (incl. AI chatbots)
│   ├── content.js         page scan, inline highlight, risk overlay (Shadow DOM)
│   ├── content.css        inline highlight styles
│   ├── background.js      service worker: context menu, badge, backend sync
│   ├── popup.html/.js/.css toolbar popup
│   └── options.html/.js   settings (API URL, token, auto-scan)
└── icons/                 16 / 48 / 128 px
```
