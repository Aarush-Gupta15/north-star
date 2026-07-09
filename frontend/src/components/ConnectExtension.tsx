import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

/** A small helper card so users can link the Chrome extension to this backend
 *  in one click — copy the API URL and their access token into the extension. */
export function ConnectExtension() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied("Copy failed — select and copy manually");
    }
  };

  return (
    <div className="card" style={{ borderStyle: "dashed" }}>
      <div className="row between" style={{ cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <h2 style={{ margin: 0 }}>🔗 Connect your Chrome extension</h2>
        <button className="btn-ghost" style={{ padding: "4px 10px" }}>{open ? "Hide" : "Show"}</button>
      </div>

      {open && (
        <div className="stack" style={{ marginTop: 14 }}>
          <p className="muted" style={{ margin: 0 }}>
            In the extension's <b>Options</b>, paste these two values, then tick
            “Report incidents to management”. After that, scans and incidents from
            the extension show up here.
          </p>

          <div>
            <label>API base URL</label>
            <div className="copyrow">
              <code className="copyval">{API_URL}</code>
              <button className="btn-ghost" onClick={() => copy(API_URL, "URL")}>Copy</button>
            </div>
          </div>

          <div>
            <label>Your access token</label>
            <div className="copyrow">
              <code className="copyval mono-ellipsis">{token ?? "—"}</code>
              <button className="btn-primary" onClick={() => token && copy(token, "Token")} disabled={!token}>
                Copy token
              </button>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              This token identifies you to the backend. Keep it private; it expires after 30 minutes.
            </div>
          </div>

          {copied && <div style={{ color: "var(--risk-low)", fontSize: 13 }}>✔ {copied} copied</div>}
        </div>
      )}
    </div>
  );
}
