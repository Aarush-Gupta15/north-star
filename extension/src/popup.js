/* Popup controller. Uses the shared NorthStarEngine for the quick text scan and
   messages the content script for page actions. */
(function () {
  "use strict";
  const NS = window.NorthStarEngine;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  $("opts").onclick = () => chrome.runtime.openOptionsPage();

  async function activeTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  // Show current page status (content script may be absent on chrome:// pages).
  (async () => {
    const tab = await activeTab();
    if (!tab || /^(chrome|edge|about):/.test(tab.url || "")) {
      $("pageStatus").textContent = "This page can't be scanned.";
      $("scanPage").disabled = true;
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: "getState" }, (res) => {
      if (chrome.runtime.lastError || !res) { $("pageStatus").textContent = "Ready to scan."; return; }
      $("pageStatus").textContent = res.scanned
        ? `Page scanned: ${res.count} PII item(s), ${res.level} risk.`
        : "Ready to scan.";
    });
  })();

  $("scanPage").onclick = async () => {
    const tab = await activeTab();
    if (!tab) return;
    chrome.tabs.sendMessage(tab.id, { type: "scanPage" }, () => {
      $("pageStatus").textContent = chrome.runtime.lastError
        ? "Couldn't scan (try reloading the page)."
        : "Scanning… see the overlay on the page.";
      if (!chrome.runtime.lastError) window.close();
    });
  };

  $("scanText").onclick = () => {
    const text = $("text").value;
    if (!text.trim()) return;
    renderResult(NS.scan(text));
  };

  function renderResult(r) {
    const redHTML = r.redacted
      .split(/(\[[A-Z_]+\])/g)
      .map((p) => (/^\[[A-Z_]+\]$/.test(p) ? `<mark>${p}</mark>` : esc(p)))
      .join("");
    $("result").innerHTML = `<div class="rcard">
      <div class="rtop"><div><div class="num">${r.score}</div><div class="cap">risk / 100</div></div>
        <span class="badge lvl-${r.level}">${r.level}</span></div>
      ${r.summary.length ? `<div class="chips">${r.summary.map((s) => `<span class="chip">${s.type} <b>×${s.count}</b></span>`).join("")}</div>` : `<div class="ok">No personal data detected ✔</div>`}
      ${r.summary.length ? `<div class="redacted">${redHTML}</div>` : ""}
    </div>`;
  }
})();
