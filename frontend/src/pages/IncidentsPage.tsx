import { useCallback, useEffect, useState } from "react";
import { api, ApiError, saveBlob, type Incident } from "../api/client";
import { RiskBadge } from "../components/RiskBadge";

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

export function IncidentsPage() {
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState<Incident[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setRows(null);
    setError(null);
    try {
      setRows(await api.incidents(days));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load incidents.");
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  async function downloadPdf() {
    setDownloading(true);
    try {
      saveBlob(await api.downloadIncidentReport(days), `north-star-incidents-${days}d.pdf`);
    } catch {
      setError("Could not download the report.");
    } finally {
      setDownloading(false);
    }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="stack fade-in">
      <div className="row between">
        <div>
          <h1>Incidents</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Employees who sent sensitive data despite a warning. Values are masked.
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="nav-tabs">
            {RANGES.map((r) => (
              <button
                key={r.days}
                className={`nav-tab ${days === r.days ? "active" : ""}`}
                onClick={() => setDays(r.days)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={downloadPdf} disabled={downloading || !rows?.length}>
            {downloading ? "…" : "⬇ Download PDF"}
          </button>
        </div>
      </div>

      {error && <div className="card error-text">{error}</div>}

      {!rows && !error && (
        <div className="card" style={{ display: "grid", placeItems: "center", minHeight: 160 }}>
          <span className="spinner" style={{ borderTopColor: "var(--accent)" }} />
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p className="muted">No incidents in this period. Nothing was sent after a warning. 🎉</p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="inc-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>When</th>
                <th>Site</th>
                <th>Risk</th>
                <th>Data types</th>
                <th>Sent (masked)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td className="mono">{i.actor_label ?? "—"}</td>
                  <td className="muted-cell">{fmt(i.created_at)}</td>
                  <td className="mono">{i.site ?? "—"}</td>
                  <td><RiskBadge level={i.risk_level} /></td>
                  <td>
                    <div className="chips">
                      {i.findings_summary.map((f) => (
                        <span className="chip" key={f.type}>{f.type} <b>×{f.count}</b></span>
                      ))}
                    </div>
                  </td>
                  <td className="mono snippet">{i.masked_snippet ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
