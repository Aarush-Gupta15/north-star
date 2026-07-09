/*
 * Real-time type-guard — the signature feature (Grammarly-style).
 *
 * As you type or paste into ANY field (inputs, textareas, and the
 * `contenteditable` editors used by ChatGPT / Claude / Gemini), sensitive data
 * is detected locally and UNDERLINED inline, live, right where you typed it —
 * updating continuously as you keep typing. A persistent badge in the field's
 * corner lists exactly what was caught (with masked previews) and offers a
 * one-click "Redact all". Nothing ever leaves the browser.
 *
 * Underlines are painted via an overlay: we measure each detected span's
 * on-screen rectangle (a mirror element for inputs/textareas, Range rects for
 * contenteditable) and draw an underline over it. This is how you highlight
 * inside a field you can't put markup into.
 */
(function () {
  "use strict";
  const NS = window.NorthStarEngine;
  if (!NS) return;

  const HOST_ID = "ns-guard-host";
  const DEBOUNCE_MS = 130;
  const MAX_LEN = 20000;

  let settings = { typeGuard: true, blockSend: false };
  let pageDisabled = false; // North Star switched off for this whole site
  let active = null;      // the field currently being guarded
  let lastEnts = [];
  let lastCtx = null;
  let debounce = null;
  let raf = null;
  let popOpen = false;
  let interacting = false; // true briefly while the user is clicking our badge/pop
  let toastTimer = null;

  // A single guard used everywhere: don't do anything on a disabled site or when
  // the type-guard is switched off.
  const guardOff = () => pageDisabled || !settings.typeGuard;

  chrome.storage.sync.get(["typeGuard", "blockSend", "disabledSites"], (cfg) => {
    settings.typeGuard = cfg.typeGuard !== false;
    settings.blockSend = cfg.blockSend === true;
    pageDisabled = NS.hostIsDisabled(location.hostname, cfg.disabledSites || []);
  });
  chrome.storage.onChanged.addListener((c) => {
    if (c.typeGuard) settings.typeGuard = c.typeGuard.newValue !== false;
    if (c.blockSend) settings.blockSend = c.blockSend.newValue === true;
    if (c.disabledSites) pageDisabled = NS.hostIsDisabled(location.hostname, c.disabledSites.newValue || []);
    if (guardOff()) clearVisuals();
  });

  // --- Field detection ---------------------------------------------------
  const SCANNABLE_INPUT = /^(text|search|email|tel|url|number|)$/i;
  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName === "INPUT") return SCANNABLE_INPUT.test(el.type || "text");
    return !!el.isContentEditable;
  }
  function getContext(el) {
    if (el.isContentEditable) {
      const map = buildTextMap(el);
      return { text: map.text, map };
    }
    return { text: el.value || "", map: null };
  }

  // --- Events ------------------------------------------------------------
  document.addEventListener("input", (e) => {
    if (guardOff() || !isEditable(e.target)) return;
    active = e.target;
    clearTimeout(debounce);
    debounce = setTimeout(() => refresh(active), DEBOUNCE_MS);
  }, true);

  document.addEventListener("focusin", (e) => {
    if (!guardOff() && isEditable(e.target)) { active = e.target; refresh(active); }
  }, true);

  // Defer clearing on blur and re-check: a click on our own badge/popover keeps
  // the field focused (see host() mousedown handler), so this fires only on a
  // genuine focus change. The timeout lets that settle before we decide.
  document.addEventListener("focusout", (e) => {
    if (e.target !== active) return;
    setTimeout(() => {
      if (document.activeElement === active || popOpen || interacting) return;
      clearVisuals();
    }, 140);
  }, true);

  // Close the popover when the user clicks anywhere outside our UI.
  document.addEventListener("mousedown", (e) => {
    if (!popOpen) return;
    const h = document.getElementById(HOST_ID);
    const path = e.composedPath ? e.composedPath() : [];
    if (h && path.indexOf(h) !== -1) return; // click landed inside our badge/popover
    popOpen = false;
    const root = h && h.shadowRoot;
    if (root) root.querySelector(".pop").hidden = true;
  }, true);

  const onScrollResize = () => schedule(() => active && repaint());
  window.addEventListener("scroll", onScrollResize, true);
  window.addEventListener("resize", onScrollResize, true);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    if (guardOff()) return;
    const el = e.target;
    if (!isEditable(el)) return;
    const text = getContext(el).text.slice(0, MAX_LEN);
    const ents = NS.detect(text);
    if (!ents.length) return;
    // Report the incident (background decides if company reporting is on).
    reportIncident(text, ents);
    // Auto-redact anything you marked "mask & redact" — strip it before the
    // message can leave the field, then hold this Enter so you can review + resend.
    if (ents.some((x) => NS.actionFor(x) === "redact")) {
      e.preventDefault();
      e.stopPropagation();
      autoRedactMarked(el);
      flashBadge();
      return;
    }
    // Optionally block the send while any sensitive data is still present.
    if (settings.blockSend) { e.preventDefault(); e.stopPropagation(); refresh(el); flashBadge(); }
  }, true);

  function reportIncident(text, ents) {
    try {
      const score = NS.computeRisk(ents);
      chrome.runtime.sendMessage({
        type: "incident",
        payload: {
          site: location.hostname,
          action: settings.blockSend ? "blocked" : "sent",
          risk_score: score,
          risk_level: NS.levelFor(score),
          entity_count: ents.length,
          findings_summary: NS.summarize(ents),
          masked_snippet: NS.redactSnippet(text, ents),
        },
      });
    } catch (_) { /* background may be asleep; best-effort */ }
  }

  function schedule(fn) { cancelAnimationFrame(raf); raf = requestAnimationFrame(fn); }

  // --- Core --------------------------------------------------------------
  function refresh(el) {
    if (guardOff()) return clearVisuals();
    if (!el || !isEditable(el)) return;
    lastCtx = getContext(el);
    lastEnts = NS.detect(lastCtx.text.slice(0, MAX_LEN));
    if (!lastEnts.length) return clearVisuals();
    repaint();
  }

  function repaint() {
    if (!active || !lastEnts.length) return clearVisuals();
    const fieldRect = active.getBoundingClientRect();
    const root = host();
    const ul = root.querySelector(".underlines");
    ul.innerHTML = "";
    for (const e of lastEnts) {
      const color = NS.actionFor(e) === "redact" ? REDACT_COLOR : severe(e.type);
      for (const r of spanRects(active, e.start, e.end, lastCtx)) {
        if (r.width < 1 || r.height < 1) continue;
        // Clip to the visible field box so underlines don't bleed outside a scrolled field.
        if (r.top < fieldRect.top - 2 || r.top + r.height > fieldRect.bottom + 2) continue;
        if (r.left < fieldRect.left - 2 || r.left > fieldRect.right + 2) continue;
        const d = document.createElement("div");
        d.className = "ul";
        d.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;--c:${color}`;
        ul.appendChild(d);
      }
    }
    paintBadge(fieldRect);
  }

  function clearVisuals() {
    const root = document.getElementById(HOST_ID)?.shadowRoot;
    if (!root) return;
    root.querySelector(".underlines").innerHTML = "";
    root.querySelector(".badge").hidden = true;
    root.querySelector(".pop").hidden = true;
    popOpen = false;
  }

  // --- Badge + popover ---------------------------------------------------
  function paintBadge(fieldRect) {
    const root = host();
    const badge = root.querySelector(".badge");
    const level = NS.levelFor(NS.computeRisk(lastEnts));
    badge.style.setProperty("--c", LEVEL[level]);
    badge.textContent = `⚠ ${lastEnts.length}`;
    badge.hidden = false;
    // measure then place at the field's bottom-right corner
    requestAnimationFrame(() => {
      const bw = badge.offsetWidth || 34, bh = badge.offsetHeight || 20;
      badge.style.left = Math.max(6, Math.min(fieldRect.right - bw - 6, window.innerWidth - bw - 6)) + "px";
      badge.style.top = Math.max(6, fieldRect.bottom - bh - 6) + "px";
      if (popOpen) positionPop(badge);
    });
    badge.onclick = () => {
      popOpen = !popOpen;
      if (popOpen) {
        openPop(badge);
        flashBadge();
        toast("Reviewing " + lastEnts.length + " sensitive item" + (lastEnts.length === 1 ? "" : "s"));
      } else {
        root.querySelector(".pop").hidden = true;
      }
    };
  }

  function openPop(badge) {
    const root = host();
    const pop = root.querySelector(".pop");

    const redactEnts = lastEnts.filter((e) => NS.actionFor(e) === "redact");
    const warnEnts = lastEnts.filter((e) => NS.actionFor(e) !== "redact");
    const rowFor = (e) =>
      `<div class="it"><span class="t">${label(e.type)}</span><span class="v">${NS.maskPreview(e.text)}</span></div>`;

    const redactBlock = redactEnts.length
      ? `<div class="grp rd"><div class="gh">🟣 Auto-redacted on send</div>${redactEnts.slice(0, 8).map(rowFor).join("")}${redactEnts.length > 8 ? `<div class="more">+ ${redactEnts.length - 8} more…</div>` : ""}</div>`
      : "";
    const warnBlock = warnEnts.length
      ? `<div class="grp"><div class="gh">⚠ Review before sending</div>${warnEnts.slice(0, 10).map(rowFor).join("")}${warnEnts.length > 10 ? `<div class="more">+ ${warnEnts.length - 10} more…</div>` : ""}</div>`
      : "";
    const banner = NS.hasCredential(lastEnts)
      ? `<div class="ban">🔴 Never paste passwords or secret keys into a website or chatbot. Remove them before sending.</div>`
      : "";
    const redactMarkedBtn = redactEnts.length
      ? `<button data-a="redactMarked">Redact marked (${redactEnts.length})</button>`
      : "";

    pop.innerHTML = `
      <div class="ph">Sensitive data you typed</div>
      ${banner}
      <div class="list">${redactBlock}${warnBlock}</div>
      <div class="pa">${redactMarkedBtn}<button data-a="redact" class="${redactMarkedBtn ? "g" : ""}">Redact all</button><button data-a="dismiss" class="g">Dismiss</button></div>`;
    pop.querySelector('[data-a="redact"]').onclick = () => redactAll(active);
    const rm = pop.querySelector('[data-a="redactMarked"]');
    if (rm) rm.onclick = () => { autoRedactMarked(active); popOpen = false; pop.hidden = true; };
    pop.querySelector('[data-a="dismiss"]').onclick = () => { popOpen = false; pop.hidden = true; };
    pop.hidden = false;
    positionPop(badge);
  }

  function positionPop(badge) {
    const pop = host().querySelector(".pop");
    const br = badge.getBoundingClientRect();
    requestAnimationFrame(() => {
      const pw = pop.offsetWidth || 250, ph = pop.offsetHeight || 120;
      let top = br.top - ph - 6;
      if (top < 6) top = br.bottom + 6;
      pop.style.left = Math.max(6, Math.min(br.right - pw, window.innerWidth - pw - 6)) + "px";
      pop.style.top = top + "px";
    });
  }

  function flashBadge() {
    const badge = host().querySelector(".badge");
    badge.animate([{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 260, iterations: 2 });
  }

  // Brief confirmation pill (bottom-centre) so it's obvious an action registered.
  function toast(msg, color) {
    const t = host().querySelector(".toast");
    t.textContent = msg;
    t.style.setProperty("--tc", color || "#6366f1");
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1900);
  }

  // --- Redaction ---------------------------------------------------------
  // Write a new value into an editable field, going through the editor's own
  // input pipeline where possible (rich editors like ChatGPT/Claude).
  function writeField(el, masked) {
    if (el.isContentEditable) {
      el.focus();
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
        el.dispatchEvent(new InputEvent("input", { bubbles: true }));
      }
    } else {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, masked);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  // Mask a chosen subset of detected entities in place. `filter` picks which.
  function maskField(el, filter) {
    if (!el) return 0;
    const ctx = getContext(el);
    const ents = NS.detect(ctx.text).filter(filter || (() => true));
    if (!ents.length) return 0;
    let masked = ctx.text;
    [...ents].sort((a, b) => b.start - a.start).forEach((e) => {
      masked = masked.slice(0, e.start) + "[REDACTED]" + masked.slice(e.end);
    });
    if (masked === ctx.text) return 0;
    writeField(el, masked);
    popOpen = false;
    refresh(el);
    toast("✓ Redacted " + ents.length + " item" + (ents.length === 1 ? "" : "s"), "#22c55e");
    return ents.length;
  }

  // "Redact all" — every detected value.
  function redactAll(el) { return maskField(el, null); }
  // Auto-redact only the rules the user marked "mask & redact".
  function autoRedactMarked(el) { return maskField(el, (e) => NS.actionFor(e) === "redact"); }

  // --- Rect measurement --------------------------------------------------
  function buildTextMap(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let text = "", n;
    while ((n = walker.nextNode())) {
      const v = n.nodeValue;
      // Rich editors (Gemini/ChatGPT) put each block on its own node with no
      // whitespace between them. Insert a separating space so adjacent blocks
      // don't glue into one token ("Bank"+"Account" → "BankAccount"), which
      // would break context-based detection. Whitespace-aware so we never
      // double-space or split a value that already runs continuously.
      if (text && !/\s$/.test(text) && !/^\s/.test(v)) text += " ";
      nodes.push({ node: n, start: text.length, end: text.length + v.length });
      text += v;
    }
    return { text, nodes };
  }

  function spanRects(el, start, end, ctx) {
    if (ctx && ctx.map) {
      const s = ctx.map.nodes.find((x) => start >= x.start && start < x.end) || ctx.map.nodes.find((x) => start >= x.start && start <= x.end);
      const e = ctx.map.nodes.find((x) => end > x.start && end <= x.end) || ctx.map.nodes.find((x) => end >= x.start && end <= x.end);
      if (!s || !e) return [];
      try {
        const range = document.createRange();
        range.setStart(s.node, start - s.start);
        range.setEnd(e.node, end - e.start);
        return [...range.getClientRects()];
      } catch (_) { return []; }
    }
    return mirrorRects(el, start, end);
  }

  const MIRROR_PROPS = ["paddingTop","paddingRight","paddingBottom","paddingLeft","borderTopWidth","borderRightWidth","borderBottomWidth","borderLeftWidth","fontFamily","fontSize","fontWeight","fontStyle","fontVariant","letterSpacing","textTransform","wordSpacing","lineHeight","textIndent","tabSize","textAlign"];
  function mirrorRects(el, start, end) {
    const cs = getComputedStyle(el);
    const div = document.createElement("div");
    MIRROR_PROPS.forEach((p) => { div.style[p] = cs[p]; });
    div.style.position = "absolute";
    div.style.top = "0";
    div.style.left = "-99999px";
    div.style.visibility = "hidden";
    div.style.boxSizing = "border-box";
    div.style.width = el.offsetWidth + "px";
    div.style.whiteSpace = el.tagName === "TEXTAREA" ? "pre-wrap" : "pre";
    div.style.overflowWrap = "break-word";
    const val = el.value;
    div.appendChild(document.createTextNode(val.slice(0, start)));
    const marker = document.createElement("span");
    marker.textContent = val.slice(start, end) || "​";
    div.appendChild(marker);
    div.appendChild(document.createTextNode(val.slice(end)));
    document.body.appendChild(div);
    const elRect = el.getBoundingClientRect();
    const dRect = div.getBoundingClientRect();
    const out = [...marker.getClientRects()].map((r) => ({
      left: elRect.left + (r.left - dRect.left) - el.scrollLeft,
      top: elRect.top + (r.top - dRect.top) - el.scrollTop,
      width: r.width,
      height: r.height,
    }));
    div.remove();
    return out;
  }

  // --- Helpers + styles --------------------------------------------------
  const LEVEL = { low: "#22c55e", medium: "#eab308", high: "#f97316", critical: "#ef4444" };
  const REDACT_COLOR = "#c084fc"; // purple = a rule you marked "mask & redact"
  const severe = (t) => (NS.WEIGHTS[t] >= 0.85 ? "#ef4444" : "#f97316");
  const label = (t) => (NS.FRIENDLY[t] || t).replace(/^\w/, (c) => c.toUpperCase());

  function host() {
    let h = document.getElementById(HOST_ID);
    if (h) return h.shadowRoot;
    h = document.createElement("div");
    h.id = HOST_ID;
    document.documentElement.appendChild(h);
    const root = h.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${CSS}</style>
      <div class="underlines"></div>
      <div class="badge" hidden></div>
      <div class="pop" hidden></div>
      <div class="toast"></div>`;
    // Keep the editor focused when the badge/popover is clicked. Without this,
    // clicking the badge blurs the field, focusout hides the badge, and the click
    // never lands — the root cause of the "sometimes works" flakiness. The
    // underlines layer is pointer-events:none, so only badge/pop clicks reach here.
    root.addEventListener("mousedown", (e) => {
      interacting = true;
      e.preventDefault(); // stops focus leaving the text field
      setTimeout(() => { interacting = false; }, 250);
    }, true);
    return root;
  }

  const CSS = `
    :host { all: initial; }
    .toast { position: fixed; left: 50%; bottom: 24px; z-index: 2147483647; pointer-events: none;
             transform: translateX(-50%) translateY(10px); opacity: 0;
             transition: opacity .16s ease, transform .16s ease;
             background: #12151c; color: #e6e9ef; border: 1px solid var(--tc, #6366f1);
             border-radius: 10px; padding: 9px 15px; box-shadow: 0 8px 26px rgba(0,0,0,.5);
             font: 600 12.5px -apple-system, "Segoe UI", Roboto, sans-serif; white-space: nowrap; }
    .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
    .underlines { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; }
    .ul { position: absolute; pointer-events: none; border-bottom: 2px solid var(--c);
          background: color-mix(in srgb, var(--c) 12%, transparent); border-radius: 1px; }
    .badge { position: fixed; z-index: 2147483647; pointer-events: auto; cursor: pointer;
             font: 700 12px -apple-system, "Segoe UI", Roboto, sans-serif;
             background: #12151c; color: #fff; border: 1px solid #232936; border-left: 3px solid var(--c);
             border-radius: 8px; padding: 3px 8px; box-shadow: 0 4px 14px rgba(0,0,0,.45); }
    .badge[hidden], .pop[hidden] { display: none; }
    .pop { position: fixed; z-index: 2147483647; pointer-events: auto; width: 256px;
           font: 13px -apple-system, "Segoe UI", Roboto, sans-serif;
           background: #12151c; color: #e6e9ef; border: 1px solid #232936; border-radius: 10px;
           padding: 10px; box-shadow: 0 10px 34px rgba(0,0,0,.55); }
    .ph { font-weight: 700; margin-bottom: 8px; font-size: 12px; }
    .ban { background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.4); color: #fca5a5;
           border-radius: 8px; padding: 7px 9px; font-size: 11.5px; line-height: 1.35; margin-bottom: 9px; }
    .list { max-height: 220px; overflow: auto; display: flex; flex-direction: column; gap: 5px; margin-bottom: 9px; }
    .grp { display: flex; flex-direction: column; gap: 5px; }
    .grp + .grp { margin-top: 9px; }
    .gh { font-size: 10.5px; font-weight: 700; letter-spacing: .03em; color: #9aa4b2; text-transform: uppercase; }
    .grp.rd .gh { color: #c084fc; }
    .grp.rd .it .v { color: #c084fc; }
    .it { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
    .it .t { color: #cbd2dd; }
    .it .v { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: #f97316; white-space: nowrap; }
    .more { color: #6b7280; font-size: 11px; }
    .pa { display: flex; gap: 6px; }
    .pa button { flex: 1; border: none; border-radius: 7px; padding: 7px; font-size: 12px; font-weight: 600; cursor: pointer; background: #6366f1; color: #fff; }
    .pa .g { background: transparent; color: #9aa4b2; border: 1px solid #232936; }
  `;
})();
