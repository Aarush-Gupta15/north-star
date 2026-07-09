/* Personal edition — local settings + custom rules with per-rule actions.
 * No backend, no reporting. Everything stays in chrome.storage.sync (your own
 * Chrome profile). Each rule is: { text, type, action }.
 *   type   : "term" (word/phrase) | "keyword" (label — flag what follows) | "regex"
 *   action : "highlight" (warn only) | "redact" (auto-mask the value)
 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const NS = window.NorthStarEngine;
  const rulesEl = $("rules");

  // Starter packs — each rule carries a sensible default action.
  const PACKS = {
    general: [
      { text: "Confidential", type: "term", action: "highlight" },
      { text: "Internal Use Only", type: "term", action: "highlight" },
      { text: "employee id", type: "keyword", action: "redact" },
      { text: "salary", type: "keyword", action: "redact" },
      { text: "home address", type: "keyword", action: "highlight" },
    ],
    dev: [
      { text: "api key", type: "keyword", action: "redact" },
      { text: "secret key", type: "keyword", action: "redact" },
      { text: "access token", type: "keyword", action: "redact" },
      { text: "db password", type: "keyword", action: "redact" },
      { text: "AKIA[0-9A-Z]{16}", type: "regex", action: "redact" },
      { text: "gh[pousr]_[A-Za-z0-9]{36,}", type: "regex", action: "redact" },
      { text: "sk-[A-Za-z0-9]{20,}", type: "regex", action: "redact" },
    ],
    finance: [
      { text: "Confidential", type: "term", action: "highlight" },
      { text: "account number", type: "keyword", action: "redact" },
      { text: "ifsc", type: "keyword", action: "highlight" },
      { text: "invoice no", type: "keyword", action: "highlight" },
      { text: "gst", type: "keyword", action: "highlight" },
    ],
    healthcare: [
      { text: "PHI", type: "term", action: "highlight" },
      { text: "patient id", type: "keyword", action: "redact" },
      { text: "mrn", type: "keyword", action: "redact" },
      { text: "diagnosis", type: "keyword", action: "highlight" },
      { text: "insurance id", type: "keyword", action: "redact" },
    ],
  };

  // --- Row rendering -----------------------------------------------------
  function makeRow(rule) {
    rule = rule || { text: "", type: "term", action: "highlight" };
    const row = document.createElement("div");
    row.className = "rule";
    row.innerHTML = `
      <input type="text" class="r-text" placeholder="e.g. employee id / Project Falcon / EMP\\d{6}" />
      <select class="r-type">
        <option value="term">Word / phrase</option>
        <option value="keyword">Label (flag next)</option>
        <option value="regex">Regex</option>
      </select>
      <select class="r-action">
        <option value="highlight">Highlight</option>
        <option value="redact">Mask &amp; redact</option>
      </select>
      <button class="r-del" title="Remove">✕</button>`;
    row.querySelector(".r-text").value = rule.text || "";
    row.querySelector(".r-type").value = ["term", "keyword", "regex"].includes(rule.type) ? rule.type : "term";
    const aSel = row.querySelector(".r-action");
    aSel.value = rule.action === "redact" ? "redact" : "highlight";
    const paintAction = () => { aSel.className = "r-action a-" + aSel.value; };
    paintAction();
    aSel.addEventListener("change", () => { paintAction(); runTest(); });
    row.querySelector(".r-type").addEventListener("change", runTest);
    row.querySelector(".r-text").addEventListener("input", runTest);
    row.querySelector(".r-del").addEventListener("click", () => { row.remove(); runTest(); });
    return row;
  }

  function addRow(rule) { rulesEl.appendChild(makeRow(rule)); }

  function getRows() {
    return [...rulesEl.querySelectorAll(".rule")]
      .map((r) => ({
        text: r.querySelector(".r-text").value.trim(),
        type: r.querySelector(".r-type").value,
        action: r.querySelector(".r-action").value,
      }))
      .filter((r) => r.text.length >= 2);
  }

  // Rows -> stored shape { terms, keywords, regexes, actions }.
  function rowsToRules(rows) {
    const out = { terms: [], keywords: [], regexes: [], actions: {} };
    rows.forEach((r) => {
      if (r.type === "keyword") out.keywords.push(r.text);
      else if (r.type === "regex") out.regexes.push(r.text);
      else out.terms.push(r.text);
      out.actions[r.text] = r.action === "redact" ? "redact" : "highlight";
    });
    return out;
  }

  // Stored shape -> rows.
  function rulesToRows(cr) {
    cr = cr || {};
    const act = (t) => (cr.actions && cr.actions[t] === "redact" ? "redact" : "highlight");
    const rows = [];
    (cr.terms || []).forEach((t) => rows.push({ text: t, type: "term", action: act(t) }));
    (cr.keywords || []).forEach((t) => rows.push({ text: t, type: "keyword", action: act(t) }));
    (cr.regexes || []).forEach((t) => rows.push({ text: t, type: "regex", action: act(t) }));
    return rows;
  }

  const currentRules = () => rowsToRules(getRows());

  // Disabled-sites textarea <-> array of hostnames.
  const linesToArr = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  const currentDisabled = () => (NS ? [...new Set(linesToArr($("disabledSites").value).map((h) => NS.normHost(h)).filter(Boolean))] : linesToArr($("disabledSites").value));

  // --- Load --------------------------------------------------------------
  chrome.storage.sync.get(
    ["autoScan", "typeGuard", "blockSend", "customRules", "disabledSites"],
    (cfg) => {
      $("autoScan").checked = cfg.autoScan !== false;
      $("typeGuard").checked = cfg.typeGuard !== false;
      $("blockSend").checked = cfg.blockSend === true;
      $("disabledSites").value = (cfg.disabledSites || []).join("\n");
      const rows = rulesToRows(cfg.customRules || {});
      (rows.length ? rows : [null]).forEach(addRow); // start with one blank row
      if (NS) NS.setCustomRules(cfg.customRules || {});
      runTest();
    }
  );

  // --- Save --------------------------------------------------------------
  function save(then) {
    const customRules = currentRules();
    chrome.storage.sync.set(
      {
        autoScan: $("autoScan").checked,
        typeGuard: $("typeGuard").checked,
        blockSend: $("blockSend").checked,
        customRules,
        disabledSites: currentDisabled(),
      },
      () => {
        if (NS) NS.setCustomRules(customRules);
        $("saved").textContent = "Saved ✔";
        setTimeout(() => ($("saved").textContent = ""), 1800);
        runTest();
        then && then();
      }
    );
  }
  $("save").onclick = () => save();
  $("addRule").onclick = () => addRow();

  // --- Packs -------------------------------------------------------------
  $("packs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-pack]");
    if (!btn) return;
    const existing = new Set(getRows().map((r) => r.text.toLowerCase()));
    PACKS[btn.dataset.pack].forEach((rule) => {
      if (!existing.has(rule.text.toLowerCase())) addRow(rule);
    });
    runTest();
    $("saved").textContent = 'Pack added — click "Save"';
    setTimeout(() => ($("saved").textContent = ""), 2600);
  });

  // --- Import / export ---------------------------------------------------
  $("export").onclick = () => {
    const blob = new Blob([JSON.stringify({ northStarPolicy: 2, customRules: currentRules() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "north-star-rules.json";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };
  $("importBtn").onclick = () => $("importFile").click();
  $("importFile").onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const cr = data.customRules || data;
        const existing = new Set(getRows().map((r) => r.text.toLowerCase()));
        rulesToRows(cr).forEach((rule) => {
          if (!existing.has(rule.text.toLowerCase())) addRow(rule);
        });
        save(() => { $("saved").textContent = "Imported ✔"; });
      } catch (_) { $("saved").textContent = "Invalid file"; }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // --- Live tester -------------------------------------------------------
  function runTest() {
    if (!NS) return;
    NS.setCustomRules(currentRules());
    const text = $("tester").value;
    if (!text.trim()) { $("testout").textContent = ""; return; }
    const ents = NS.detect(text);
    if (!ents.length) { $("testout").textContent = "No matches yet."; return; }
    $("testout").innerHTML =
      "Detected: " +
      ents
        .map((e) => {
          const act = NS.actionFor ? NS.actionFor(e) : "highlight";
          const cls = act === "redact" ? "rd" : "hl";
          const tag = act === "redact" ? "mask &amp; redact" : "highlight";
          return `<b style="color:#e6e9ef">${NS.FRIENDLY[e.type] || e.type}</b> (${NS.maskPreview(e.text)})<span class="badge ${cls}">${tag}</span>`;
        })
        .join(" &nbsp; ");
  }
  $("tester").addEventListener("input", runTest);
})();
