# North Star — Privacy Guard (Personal)

**Stops you leaking sensitive data into websites and AI chatbots.** As you type
or paste into any text box (ChatGPT, Claude, Gemini, WhatsApp Web, Gmail, forms),
North Star detects personal data — Aadhaar, PAN, cards, passwords, API keys,
emails, phones, and more — and warns you **before you send it**, with one-click
redaction.

**100% local. No account. No servers. Nothing ever leaves your browser.**

This is the **Personal edition** — free and fully offline. (An Organization
edition adds company-managed policy, incident reporting, and an admin dashboard.)

## Features
- ⭐ Real-time "type-guard" — inline warnings as you type, in any field.
- One-click **Redact**.
- Whole-page scan + right-click scan.
- 28+ built-in data types, with checksum validation to cut false alarms.
- Your own **custom rules** (words / keywords / regex) + starter packs + import/export.
- **Per-rule action** — for each rule, choose **Highlight** (just warn me) or
  **Mask & redact** (auto-hide the value). Marked values are stripped
  automatically before your message can leave the field.
- **Turn off per site** — switch North Star off on sites you choose (e.g.
  youtube.com) from the toolbar popup or the options list. Subdomains included.

## Install (load unpacked)
1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Pin it, then start typing on any site.

## Layout
```
manifest.json          MV3 manifest (local-only permissions)
src/engine.js          the local detector + risk model
src/input-guard.js     real-time type-guard
src/content.js         page scan + inline highlight + redact
src/background.js       context menu + toolbar badge
src/popup.*  src/options.*   toolbar UI + settings (custom rules)
icons/                 16 / 48 / 128 px
```
