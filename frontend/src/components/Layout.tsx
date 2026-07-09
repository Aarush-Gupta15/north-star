import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { Logo } from "./Logo";

export type View = "dashboard" | "scan" | "incidents";

export function Layout({
  view,
  onChange,
  children,
}: {
  view: View;
  onChange: (v: View) => void;
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  // Incidents are management-only (admin / analyst).
  const isAdmin = user?.role === "admin" || user?.role === "analyst";
  const tabs: { id: View; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "scan", label: "New Scan" },
    ...(isAdmin ? [{ id: "incidents" as View, label: "Incidents 🛡️" }] : []),
  ];

  return (
    <div className="app-shell">
      <nav className="navbar">
        <div className="brand">
          <Logo />
          North Star
        </div>

        <div className="nav-tabs" role="tablist" aria-label="Primary">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={view === t.id}
              className={`nav-tab ${view === t.id ? "active" : ""}`}
              onClick={() => onChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="nav-right">
          <span className="nav-user">
            {user?.email} · <b>{user?.role}</b>
          </span>
          <button className="btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </nav>

      <div className="container">{children}</div>
    </div>
  );
}
