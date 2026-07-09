import type { ScanResult } from "../api/client";

export function RiskBadge({ level }: { level: ScanResult["risk_level"] }) {
  return <span className={`badge risk-${level}`}>{level}</span>;
}
