import { useState } from "react";
import { api, saveBlob, type ScanResult } from "../api/client";
import { RiskBadge } from "./RiskBadge";

/** Renders the redacted text with each [TYPE] token highlighted. */
function Redacted({ text }: { text: string }) {
  const parts = text.split(/(\[[A-Z_]+\])/g);
  return (
    <div className="redacted">
      {parts.map((p, i) =>
        /^\[[A-Z_]+\]$/.test(p) ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>,
      )}
    </div>
  );
}

export function ScanResultView({ result }: { result: ScanResult }) {
  const [downloading, setDownloading] = useState(false);

  async function downloadReport() {
    if (!result.id) return;
    setDownloading(true);
    try {
      const blob = await api.downloadReport(result.id);
      saveBlob(blob, `privacy-report-${result.id}.pdf`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="stack fade-in">
      <div className="card stack">
        <div className="row between">
          <div className="score-ring">
            <div>
              <div className="score-num">{result.risk_score}</div>
              <div className="score-cap">Risk score / 100</div>
            </div>
          </div>
          <RiskBadge level={result.risk_level} />
        </div>

        {result.id && (
          <button className="btn-ghost" onClick={downloadReport} disabled={downloading}>
            {downloading ? "Generating…" : "⬇ Download PDF audit report"}
          </button>
        )}

        {result.findings_summary.length > 0 ? (
          <div>
            <h2>Detected PII ({result.entity_count})</h2>
            <div className="chips">
              {result.findings_summary.map((f) => (
                <span className="chip" key={f.type}>
                  {f.type} <b>×{f.count}</b>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="muted">No personal data detected.</p>
        )}
      </div>

      {result.explanation && (
        <div className="card">
          <h2>What this means</h2>
          <p className="explanation">{result.explanation}</p>
        </div>
      )}

      <div className="card">
        <h2>Redacted output</h2>
        <Redacted text={result.redacted_text} />
      </div>
    </div>
  );
}
