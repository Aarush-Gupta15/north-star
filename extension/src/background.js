/*
 * Background service worker.
 *  - Owns the right-click context menu and the toolbar badge.
 *  - Forwards the optional "sync" to the North Star backend (summary only).
 *  - Can detect a selection locally (engine imported here too) for a quick
 *    notification without touching the page DOM.
 */
importScripts("engine.js");
const NS = self.NorthStarEngine;

const LEVEL_COLORS = { low: "#22c55e", medium: "#eab308", high: "#f97316", critical: "#ef4444" };

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "ns-scan-page", title: "North Star: scan this page", contexts: ["page"] });
  chrome.contextMenus.create({ id: "ns-scan-selection", title: "North Star: scan selection", contexts: ["selection"] });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || tab.id == null) return;
  if (info.menuItemId === "ns-scan-page") {
    chrome.tabs.sendMessage(tab.id, { type: "scanPage" });
  } else if (info.menuItemId === "ns-scan-selection" && info.selectionText) {
    const r = NS.scan(info.selectionText);
    const title = r.level === "low" ? "North Star — looks clean" : `North Star — ${r.level.toUpperCase()} risk`;
    const types = r.summary.map((s) => `${s.count}× ${s.type}`).join(", ") || "no PII detected";
    chrome.notifications.create({
      type: "basic",
      iconUrl: "../icons/icon128.png",
      title,
      message: `Risk ${r.score}/100. ${types}.`,
    });
    setBadge(tab.id, r.level, r.ents.length);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "scanResult") {
    if (sender.tab && sender.tab.id != null) setBadge(sender.tab.id, msg.payload.level, msg.payload.count);
    return false;
  }
  if (msg.type === "openOptions") {
    chrome.runtime.openOptionsPage();
    return false;
  }
  if (msg.type === "sync") {
    syncSummary(msg.payload).then(sendResponse);
    return true; // async response
  }
  if (msg.type === "incident") {
    reportIncident(msg.payload).then(sendResponse);
    return true;
  }
  return false;
});

// Reporting config: company (managed) policy wins over the user's own settings.
async function reportConfig() {
  const get = (area, keys) =>
    new Promise((res) => {
      try {
        if (chrome.storage[area]) chrome.storage[area].get(keys, (v) => res(v || {}));
        else res({});
      } catch (_) { res({}); }
    });
  const [m, u] = await Promise.all([
    get("managed", ["reportIncidents", "apiUrl", "token"]),
    get("sync", ["reportIncidents", "apiUrl", "token"]),
  ]);
  return {
    reportIncidents: m.reportIncidents !== undefined ? m.reportIncidents : u.reportIncidents === true,
    apiUrl: m.apiUrl || u.apiUrl,
    token: m.token || u.token,
  };
}

async function reportIncident(payload) {
  const cfg = await reportConfig();
  if (!cfg.reportIncidents || !cfg.apiUrl || !cfg.token) return { ok: false, error: "reporting disabled" };
  try {
    const res = await fetch(`${cfg.apiUrl.replace(/\/$/, "")}/incidents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

function setBadge(tabId, level, count) {
  chrome.action.setBadgeBackgroundColor({ tabId, color: LEVEL_COLORS[level] || "#6b7280" });
  chrome.action.setBadgeText({ tabId, text: count ? String(Math.min(count, 999)) : "" });
}

async function syncSummary(payload) {
  const cfg = await chrome.storage.sync.get(["apiUrl", "token"]);
  if (!cfg.apiUrl || !cfg.token) return { ok: false, error: "not configured" };
  try {
    const res = await fetch(`${cfg.apiUrl.replace(/\/$/, "")}/scans/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}
