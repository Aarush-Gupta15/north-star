/* Settings persistence via chrome.storage.sync, incl. custom detection rules,
   starter packs, import/export, and a company (managed) policy banner. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const NS = window.NorthStarEngine;

  const linesToArr = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  const arrToLines = (a) => (a || []).join("\n");
  const uniq = (a) => [...new Set(a)];

  // Curated starter packs so companies/employees don't start from a blank page.
  const PACKS = {
    general: {
      terms: ["Confidential", "Internal Use Only", "Do Not Distribute"],
      keywords: ["employee id", "emp id", "salary", "home address", "date of birth"],
      regexes: [],
    },
    dev: {
      terms: ["Confidential"],
      keywords: ["api key", "secret key", "access token", "db password", "connection string"],
      regexes: ["AKIA[0-9A-Z]{16}", "gh[pousr]_[A-Za-z0-9]{36,}", "sk-[A-Za-z0-9]{20,}"],
    },
    finance: {
      terms: ["Confidential", "Internal Use Only"],
      keywords: ["account number", "ifsc", "salary", "invoice no", "gst"],
      regexes: [],
    },
    healthcare: {
      terms: ["PHI", "Patient Confidential"],
      keywords: ["patient id", "mrn", "diagnosis", "insurance id"],
      regexes: [],
    },
  };

  function currentRules() {
    return {
      terms: linesToArr($("terms").value),
      keywords: linesToArr($("keywords").value),
      regexes: linesToArr($("regexes").value),
    };
  }
  function setFields(cr) {
    $("terms").value = arrToLines(cr.terms);
    $("keywords").value = arrToLines(cr.keywords);
    $("regexes").value = arrToLines(cr.regexes);
  }

  // --- Load current settings + show any company (managed) policy ----------
  chrome.storage.sync.get(
    ["apiUrl", "token", "autoScan", "typeGuard", "blockSend", "reportIncidents", "customRules"],
    (cfg) => {
      $("apiUrl").value = cfg.apiUrl || "http://localhost:8000/api/v1";
      $("token").value = cfg.token || "";
      $("autoScan").checked = cfg.autoScan !== false;
      $("typeGuard").checked = cfg.typeGuard !== false;
      $("blockSend").checked = cfg.blockSend === true;
      $("reportIncidents").checked = cfg.reportIncidents === true;
      setFields(cfg.customRules || {});
      if (NS) NS.setCustomRules(cfg.customRules || {});
      runTest();
    }
  );
  try {
    chrome.storage.managed && chrome.storage.managed.get(["customRules"], (m) => {
      const cr = (m && m.customRules) || null;
      if (cr) {
        const n = (cr.terms || []).length + (cr.keywords || []).length + (cr.regexes || []).length;
        if (n > 0) { $("managedCount").textContent = n; $("managedNote").style.display = "block"; }
      }
    });
  } catch (_) { /* no managed policy */ }

  // --- Save ---------------------------------------------------------------
  function save(then) {
    const customRules = currentRules();
    chrome.storage.sync.set(
      {
        apiUrl: $("apiUrl").value.trim(),
        token: $("token").value.trim(),
        autoScan: $("autoScan").checked,
        typeGuard: $("typeGuard").checked,
        blockSend: $("blockSend").checked,
        reportIncidents: $("reportIncidents").checked,
        customRules,
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

  // --- Starter packs (append + de-dupe) -----------------------------------
  $("packs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-pack]");
    if (!btn) return;
    const p = PACKS[btn.dataset.pack];
    const cur = currentRules();
    setFields({
      terms: uniq([...cur.terms, ...p.terms]),
      keywords: uniq([...cur.keywords, ...p.keywords]),
      regexes: uniq([...cur.regexes, ...p.regexes]),
    });
    runTest();
    $("saved").textContent = 'Pack added — click "Save" to apply';
    setTimeout(() => ($("saved").textContent = ""), 2600);
  });

  // --- Export / Import ----------------------------------------------------
  $("export").onclick = () => {
    const blob = new Blob(
      [JSON.stringify({ northStarPolicy: 1, customRules: currentRules() }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "north-star-policy.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
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
        const cr = data.customRules || data; // accept a bare rules object too
        const cur = currentRules();
        setFields({
          terms: uniq([...cur.terms, ...(cr.terms || [])]),
          keywords: uniq([...cur.keywords, ...(cr.keywords || [])]),
          regexes: uniq([...cur.regexes, ...(cr.regexes || [])]),
        });
        save(() => { $("saved").textContent = "Imported ✔"; });
      } catch (_) {
        $("saved").textContent = "Invalid policy file";
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // --- Live tester --------------------------------------------------------
  function runTest() {
    if (!NS) return;
    NS.setCustomRules(currentRules());
    const text = $("tester").value;
    if (!text.trim()) { $("testout").textContent = ""; return; }
    const ents = NS.detect(text);
    $("testout").innerHTML = ents.length
      ? "Detected: " + ents.map((e) => `<b style="color:#f97316">${NS.FRIENDLY[e.type] || e.type}</b> (${NS.maskPreview(e.text)})`).join(", ")
      : "No matches yet.";
  }
  $("tester").addEventListener("input", runTest);
})();
