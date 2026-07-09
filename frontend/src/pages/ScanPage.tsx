import { useState } from "react";
import { api, ApiError, type ScanResult } from "../api/client";
import { ScanResultView } from "../components/ScanResultView";

const SAMPLE = `Hi, I'm Ravi Kumar. My Aadhaar is 2341 2345 6783 and PAN ABCDE1234F.
Reach me at ravi.kumar@example.com or +91 98765 43210.
Card 4111 1111 1111 1111, server IP 192.168.1.42.`;

export function ScanPage() {
  const [text, setText] = useState(SAMPLE);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function runScan() {
    setError(null);
    setBusy(true);
    try {
      setResult(await api.scan(text, true));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Scan failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Scan text for sensitive data</h1>
      <p className="subtitle">
        Paste any text. North Star detects PII, scores the privacy risk, and shows a redacted version.
      </p>

      <div className="grid-2">
          <div className="card stack">
            <div>
              <label htmlFor="scan-input">Input text</label>
              <textarea
                id="scan-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste text containing names, emails, IDs…"
              />
            </div>
            <div className="row between">
              <span className="muted">{text.length.toLocaleString()} characters</span>
              <button className="btn-primary" onClick={runScan} disabled={busy || !text.trim()}>
                {busy ? <span className="spinner" /> : "Scan for PII"}
              </button>
            </div>
            {error && <p className="error-text">{error}</p>}
          </div>

          <div>
            {result ? (
              <ScanResultView result={result} />
            ) : (
              <div className="card" style={{ display: "grid", placeItems: "center", minHeight: 220 }}>
                <p className="muted">Results will appear here after a scan.</p>
              </div>
            )}
          </div>
        </div>
    </>
  );
}
