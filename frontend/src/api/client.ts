/**
 * Typed API client.
 *
 * One place that knows about the backend's URL, auth header, and error
 * envelope. Components call typed methods (`api.scan(...)`) and never touch
 * `fetch` directly — mirrors the backend's "thin controllers" principle on the
 * client side.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export interface DetectedEntity {
  type: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface FindingSummaryItem {
  type: string;
  count: number;
  max_confidence: number;
}

export interface ScanResult {
  id: string | null;
  risk_score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  entity_count: number;
  entities: DetectedEntity[];
  findings_summary: FindingSummaryItem[];
  redacted_text: string;
  explanation: string | null;
  created_at: string | null;
}

export interface PiiCount {
  type: string;
  count: number;
}

export interface TrendPoint {
  date: string;
  scans: number;
  avg_risk: number;
}

export interface RiskBreakdown {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export interface DashboardStats {
  scope: "you" | "organization";
  total_scans: number;
  high_risk_count: number;
  avg_risk_score: number;
  privacy_posture_score: number;
  compliance_score: number;
  risk_breakdown: RiskBreakdown;
  top_pii: PiiCount[];
  trend: TrendPoint[];
}

export interface Incident {
  id: string;
  actor_label: string | null;
  site: string | null;
  action: string;
  risk_score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  entity_count: number;
  findings_summary: FindingSummaryItem[];
  masked_snippet: string | null;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "analyst" | "user";
  is_active: boolean;
}

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

let authToken: string | null = null;
export function setAuthToken(token: string | null): void {
  authToken = token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let code = "error";
    let message = res.statusText;
    try {
      const body = await res.json();
      code = body?.error?.code ?? body?.detail ?? code;
      message = body?.error?.message ?? body?.detail ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(code, message, res.status);
  }
  return (await res.json()) as T;
}

export const api = {
  register: (email: string, password: string, full_name?: string) =>
    request<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name }),
    }),

  login: (email: string, password: string) =>
    request<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<User>("/auth/me"),

  scan: (text: string, explain = true) =>
    request<ScanResult>("/scans", {
      method: "POST",
      body: JSON.stringify({ text, explain }),
    }),

  dashboard: () => request<DashboardStats>("/analytics/dashboard"),

  /** Admin/analyst: list policy incidents (optionally last N days). */
  incidents: (days?: number) =>
    request<Incident[]>(`/incidents${days ? `?days=${days}` : ""}`),

  /** Fetch the scan's PDF audit report as a Blob (sends the JWT). */
  async downloadReport(scanId: string): Promise<Blob> {
    return blobGet(`/scans/${scanId}/report`);
  },

  /** Admin/analyst: download the incident digest PDF for the last N days. */
  async downloadIncidentReport(days = 7): Promise<Blob> {
    return blobGet(`/incidents/report.pdf?days=${days}`);
  },
};

async function blobGet(path: string): Promise<Blob> {
  const headers = new Headers({ Accept: "application/pdf" });
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) throw new ApiError("report_error", "Could not generate the report.", res.status);
  return res.blob();
}

/** Trigger a browser download for a Blob. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
