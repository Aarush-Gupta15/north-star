# Publishing & Testing the North Star Chrome Extension

This guide covers (A) testing the extension across real sites **right now** with
no store account, and (B) publishing it to the Chrome Web Store so anyone can
install it.

---

## A. Test it on ChatGPT, WhatsApp Web, Gmail, etc. (no store needed)

The extension works on **any website in Chrome** the moment you load it. It does
**not** need to be published first.

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `extension/` folder.
4. Pin "North Star — Privacy Guard" (puzzle-piece icon → pin).
5. Now visit any of these and type a **test** Aadhaar (`2341 2345 6783`) or card
   (`4111 1111 1111 1111`) into the message box:
   - **ChatGPT** — https://chatgpt.com
   - **Claude** — https://claude.ai
   - **Gemini** — https://gemini.google.com
   - **WhatsApp Web** — https://web.whatsapp.com
   - **Gmail** compose, LinkedIn messages, X/Twitter, any form.
   The warning tooltip appears on the field, with a **Redact in field** button.

> After editing any extension file, return to `chrome://extensions` and click the
> **↻ reload** icon on the card.

### What it does and does NOT cover
- ✅ **Web apps in Chrome** — ChatGPT, Claude, Gemini, WhatsApp **Web**, Gmail, etc.
- ❌ **Native desktop/phone apps** — the WhatsApp phone app or the ChatGPT mobile
  app. A browser extension can only run inside the browser. Covering native apps
  would require a separate OS-level product, which is out of scope for a Chrome
  extension.

---

## B. Publish to the Chrome Web Store

> **You must do this part** — it needs your Google account, a one-time **$5**
> developer fee, and passing Google's review. Everything you need to paste/upload
> is prepared below and in the repo.

### 1. Create a developer account
- Go to the **Chrome Web Store Developer Dashboard**:
  https://chrome.google.com/webstore/devconsole
- Sign in and pay the one-time **$5** registration fee.

### 2. Upload the package
- Use the ready ZIP: **`north-star-privacy-guard-v0.3.0.zip`** (in the project
  root). Or re-zip the `extension/` folder's **contents** (manifest at the top
  level of the zip, not inside a subfolder).
- In the dashboard: **Add new item** → upload the ZIP.

### 3. Fill in the store listing (copy below)

**Name:** North Star — Privacy Guard

**Summary (≤132 chars):**
> Warns you before you type or paste sensitive data (Aadhaar, PAN, cards…) into any text box, including AI chatbots. 100% local.

**Category:** Productivity  ·  **Language:** English

**Description:**
> North Star — Privacy Guard protects you from accidentally leaking sensitive
> personal information into websites and AI chatbots.
>
> As you type or paste into ANY text box — ChatGPT, Claude, Gemini, WhatsApp Web,
> Gmail, forms, comment fields — North Star instantly detects personal data and
> warns you BEFORE you send it, with one click to redact it in place.
>
> Detects: Aadhaar (with checksum), PAN, passport, credit/debit cards (Luhn),
> email addresses, phone numbers, and IP addresses.
>
> 🔒 100% private: all detection runs locally in your browser. Your text is never
> sent anywhere. No accounts, no tracking, no servers.
>
> Features:
> • Real-time warning as you type, in any field (including AI chatbot editors)
> • One-click redaction
> • Optional whole-page scan with inline highlighting and a risk score
> • Right-click "scan selection"
> • Optional stricter mode that blocks send while sensitive data is present

**Privacy policy URL:** host `extension/PRIVACY_POLICY.md` somewhere public
(e.g. a GitHub repo or GitHub Pages) and paste that URL. Google requires a
reachable privacy policy link.

### 4. Privacy practices tab (this is where most submissions get stuck)

- **Single purpose (paste):**
  > Detect personally identifiable information in text the user types, pastes, or
  > selects on web pages, and warn them before they share it. All processing is
  > local.

- **Permission justifications:**
  | Permission | Justification |
  |---|---|
  | Host access / content scripts on all sites | Needed to read text in the field the user is typing into, on whatever site they use, to detect PII locally. No data leaves the device. |
  | `activeTab` | Identify the tab the user invokes the popup on. |
  | `contextMenus` | Provide right-click "scan selection / scan page" actions. |
  | `storage` | Save the user's on/off preferences (and, if they opt in, their own API URL/token). |
  | `notifications` | Show a quick risk notification for a scanned selection. |
  | `host_permissions: http://localhost:8000/*` | Only used if the user opts in to sync scan summaries to a North Star backend they run themselves. **For a public release you may remove this** (see note). |

- **Data usage disclosures:** check that the extension does **NOT** collect or
  transmit user data. (This is true — see `PRIVACY_POLICY.md`.) Declaring broad
  host access with *no* data collection is allowed and reviewers accept it when
  the single purpose justifies it.

### 5. Assets you'll need to attach
- **Store icon:** 128×128 (already in `extension/icons/icon128.png`).
- **At least one screenshot:** 1280×800 or 640×400. Easiest: load the extension
  (Part A), trigger the warning on a page, and take a screenshot.
- **(Optional) small promo tile:** 440×280.

### 6. Submit for review
- Click **Submit for review**. First reviews typically take a few days (can be
  longer for broad-host-permission extensions). You'll get email updates.

---

## Note for a clean public release

The optional backend-sync feature points at `http://localhost:8000`, which only
works for people running their own North Star backend. For a purely public
consumer release you can simplify the review by **removing** the sync feature:
delete `host_permissions` from `manifest.json` and the "sync" code paths in
`background.js` / `content.js`. Tell me and I'll produce that trimmed build.
