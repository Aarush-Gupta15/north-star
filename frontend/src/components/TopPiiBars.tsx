import type { PiiCount } from "../api/client";

export function TopPiiBars({ items }: { items: PiiCount[] }) {
  if (items.length === 0) {
    return <p className="muted">No PII detected yet.</p>;
  }
  const max = Math.max(...items.map((i) => i.count));

  return (
    <div className="bar-list">
      {items.map((item) => (
        <div className="bar-row" key={item.type}>
          <span className="bar-label">{item.type}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
          <span className="bar-count">{item.count}</span>
        </div>
      ))}
    </div>
  );
}
