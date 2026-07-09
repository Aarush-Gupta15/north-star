# North Star — Go-to-Market & Monetization Plan

_A practical playbook to launch North Star, get exposure, and use it as an
internship-grade portfolio project. Written for a solo student builder, so it's
honest about what's realistic._

---

## 1. Positioning — how to talk about it

Do **not** describe it as "a PII detector." Describe it as the category the
market is actively funding:

> **"DLP for AI — stop employees and users leaking secrets and personal data
> into ChatGPT and other AI tools."**

DLP = Data Loss Prevention. Since 2023, companies have panicked about staff
pasting source code, customer data, and credentials into LLMs (Samsung banned
ChatGPT internally over exactly this). North Star is a consumer-friendly,
privacy-first take on that problem. This framing signals **market awareness**,
which is what separates a "class project" from a "product" in interviews.

**One-liner:** _"Grammarly for privacy — it warns you before you paste sensitive
data into any website or AI chatbot."_

---

## 2. Monetization — the open-core model

You don't need revenue for this to be valuable. But the *model you can describe*
matters, and open-core is the credible one:

| Tier | Who | Price | What |
|------|-----|-------|------|
| **Personal** | Individuals | **Free** (open-source) | Real-time local detection, redaction, all data types |
| **Teams** | Companies using AI tools | Paid (e.g. $4–8/user/mo) | Org-wide policy, the audit **dashboard + PDF reports** you already built, DPDP Act 2023 + DPDP Rules 2025 (& GDPR) mapping, SSO |

Why this works: the free tier drives adoption and word-of-mouth; the paid tier
sells to the *company*, not the user (companies pay for oversight & compliance).
You already have the backend for the paid tier — that's a strong story even if
you never charge a cent yet.

**Honest note:** actually selling B2B security software as a solo student is a
long game (procurement, security reviews, trust). For now, optimise for
**exposure**, not revenue. The paid tier is your "here's how it becomes a
business" answer in interviews.

---

## 3. Launch plan (free, for maximum eyeballs)

**Phase 1 — Ship (week 1)**
- [ ] Publish the extension to the **Chrome Web Store** (see `docs/PUBLISHING.md`).
- [ ] Open-source the repo on **GitHub**, MIT license, polished README with a
      **demo GIF** (record yourself typing a fake password into ChatGPT).
- [ ] Host the landing page (`marketing/index.html`) on **GitHub Pages** (free).
- [ ] Host `extension/PRIVACY_POLICY.md` publicly (needed for the store listing).

**Phase 2 — Launch (week 2)**
- [ ] **Product Hunt** launch (Tue–Thu, early AM PT). Title angle: "Grammarly for
      privacy — stop leaking secrets into ChatGPT."
- [ ] **Show HN** on Hacker News: "Show HN: North Star – warn before you paste
      secrets into AI chatbots (100% local)."
- [ ] Reddit: r/privacy, r/ChatGPT, r/chrome, r/india (Aadhaar/PAN angle), r/webdev.
- [ ] **LinkedIn** post (draft in `RESUME_AND_LINKEDIN.md`) — tag it #privacy #AI.
- [ ] Post the technical blog (below) to **dev.to / Medium / Hashnode**.

**Phase 3 — Depth (week 3+)**
- [ ] Write ONE technical blog post on a genuinely hard part:
      - "How I built Grammarly-style inline underlines inside any text field", or
      - "Local-first PII detection: checksums, false positives, and privacy by design."
      Depth like this is what earns interview callbacks.
- [ ] Collect any install counts / GitHub stars / user quotes → put on the resume.

---

## 4. Assets you have / need

| Asset | Status |
|-------|--------|
| Working extension (v0.2.3) | ✅ built |
| Store-ready ZIP + publishing guide | ✅ built |
| Privacy policy | ✅ built (needs public hosting) |
| Landing page | ✅ `marketing/index.html` |
| Pitch one-pager (PDF) | ✅ `marketing/North-Star-Pitch.pdf` |
| Resume bullets + LinkedIn post | ✅ `marketing/RESUME_AND_LINKEDIN.md` |
| Demo GIF / screenshots | ⬜ **you record** (load extension → type fake data) |
| GitHub repo (public, MIT) | ⬜ **you create** |
| Technical blog post | ⬜ draft together next |

---

## 5. How to talk about it in interviews

When asked "tell me about a project," lead with the **problem and a decision**,
not the feature list:

> "People paste passwords and Aadhaar numbers into ChatGPT without realising the
> risk. I built a Chrome extension that catches it in real time — like Grammarly,
> but for privacy. The interesting engineering problems were (1) highlighting
> inside text fields you can't put markup into — I solved it with an overlay that
> measures each span's on-screen rectangle, and (2) keeping it fully local so the
> privacy tool doesn't itself become a privacy risk. I also built an optional
> FastAPI backend with a compliance dashboard for the team use-case."

That answer shows product thinking, a hard technical decision, and a privacy-by-design
value system — exactly what internships screen for.

---

## 6. The mobile sequel (park for later)

A **separate project, separate title** — e.g. **"North Star Guard — Keyboard."**
An Android input method (IME) that reuses this detection engine to warn as you
type in *any* app. Android is feasible; iOS is heavily restricted for this.
Ship the extension and its launch first; the keyboard is your v2 headline.
