import { useEffect, useState } from "react";
import { api, ApiError, type DashboardStats } from "../api/client";
import { StatCard } from "../components/StatCard";
import { TopPiiBars } from "../components/TopPiiBars";
import { TrendChart } from "../components/TrendChart";
import { ConnectExtension } from "../components/ConnectExtension";

function postureTone(score: number): "good" | "warn" | "bad" {
  if (score >= 75) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

export function DashboardPage({ onNewScan }: { onNewScan: () => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .dashboard()
      .then((d) => active && setStats(d))
      .catch((e) => active && setError(e instanceof ApiError ? e.message : "Failed to load."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="card" style={{ display: "grid", placeItems: "center", minHeight: 240 }}>
        <span className="spinner" style={{ borderTopColor: "var(--accent)" }} />
      </div>
    );
  }

  if (error || !stats) {
    return <div className="card error-text">{error ?? "No data."}</div>;
  }

  const empty = stats.total_scans === 0;
  const b = stats.risk_breakdown;
  const totalForBar = Math.max(1, b.low + b.medium + b.high + b.critical);

  return (
    <div className="stack fade-in">
      <div className="row between">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Privacy posture across {stats.scope === "you" ? "your scans" : "the organization"}.
          </p>
        </div>
        <button className="btn-primary" onClick={onNewScan}>
          New scan
        </button>
      </div>

      <ConnectExtension />

      {empty ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p className="muted">No scans yet. Run your first scan to populate the dashboard.</p>
          <button className="btn-primary" style={{ marginTop: 12 }} onClick={onNewScan}>
            Run a scan
          </button>
        </div>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard label="Total scans" value={stats.total_scans} sub="all time" />
            <StatCard
              label="High-risk scans"
              value={stats.high_risk_count}
              sub="high + critical"
              tone={stats.high_risk_count > 0 ? "bad" : "good"}
            />
            <StatCard
              label="Privacy posture"
              value={`${stats.privacy_posture_score}`}
              sub="100 = pristine"
              tone={postureTone(stats.privacy_posture_score)}
            />
            <StatCard
              label="Compliance score"
              value={`${stats.compliance_score}%`}
              sub="scans without high risk"
              tone={postureTone(stats.compliance_score)}
            />
          </div>

          <div className="grid-2">
            <div className="card">
              <h2>Risk trend (14 days)</h2>
              <TrendChart data={stats.trend} />
              <div className="legend">
                <span className="legend-item">
                  <span className="legend-swatch swatch-line" /> Avg risk score
                </span>
                <span className="legend-item">
                  <span className="legend-swatch swatch-bar" /> Scan volume
                </span>
              </div>
            </div>

            <div className="stack">
              <div className="card">
                <h2>Top detected PII</h2>
                <TopPiiBars items={stats.top_pii} />
              </div>
              <div className="card">
                <h2>Risk breakdown</h2>
                <div className="segbar">
                  {(["low", "medium", "high", "critical"] as const).map((lvl) => {
                    const val = b[lvl];
                    return val > 0 ? (
                      <div
                        key={lvl}
                        className={`segbar-seg risk-${lvl}-bg`}
                        style={{ width: `${(val / totalForBar) * 100}%` }}
                        title={`${lvl}: ${val}`}
                      />
                    ) : null;
                  })}
                </div>
                <div className="chips" style={{ marginTop: 12 }}>
                  {(["low", "medium", "high", "critical"] as const).map((lvl) => (
                    <span className="chip" key={lvl}>
                      <span className={`badge risk-${lvl}`} style={{ padding: "1px 7px" }}>
                        {lvl}
                      </span>{" "}
                      <b>{b[lvl]}</b>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
