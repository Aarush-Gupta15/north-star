/*
 * Content script: scans the page for PII, highlights it inline, and renders a
 * floating risk overlay. All detection is local (NorthStarEngine). Only an
 * aggregate summary is ever sent to the background worker (and, optionally,
 * synced to the backend) — raw text never leaves the page.
 */
(function () {
  "use strict";
  const NS = window.NorthStarEngine;
  if (!NS) return;

  const OVERLAY_ID = "ns-overlay-host";
  const MARK_CLASS = "ns-pii";
  const MAX_ENTITIES = 1500; // safety cap for huge pages

  const state = { entities: [], summary: [], score: 0, level: "low", marks: [], scanned: false };
  let settings = { autoScan: true, apiUrl: "", token: "" };
  let pageDisabled = false; // North Star switched off for this whole site

  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"]);

  // --- Scanning ----------------------------------------------------------
  function acceptNode(node) {
    const p = node.parentElement;
    if (!p) return NodeFilter.FILTER_REJECT;
    if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
    if (p.closest(`.${MARK_CLASS}, #${OVERLAY_ID}`)) return NodeFilter.FILTER_REJECT;
    const v = node.nodeValue;
    if (!v || !v.trim() || v.length > 5000) return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT;
  }

  function highlightNode(node, ents) {
    const text = node.nodeValue;
    const frag = document.createDocumentFragment();
    let cursor = 0;
    for (const e of ents) {
      if (e.start < cursor) continue; // skip overlaps
      if (e.start > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, e.start)));
      const mark = document.createElement("mark");
      mark.className = MARK_CLASS;
      mark.dataset.type = e.type;
      mark.title = `${e.type} — detected by North Star`;
      mark.textContent = text.slice(e.start, e.end);
      frag.appendChild(mark);
      state.marks.push(mark);
      cursor = e.end;
    }
    if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
    node.parentNode.replaceChild(frag, node);
  }

  function clearHighlights() {
    for (const mark of state.marks) {
      if (mark.parentNode) {
        mark.replaceWith(document.createTextNode(mark.textContent));
        // merge adjacent text nodes
      }
    }
    state.marks = [];
    document.body && document.body.normalize();
  }

  // Build ONE concatenated string from all scannable text nodes (with a space
  // separator so words in adjacent nodes stay separate), remembering where each
  // node lives. Detecting on the whole string lets context-based rules (bank
  // account, password, etc.) work even when editors split text across nodes.
  function buildTextMap() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode });
    const nodes = [];
    let text = "";
    let n;
    while ((n = walker.nextNode())) {
      if (text) text += " ";
      const v = n.nodeValue;
      nodes.push({ node: n, start: text.length, end: text.length + v.length });
      text += v;
      if (text.length > 200000) break;
    }
    return { text, nodes };
  }

  function scanPage() {
    if (pageDisabled) { clearHighlights(); document.getElementById(OVERLAY_ID)?.remove(); return; }
    clearHighlights();
    const map = buildTextMap();
    const ents = NS.detect(map.text).slice(0, MAX_ENTITIES);

    // Group findings by the text node their value starts in, then highlight.
    const byNode = new Map();
    for (const e of ents) {
      const ni = map.nodes.find((x) => e.start >= x.start && e.start < x.end);
      if (!ni) continue;
      // Don't rewrite the DOM inside a live editor (contenteditable) — it can
      // disrupt editors like ChatGPT's. Still counted; the type-guard underlines
      // those live instead.
      if (ni.node.parentElement && ni.node.parentElement.isContentEditable) continue;
      const ls = e.start - ni.start;
      const le = Math.min(e.end - ni.start, ni.node.nodeValue.length);
      if (le <= ls) continue;
      if (!byNode.has(ni.node)) byNode.set(ni.node, []);
      byNode.get(ni.node).push({ type: e.type, start: ls, end: le });
    }
    for (const [node, list] of byNode) highlightNode(node, list.sort((a, b) => a.start - b.start));

    // Also scan the values of form fields (textarea/input) — their text isn't in
    // the DOM as nodes, so it wouldn't be counted otherwise. (Highlighting inside
    // native fields isn't possible; the type-guard underlines those live.)
    let all = ents.map((e) => ({ type: e.type, confidence: e.confidence }));
    document.querySelectorAll("textarea, input").forEach((el) => {
      const t = (el.type || "text").toLowerCase();
      if (/password|hidden|file|checkbox|radio|button|submit|range|color/.test(t)) return;
      if (el.value) all = all.concat(NS.detect(el.value).map((e) => ({ type: e.type, confidence: e.confidence })));
    });

    state.entities = all;
    state.summary = NS.summarize(all);
    state.score = NS.computeRisk(all);
    state.level = NS.levelFor(state.score);
    state.scanned = true;

    renderOverlay();
    chrome.runtime.sendMessage({
      type: "scanResult",
      payload: { summary: state.summary, score: state.score, level: state.level, count: all.length },
    });
  }

  // --- Overlay (Shadow DOM, isolated from page CSS) ----------------------
  function ensureHost() {
    let host = document.getElementById(OVERLAY_ID);
    if (host) return host.shadowRoot;
    host = document.createElement("div");
    host.id = OVERLAY_ID;
    document.documentElement.appendChild(host);
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${OVERLAY_CSS}</style><div class="panel"></div>`;
    return root;
  }

  function renderOverlay() {
    const root = ensureHost();
    const panel = root.querySelector(".panel");
    const chips = state.summary.map((s) => `<span class="chip">${s.type} <b>×${s.count}</b></span>`).join("");
    const synced = settings.apiUrl && settings.token;
    panel.innerHTML = `
      <div class="hd">
        <div class="brand"><span class="dot lvl-${state.level}"></span> North Star</div>
        <button class="x" data-act="close" title="Dismiss">✕</button>
      </div>
      <div class="score">
        <div><div class="num">${state.score}</div><div class="cap">risk / 100</div></div>
        <span class="badge lvl-${state.level}">${state.level}</span>
      </div>
      <div class="count">${state.entities.length} PII item(s) found and highlighted</div>
      ${chips ? `<div class="chips">${chips}</div>` : `<div class="ok">No personal data detected ✔</div>`}
      ${state.entities.length ? `<button data-act="redact" class="primary full">✨ Redact all — clean the text now</button>` : ""}
      <div class="actions">
        <button data-act="rescan" class="ghost">Re-scan</button>
        <button data-act="clear" class="ghost">Clear</button>
        
      </div>
      <div class="foot" data-status></div>`;
    panel.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => onAction(b.dataset.act)));
  }

  function setStatus(msg) {
    const root = document.getElementById(OVERLAY_ID)?.shadowRoot;
    const el = root && root.querySelector("[data-status]");
    if (el) el.textContent = msg;
  }

  // Replace every detected value in every editable field with [REDACTED] — the
  // Grammarly-style "fix it for me" action. Works on contenteditable editors
  // (ChatGPT/Claude/Gemini) and native input/textarea fields.
  function maskText(text) {
    let r = text;
    [...NS.detect(text)].sort((a, b) => b.start - a.start).forEach((e) => {
      r = r.slice(0, e.start) + "[REDACTED]" + r.slice(e.end);
    });
    return r;
  }

  function redactAllFields() {
    let changed = 0;
    document.querySelectorAll('[contenteditable="true"], [contenteditable=""]').forEach((el) => {
      if (!el.isContentEditable) return;
      const text = el.innerText || "";
      if (!NS.detect(text).length) return;
      const masked = maskText(text);
      if (masked === text) return;
      el.focus();
      // Preferred path: select all + insertText so rich editors (ProseMirror/
      // Lexical used by ChatGPT/Claude) apply it through their own input pipeline
      // and stay in sync. Fall back to a direct rewrite if that's unavailable.
      let ok = false;
      try {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);
        ok = document.execCommand("insertText", false, masked);
      } catch (_) { ok = false; }
      if (!ok) {
        el.textContent = masked;
        el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: masked }));
      }
      changed++;
    });
    document.querySelectorAll("textarea, input").forEach((el) => {
      const t = (el.type || "text").toLowerCase();
      if (/password|hidden|file|checkbox|radio|button|submit|range|color/.test(t)) return;
      const v = el.value || "";
      if (!NS.detect(v).length) return;
      const masked = maskText(v);
      if (masked !== v) {
        const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(el, masked);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        changed++;
      }
    });
    return changed;
  }

  function onAction(act) {
    if (act === "close") document.getElementById(OVERLAY_ID)?.remove();
    else if (act === "rescan") scanPage();
    else if (act === "clear") { clearHighlights(); document.getElementById(OVERLAY_ID)?.remove(); }
    else if (act === "redact") {
      const n = redactAllFields();
      clearHighlights();
      setStatus(n ? `✔ Cleaned sensitive data in ${n} field(s).` : "No editable field to clean here.");
      setTimeout(scanPage, 200); // refresh the card after the edit settles
    }
    else if (act === "sync") {
      if (!settings.apiUrl || !settings.token) {
        setStatus("Set the API URL + token in extension options first.");
        chrome.runtime.sendMessage({ type: "openOptions" });
        return;
      }
      setStatus("Syncing summary…");
      chrome.runtime.sendMessage(
        {
          type: "sync",
          payload: {
            source_type: "extension",
            char_count: (document.body.innerText || "").length,
            risk_score: state.score,
            risk_level: state.level,
            entity_count: state.entities.length,
            findings_summary: state.summary,
          },
        },
        (res) => setStatus(res && res.ok ? "Synced ✔ (summary only — no page text sent)" : `Sync failed: ${res ? res.error : "unknown"}`)
      );
    }
  }

  // --- Messaging + boot --------------------------------------------------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "scanPage") { scanPage(); sendResponse({ ok: true }); }
    else if (msg.type === "clearHighlights") { clearHighlights(); document.getElementById(OVERLAY_ID)?.remove(); sendResponse({ ok: true }); }
    else if (msg.type === "getState") {
      sendResponse({ scanned: state.scanned, summary: state.summary, score: state.score, level: state.level, count: state.entities.length });
    }
    return true;
  });

  chrome.storage.sync.get(["autoScan", "apiUrl", "token", "disabledSites"], (cfg) => {
    settings = { autoScan: cfg.autoScan !== false, apiUrl: cfg.apiUrl || "", token: cfg.token || "" };
    pageDisabled = NS.hostIsDisabled(location.hostname, cfg.disabledSites || []);
    if (!pageDisabled && settings.autoScan && document.body) {
      // Defer so the page settles; avoids fighting late-rendering content.
      setTimeout(scanPage, 800);
    }
  });

  // React to the user toggling this site on/off from the popup or options.
  chrome.storage.onChanged.addListener((c) => {
    if (!c.disabledSites) return;
    pageDisabled = NS.hostIsDisabled(location.hostname, c.disabledSites.newValue || []);
    if (pageDisabled) { clearHighlights(); document.getElementById(OVERLAY_ID)?.remove(); }
  });

  const OVERLAY_CSS = `
    :host { all: initial; }
    .panel {
      position: fixed; bottom: 16px; right: 16px; width: 280px; z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #12151c; color: #e6e9ef; border: 1px solid #232936; border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,.5); padding: 14px; font-size: 13px; line-height: 1.4;
    }
    .hd { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .brand { font-weight: 700; display: flex; align-items: center; gap: 7px; }
    .dot { width: 9px; height: 9px; border-radius: 50%; }
    .x { background: transparent; border: none; color: #9aa4b2; cursor: pointer; font-size: 13px; }
    .score { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .num { font-size: 30px; font-weight: 800; line-height: 1; }
    .cap { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: .07em; }
    .badge { padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .count { color: #9aa4b2; font-size: 12px; margin-bottom: 8px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .chip { font-family: ui-monospace, Menlo, monospace; font-size: 11px; padding: 3px 7px; border-radius: 6px; background: #181c25; border: 1px solid #232936; color: #9aa4b2; }
    .chip b { color: #e6e9ef; }
    .ok { color: #22c55e; margin-bottom: 10px; }
    .actions { display: flex; gap: 6px; }
    .actions button { flex: 1; border: none; border-radius: 7px; padding: 7px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .ghost { background: transparent; border: 1px solid #232936 !important; color: #9aa4b2; }
    .primary { background: #6366f1; color: #fff; border: none; border-radius: 7px; font-weight: 700; cursor: pointer; }
    .full { width: 100%; padding: 9px; font-size: 13px; margin-bottom: 8px; }
    .foot { color: #6b7280; font-size: 11px; margin-top: 8px; min-height: 14px; }
    .lvl-low { background: #22c55e; color: #fff; } .badge.lvl-low { color: #22c55e; background: rgba(34,197,94,.15); }
    .lvl-medium { background: #eab308; } .badge.lvl-medium { color: #eab308; background: rgba(234,179,8,.15); }
    .lvl-high { background: #f97316; } .badge.lvl-high { color: #f97316; background: rgba(249,115,22,.15); }
    .lvl-critical { background: #ef4444; } .badge.lvl-critical { color: #ef4444; background: rgba(239,68,68,.15); }
  `;
})();
