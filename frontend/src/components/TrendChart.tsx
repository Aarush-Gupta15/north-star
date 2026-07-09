import type { TrendPoint } from "../api/client";

/**
 * Dependency-free trend chart (no charting library).
 * Bars = scan volume per day; line/area = average risk score (0–100).
 */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  const W = 720;
  const H = 240;
  const pad = { l: 34, r: 14, t: 16, b: 26 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const n = data.length;
  const maxScans = Math.max(1, ...data.map((d) => d.scans));

  const x = (i: number) => pad.l + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yRisk = (r: number) => pad.t + (1 - Math.min(100, r) / 100) * plotH;
  const baseline = pad.t + plotH;

  const linePts = data.map((d, i) => `${x(i)},${yRisk(d.avg_risk)}`).join(" ");
  const areaPath = `M ${x(0)},${baseline} L ${linePts.split(" ").join(" L ")} L ${x(n - 1)},${baseline} Z`;

  const gridLevels = [0, 25, 50, 75, 100];
  const ticks = [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend-chart" role="img" aria-label="Risk and scan-volume trend">
      <defs>
        <linearGradient id="riskArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.30" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* horizontal grid + risk axis labels */}
      {gridLevels.map((lvl) => {
        const y = yRisk(lvl);
        return (
          <g key={lvl}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} className="grid-line" />
            <text x={pad.l - 6} y={y + 3} className="axis-label" textAnchor="end">
              {lvl}
            </text>
          </g>
        );
      })}

      {/* scan-volume bars */}
      {data.map((d, i) => {
        const h = (d.scans / maxScans) * plotH;
        const bw = Math.max(3, plotW / n - 6);
        return (
          <rect
            key={d.date}
            x={x(i) - bw / 2}
            y={baseline - h}
            width={bw}
            height={h}
            rx={2}
            className="vol-bar"
          >
            <title>{`${d.date}: ${d.scans} scan(s), avg risk ${d.avg_risk}`}</title>
          </rect>
        );
      })}

      {/* avg-risk area + line */}
      <path d={areaPath} fill="url(#riskArea)" />
      <polyline points={linePts} className="risk-line" fill="none" />
      {data.map((d, i) => (
        <circle key={d.date} cx={x(i)} cy={yRisk(d.avg_risk)} r={2.5} className="risk-dot" />
      ))}

      {/* x-axis date labels */}
      {ticks.map((i) => (
        <text key={i} x={x(i)} y={H - 6} className="axis-label" textAnchor="middle">
          {data[i]?.date.slice(5)}
        </text>
      ))}
    </svg>
  );
}
