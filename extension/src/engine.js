/*
 * North Star detection engine (browser build).
 *
 * Single source of detection truth inside the extension — loaded by the content
 * script, the input-guard, the popup, and the background worker. Runs entirely
 * locally; no network.
 *
 * Covers a broad catalogue of sensitive data: identity IDs, financial
 * instruments, credentials & secrets, crypto, and network identifiers.
 *
 * Exposed as `NorthStarEngine` on the global (works in window + service worker).
 */
(function (global) {
  "use strict";

  // --- Checksums ---------------------------------------------------------
  const VD = [
    [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],
    [3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],
    [6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],
    [9,8,7,6,5,4,3,2,1,0],
  ];
  const VP = [
    [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],
    [8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],
    [2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
  ];
  function verhoeffValid(s) {
    let c = 0;
    const d = s.replace(/\D/g, "").split("").reverse();
    if (d.length !== 12) return false;
    for (let i = 0; i < d.length; i++) c = VD[c][VP[i % 8][parseInt(d[i], 10)]];
    return c === 0;
  }
  function luhnValid(s) {
    const d = s.replace(/\D/g, "");
    if (d.length < 12 || d.length > 19) return false;
    let sum = 0, parity = d.length % 2;
    for (let i = 0; i < d.length; i++) {
      let n = parseInt(d[i], 10);
      if (i % 2 === parity) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
    }
    return sum % 10 === 0;
  }

  // Heuristic: does this token look like a password / secret? Passwords can't be
  // detected by shape alone, but a mixed-class token (or a long mixed-case+digit
  // one) is very likely a credential and rarely appears in normal prose.
  function looksLikeSecret(t) {
    if (t.length < 6 || t.length > 64) return false;
    if (t.includes("://") || t.indexOf("@") !== -1) return false; // urls / emails / UPI & other @-handles
    const lower = /[a-z]/.test(t), upper = /[A-Z]/.test(t), digit = /\d/.test(t);
    const hasLetter = lower || upper;
    const classes = (lower ? 1 : 0) + (upper ? 1 : 0) + (digit ? 1 : 0) + (/[^A-Za-z0-9]/.test(t) ? 1 : 0);
    // "Secret" symbols — rare in ordinary prose, common in passwords/keys.
    // Deliberately excludes - . _ , / : which appear in normal words, paths, URLs.
    const secretSym = /[#@!$%^&*+=~?]/.test(t);
    if (secretSym && hasLetter && (digit || t.length >= 8)) return true; // symbol-bearing credential
    if (classes >= 4) return true;                                       // upper+lower+digit+symbol
    if (lower && upper && digit && t.length >= 12) return true;          // long mixed-case+digit
    return false;
  }

  // --- Pattern catalogue -------------------------------------------------
  // Order: high-specificity / high-severity first. `group` = capture index to
  // report (for context-gated matches). `validate` = extra check on the value.
  const PATTERNS = [
    // Credentials & secrets
    { type: "PRIVATE_KEY", conf: 0.99, re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g },
    { type: "AWS_ACCESS_KEY", conf: 0.97, re: /\bAKIA[0-9A-Z]{16}\b/g },
    { type: "GITHUB_TOKEN", conf: 0.96, re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
    { type: "GOOGLE_API_KEY", conf: 0.95, re: /\bAIza[0-9A-Za-z_\-]{35}\b/g },
    { type: "SLACK_TOKEN", conf: 0.94, re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g },
    { type: "API_SECRET_KEY", conf: 0.9, re: /\bsk-[A-Za-z0-9]{20,}\b/g },
    { type: "JWT", conf: 0.85, re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
    // Credentials by context — accept "is", "=", ":", "-", or just a space.
    { type: "PASSWORD", conf: 0.9, re: /\b(?:password|passwd|passphrase|pass\s?code|pwd|pass)\b\s*(?:is|was|:|=|->|-)?\s*(\S{4,})/gi, group: 1 },
    { type: "SECRET", conf: 0.9, re: /\b(?:secret|api[\s_-]?key|access[\s_-]?token|client[\s_-]?secret)\b\s*(?:is|:|=|-)?\s*(\S{6,})/gi, group: 1 },
    { type: "OTP", conf: 0.85, re: /\b(?:otp|one[\s-]?time\s?(?:password|code)|verification\s?code)\b\s*(?:is|:|=|-)?\s*(\d{4,8})\b/gi, group: 1 },
    { type: "PIN", conf: 0.8, re: /\b(?:m-?pin|atm\s?pin|pin)\b\s*(?:is|:|=|-)?\s*(\d{3,6})\b/gi, group: 1 },
    // Strong-secret heuristic — a whole token that looks like a password.
    { type: "PASSWORD", conf: 0.72, re: /(?<!\S)\S{6,64}(?!\S)/g, validate: looksLikeSecret },

    // Financial
    { type: "CREDIT_CARD", conf: 0.95, re: /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g, validate: luhnValid },
    { type: "CVV", conf: 0.9, re: /\b(?:cvv|cvc|cvv2)\b\s*[:=-]?\s*(\d{3,4})\b/gi, group: 1 },
    // Bare "cv"/"security code" only counts as CVV when card context is nearby,
    // so a résumé mention like "my CV 2024" doesn't false-trigger.
    { type: "CVV", conf: 0.85, re: /\b(?:credit|debit|atm)[\s-]?card\b[^\n]{0,15}?\b(?:cv|security\s?code)\b\s*[:=-]?\s*(\d{3,4})\b/gi, group: 1 },
    // Context-labelled — if the user *names* the field, trust the label even when
    // the value isn't perfectly formatted / checksum-valid. Higher-severity
    // labels win over a generic phone match via the overlap resolver below.
    { type: "IN_AADHAAR", conf: 0.8, re: /\b(?:aadhaar|aadhar|uidai)\b(?:\s*(?:card|number|no\.?|#))?\s*[:=-]?\s*(\d[\d\s-]{5,17}\d)/gi, group: 1 },
    { type: "IN_PAN", conf: 0.78, re: /\bpan\b(?:\s*(?:card|number|no\.?))?\s*[:=-]?\s*([A-Za-z0-9]{5,12})/gi, group: 1 },
    { type: "CREDIT_CARD", conf: 0.8, re: /\b(?:credit|debit|atm)[\s-]?card\b(?:\s*(?:number|no\.?|#))?\s*[:=-]?\s*(\d[\d\s-]{5,20}\d)/gi, group: 1 },
    { type: "IBAN", conf: 0.85, re: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g },
    { type: "IN_IFSC", conf: 0.8, re: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g },
    { type: "SWIFT_BIC", conf: 0.7, re: /\b(?:swift|bic)\b\s*[:=]?\s*([A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/gi, group: 1 },
    { type: "BANK_ACCOUNT", conf: 0.7, re: /\b(?:a\/c|acct?|account)\s*(?:no\.?|number|#)?\s*[:=]?\s*(\d{9,18})\b/gi, group: 1 },
    { type: "UPI_ID", conf: 0.8, re: /\b[\w.\-]{2,64}@(?:oksbi|okhdfcbank|okicici|okaxis|paytm|ybl|ibl|axl|apl|upi|hdfcbank|sbi)\b/gi },

    // Crypto
    { type: "CRYPTO_ETH", conf: 0.85, re: /\b0x[a-fA-F0-9]{40}\b/g },
    { type: "CRYPTO_BTC", conf: 0.8, re: /\b(?:bc1[a-z0-9]{25,39}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g },

    // Government / national IDs
    { type: "IN_AADHAAR", conf: 0.9, re: /(?<!\d)[2-9]\d{3}\s?\d{4}\s?\d{4}(?!\d)/g, validate: verhoeffValid },
    { type: "IN_PAN", conf: 0.9, re: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
    { type: "IN_GSTIN", conf: 0.85, re: /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/g },
    { type: "IN_VOTER_ID", conf: 0.7, re: /\b[A-Z]{3}[0-9]{7}\b/g },
    { type: "US_SSN", conf: 0.85, re: /\b\d{3}-\d{2}-\d{4}\b/g },
    { type: "IN_PASSPORT", conf: 0.6, re: /\b[A-PR-WYa-pr-wy][0-9]\s?[0-9]{6}\b/g },

    // Contact
    { type: "EMAIL_ADDRESS", conf: 0.95, re: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g },
    { type: "DOB", conf: 0.7, group: 1, re: /\b(?:dob|date\s?of\s?birth|born(?:\s?on)?)\b\s*[:=]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/gi },
    // DOB written with a month name — "14 August 1992" or "August 14, 1992".
    { type: "DOB", conf: 0.7, group: 1, re: /\b(?:dob|date\s?of\s?birth|born(?:\s?on)?)\b\s*[:=]?\s*(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{2,4})/gi },
    // International phone with a leading country code, e.g. "+44 7700 900123".
    { type: "PHONE_NUMBER", conf: 0.78, re: /\+\d[\d\s().\-]{7,16}\d/g, validate: (v) => { const d = v.replace(/\D/g, ""); return d.length >= 8 && d.length <= 15; } },
    { type: "PHONE_NUMBER", conf: 0.6, re: /(?<!\d)(?:\+?\d{1,3}[\s.\-]?)?(?:\(?\d{2,4}\)?[\s.\-]?)?\d{3,4}[\s.\-]?\d{4}(?!\d)/g },
    // UK-style postal code, e.g. "M1 1AA" or "SW1A 1AA".
    { type: "POSTAL_CODE", conf: 0.55, re: /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g },

    // Street / building address (heuristic): numbered units, sectors, and named
    // buildings. Personal data under GDPR / DPDP. Moderate confidence.
    { type: "ADDRESS", conf: 0.62, re: /\b(?:flat|plot|house|door|room|shop|gala|unit|villa)\s*(?:no\.?|number|#)?\s*[:.\-]?\s*\d{1,5}[A-Za-z]?\b/gi },
    { type: "ADDRESS", conf: 0.6, re: /\bsector\s*[-:]?\s*\d{1,3}[A-Za-z]?\b/gi },
    { type: "ADDRESS", conf: 0.55, re: /\b[A-Z][a-z]{2,}\s+(?:Heights|Towers?|Residency|Apartments?|Enclave|Nagar|Colony|Vihar|Puram|Meadows|Gardens?)\b/g },

    // Card expiry — labelled MM/YY or MM/YYYY (e.g. "Expiry: 09/30").
    { type: "CARD_EXPIRY", conf: 0.8, group: 1, re: /\b(?:exp(?:iry|ires|\.)?|valid\s?(?:thru|through|till|until))\b\s*[:=]?\s*(\d{1,2}\s?[\/\-]\s?\d{2,4})/gi },

    // Health / special-category data (GDPR Art. 9 · DPDP sensitive personal data).
    // Context-gated to avoid false alarms (e.g. "allergy-free menu" is excluded).
    { type: "MEDICAL", conf: 0.78, re: /\ballergic\s+to\s+[a-z]+|\b(?:a|an|my|his|her|their|has|have|with|declared|suffers?\s+from)\s+(?:[a-z]+\s+)?allerg(?:y|ies)(?!-)|\bdiagnos(?:ed\s+with|is\s+of|ed|is)\b|\bmedical\s+condition\b|\bblood\s+(?:group|type)\s*[:=]?\s*(?:AB|A|B|O)[+\-]?|\bpregnan(?:t|cy)\b/gi },

    // Organisation identifiers (labelled) — customer / employee IDs
    { type: "EMPLOYEE_ID", conf: 0.8, group: 1, re: /\bemployee\s?(?:id|number|no\.?)\b\s*(?:is|:|=|-)?\s*([A-Za-z]{0,5}-?\d{3,}[A-Za-z0-9-]*)/gi },
    { type: "CUSTOMER_ID", conf: 0.74, group: 1, re: /\bcustomer\s?(?:id|number|no\.?)\b\s*(?:is|:|=|-)?\s*([A-Za-z]{0,5}-?\d{3,}[A-Za-z0-9-]*)/gi },
    // Also match "Employee EMP-55012" / "Customer CUST-100245" (no explicit "ID"
    // label — the value itself carries a recognisable code prefix).
    { type: "EMPLOYEE_ID", conf: 0.78, group: 1, re: /\bemployee\b\s*[:#-]?\s*((?:EMP|EID|EMPID|E)-?\d{3,}[A-Za-z0-9-]*)/gi },
    { type: "CUSTOMER_ID", conf: 0.72, group: 1, re: /\bcustomer\b\s*[:#-]?\s*((?:CUST|CID|CUS|C)-?\d{3,}[A-Za-z0-9-]*)/gi },

    // Network
    { type: "MAC_ADDRESS", conf: 0.6, re: /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g },
    { type: "IP_ADDRESS", conf: 0.8, re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g },
  ];

  // Sensitivity weights (0–1) for the risk score.
  const WEIGHTS = {
    PRIVATE_KEY: 1, AWS_ACCESS_KEY: 1, PASSWORD: 1, SECRET: 1, OTP: 0.95, PIN: 0.9,
    CREDIT_CARD: 1, IN_AADHAAR: 1,
    US_SSN: 1, CVV: 0.95, GITHUB_TOKEN: 0.95, GOOGLE_API_KEY: 0.95, API_SECRET_KEY: 0.95,
    SLACK_TOKEN: 0.9, IN_PAN: 0.9, IN_PASSPORT: 0.9, IBAN: 0.9, IN_GSTIN: 0.8,
    BANK_ACCOUNT: 0.85, CRYPTO_ETH: 0.85, CRYPTO_BTC: 0.85, JWT: 0.85, IN_IFSC: 0.75,
    UPI_ID: 0.8, SWIFT_BIC: 0.7, IN_VOTER_ID: 0.7, DOB: 0.6, PHONE_NUMBER: 0.55,
    EMAIL_ADDRESS: 0.45, MAC_ADDRESS: 0.45, IP_ADDRESS: 0.35,
    MEDICAL: 0.9, EMPLOYEE_ID: 0.6, CUSTOMER_ID: 0.55, POSTAL_CODE: 0.4,
    CARD_EXPIRY: 0.7, ADDRESS: 0.5,
  };
  const FRIENDLY = {
    PRIVATE_KEY: "private key", AWS_ACCESS_KEY: "AWS access key", GITHUB_TOKEN: "GitHub token",
    GOOGLE_API_KEY: "Google API key", SLACK_TOKEN: "Slack token", API_SECRET_KEY: "API secret key",
    JWT: "JWT token", PASSWORD: "password", SECRET: "secret / API key", OTP: "OTP code", PIN: "PIN",
    CREDIT_CARD: "card number", CVV: "card CVV",
    IBAN: "bank account (IBAN)", IN_IFSC: "IFSC code", SWIFT_BIC: "SWIFT/BIC", BANK_ACCOUNT: "bank account no.",
    UPI_ID: "UPI ID", CRYPTO_ETH: "crypto wallet (ETH)", CRYPTO_BTC: "crypto wallet (BTC)",
    IN_AADHAAR: "Aadhaar number", IN_PAN: "PAN (tax ID)", IN_GSTIN: "GSTIN", IN_VOTER_ID: "voter ID",
    US_SSN: "SSN", IN_PASSPORT: "passport number", EMAIL_ADDRESS: "email address", DOB: "date of birth",
    PHONE_NUMBER: "phone number", MAC_ADDRESS: "MAC address", IP_ADDRESS: "IP address",
    MEDICAL: "health data", EMPLOYEE_ID: "employee ID", CUSTOMER_ID: "customer ID", POSTAL_CODE: "postal code",
    CARD_EXPIRY: "card expiry", ADDRESS: "address",
  };

  const weight = (t) => (t.indexOf("CUSTOM") === 0 ? 0.75 : t in WEIGHTS ? WEIGHTS[t] : 0.3);
  const levelFor = (s) => (s >= 80 ? "critical" : s >= 55 ? "high" : s >= 25 ? "medium" : "low");

  // --- Custom, user-defined rules ---------------------------------------
  // Companies/users add their own sensitive terms (employee IDs, internal API
  // key formats, project codenames…) via the Options page. Stored locally and
  // merged into detection here. Nothing leaves the device.
  let customDetectors = [];
  const _escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const _customType = (label) =>
    ("CUSTOM_" + String(label).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24)) || "CUSTOM";

  function setCustomRules(rules) {
    rules = rules || {};
    const dets = [];
    (rules.terms || []).forEach((term) => {
      term = String(term).trim();
      if (term.length < 2) return;
      const type = _customType(term);
      FRIENDLY[type] = term;
      dets.push({ type, conf: 0.95, re: new RegExp("(?<!\\w)" + _escapeRe(term) + "(?!\\w)", "gi") });
    });
    (rules.keywords || []).forEach((kw) => {
      kw = String(kw).trim();
      if (kw.length < 2) return;
      const type = _customType(kw);
      FRIENDLY[type] = kw;
      dets.push({ type, conf: 0.9, group: 1, re: new RegExp("\\b" + _escapeRe(kw) + "\\b\\s*[:=#-]?\\s*(\\S{1,63}[\\w#@])", "gi") });
    });
    (rules.regexes || []).forEach((rx) => {
      rx = String(rx).trim();
      if (!rx) return;
      try {
        const type = _customType("pattern " + rx.slice(0, 12));
        FRIENDLY[type] = "custom pattern";
        dets.push({ type, conf: 0.9, re: new RegExp(rx, "gi") });
      } catch (_) { /* ignore invalid regex */ }
    });
    customDetectors = dets;
  }

  function computeRisk(ents) {
    if (!ents.length) return 0;
    const w = ents.map((e) => weight(e.type) * e.confidence).sort((a, b) => b - a);
    const severity = w[0] * 70;
    const remaining = w.slice(1).reduce((a, b) => a + b, 0);
    const volume = (1 - Math.exp(-remaining)) * 30;
    return Math.round(Math.min(100, severity + volume) * 10) / 10;
  }

  function detect(text) {
    if (!text) return [];
    const ents = [];
    const active = customDetectors.length ? PATTERNS.concat(customDetectors) : PATTERNS;
    for (const p of active) {
      p.re.lastIndex = 0;
      let m;
      while ((m = p.re.exec(text)) !== null) {
        if (m.index === p.re.lastIndex) p.re.lastIndex++; // guard against zero-width
        let val = m[0], idx = m.index;
        if (p.group) {
          val = m[p.group];
          if (val == null) continue;
          idx = m.index + m[0].indexOf(val);
        }
        // Never re-flag our own redaction placeholder.
        if (val.replace(/[^A-Za-z]/g, "") === "REDACTED") continue;
        if (p.validate && !p.validate(val)) continue;
        ents.push({ type: p.type, text: val, start: idx, end: idx + val.length, confidence: p.conf });
      }
    }
    // Resolve overlaps: for any overlapping region keep the highest-severity
    // finding, so "aadhaar card 4327…" is labelled Aadhaar, not phone. We sort by
    // severity (weight × confidence), then longer span, and greedily claim spans.
    ents.sort((a, b) =>
      (weight(b.type) * b.confidence) - (weight(a.type) * a.confidence) ||
      (b.end - b.start) - (a.end - a.start) ||
      a.start - b.start
    );
    const kept = [];
    for (const e of ents) {
      if (kept.some((k) => e.start < k.end && k.start < e.end)) continue; // strict overlap
      kept.push(e);
    }
    return kept.sort((a, b) => a.start - b.start);
  }

  function summarize(ents) {
    const m = {};
    ents.forEach((e) => {
      if (!m[e.type]) m[e.type] = { type: e.type, count: 0, max_confidence: 0 };
      m[e.type].count++;
      m[e.type].max_confidence = Math.max(m[e.type].max_confidence, e.confidence);
    });
    return Object.values(m).sort((a, b) => b.count - a.count);
  }

  function redact(text, ents) {
    let r = text;
    [...ents].sort((a, b) => b.start - a.start).forEach((e) => {
      r = r.slice(0, e.start) + "[" + e.type + "]" + r.slice(e.end);
    });
    return r;
  }

  // Masked preview of a value, e.g. "•••• 1111" — for showing WHAT was typed
  // without echoing the full secret.
  function maskPreview(value) {
    const t = String(value).replace(/\s+/g, " ").trim();
    if (t.length <= 4) return "•".repeat(Math.max(1, t.length));
    return "•".repeat(Math.min(6, t.length - 4)) + t.slice(-4);
  }

  // Mask a value keeping only the last 4 chars (e.g. "•••• 1111"). Emails keep
  // their domain ("a•••@gmail.com"). Used for incident snippets sent to admins.
  function maskValue(type, v) {
    const t = String(v).trim();
    if (type === "EMAIL_ADDRESS") {
      const m = t.match(/^(.).*(@.*)$/);
      return m ? m[1] + "•••" + m[2] : "•••";
    }
    const compact = t.replace(/\s+/g, "");
    if (compact.length <= 4) return "•".repeat(Math.max(1, compact.length));
    return "•••• " + compact.slice(-4);
  }

  // A redacted context snippet: the text with each sensitive value masked to its
  // last 4, capped in length. Safe to send to management — no raw values.
  function redactSnippet(text, ents) {
    ents = ents || detect(text);
    let r = text;
    [...ents].sort((a, b) => b.start - a.start).forEach((e) => {
      r = r.slice(0, e.start) + maskValue(e.type, e.text) + r.slice(e.end);
    });
    r = r.replace(/\s+/g, " ").trim();
    return r.length > 240 ? r.slice(0, 240) + "…" : r;
  }

  function explain(summary, level) {
    if (!summary.length) return "No personal data was detected.";
    const parts = summary.map((i) => i.count + "× " + (FRIENDLY[i.type] || i.type));
    return (
      "This text contains " + parts.join(", ") + ". Overall privacy risk is " +
      level.toUpperCase() + ". Consider redacting these values before sharing or storing them."
    );
  }

  function scan(text) {
    const ents = detect(text);
    const summary = summarize(ents);
    const score = computeRisk(ents);
    const level = levelFor(score);
    return { ents, summary, score, level, redacted: redact(text, ents), explanation: explain(summary, level), chars: (text || "").length };
  }

  // Types that are outright credentials/secrets — warrant a stronger advisory.
  const CREDENTIALS = [
    "PASSWORD", "SECRET", "PRIVATE_KEY", "AWS_ACCESS_KEY", "API_SECRET_KEY",
    "GITHUB_TOKEN", "GOOGLE_API_KEY", "SLACK_TOKEN", "JWT", "OTP", "PIN", "CVV",
  ];
  const hasCredential = (ents) => ents.some((e) => CREDENTIALS.indexOf(e.type) !== -1);

  global.NorthStarEngine = {
    detect, summarize, redact, scan, computeRisk, levelFor, explain, maskPreview,
    maskValue, redactSnippet, verhoeffValid, luhnValid, hasCredential, setCustomRules,
    CREDENTIALS, FRIENDLY, WEIGHTS,
  };

  // In an extension context, load rules from BOTH the company policy (managed
  // storage, pushed by IT — employees can't disable it) and the user's own rules
  // (sync storage), merge them, and keep them live. Guarded so the engine still
  // works in plain pages / tests.
  function _merge(a, b) {
    a = a || {}; b = b || {};
    const u = (x, y) => [...new Set([...(x || []), ...(y || [])])];
    return { terms: u(a.terms, b.terms), keywords: u(a.keywords, b.keywords), regexes: u(a.regexes, b.regexes) };
  }
  function _loadRules() {
    const apply = (managed, user) => setCustomRules(_merge(managed, user));
    const getUser = (managed) =>
      chrome.storage.sync.get(["customRules"], (u) => apply(managed, (u && u.customRules) || {}));
    try {
      if (chrome.storage.managed) {
        chrome.storage.managed.get(["customRules"], (m) => getUser((m && m.customRules) || {}));
      } else {
        getUser({});
      }
    } catch (_) { try { getUser({}); } catch (__) { /* ignore */ } }
  }
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
    try {
      _loadRules();
      chrome.storage.onChanged.addListener((ch) => { if (ch.customRules) _loadRules(); });
    } catch (_) { /* storage unavailable */ }
  }
})(typeof self !== "undefined" ? self : this);
