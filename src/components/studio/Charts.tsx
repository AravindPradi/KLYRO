type BarDatum = { label: string; value: number };

export function TrendChart({ data }: { data: { date: string; count: number }[] }) {
  const width = 620;
  const height = 170;
  const padding = { left: 26, right: 8, top: 14, bottom: 26 };
  const max = Math.max(1, ...data.map((d) => d.count));
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const barW = Math.max(6, innerW / Math.max(1, data.length) - 6);
  const gap = innerW / Math.max(1, data.length);

  return (
    <div className="os-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Enquiries per day over the last ${data.length} days`} preserveAspectRatio="none">
        {[0, 0.5, 1].map((ratio) => {
          const y = padding.top + innerH * (1 - ratio);
          return (
            <g key={ratio}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="os-grid-line" />
              <text x={2} y={y + 4} className="os-axis-label">{Math.round(max * ratio)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const barH = (d.count / max) * innerH;
          const x = padding.left + i * gap + (gap - barW) / 2;
          const y = padding.top + innerH - barH;
          return (
            <g key={d.date}>
              <rect x={x} y={y} width={barW} height={Math.max(2, barH)} className="os-bar">
                <title>{`${d.date}: ${d.count} enquiries`}</title>
              </rect>
              {i % Math.max(1, Math.ceil(data.length / 7)) === 0 && (
                <text x={x + barW / 2} y={height - 8} textAnchor="middle" className="os-axis-label">
                  {d.date.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function BarBreakdown({ items, empty = "No data yet" }: { items: BarDatum[]; empty?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="os-empty">{empty}</p>;
  return (
    <div className="os-bars">
      {items.map((item) => (
        <div className="os-bar-row" key={item.label}>
          <span className="os-bar-label">{item.label}</span>
          <div className="os-bar-track"><div className="os-bar-fill" style={{ width: `${(item.value / max) * 100}%` }} /></div>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function Donut({ items }: { items: BarDatum[] }) {
  const total = items.reduce((sum, i) => sum + i.value, 0) || 1;
  const colors = ["var(--accent-color)", "#8f9a7b", "#a6a09a", "#6f7683", "#c9bda8", "#5b5751"];
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const segments = items.map((item, i) => ({
    item,
    length: (item.value / total) * circumference,
    offset: -items.slice(0, i).reduce((sum, prev) => sum + (prev.value / total) * circumference, 0),
    color: colors[i % colors.length],
  }));
  return (
    <div className="os-donut-wrap">
      <svg viewBox="0 0 120 120" className="os-donut" role="img" aria-label="Enquiry status distribution">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--border-color)" strokeWidth="14" />
        {segments.map(({ item, length, offset, color }) => (
          <circle
            key={item.label}
            cx="60" cy="60" r={radius} fill="none"
            stroke={color}
            strokeWidth="14"
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
          >
            <title>{`${item.label}: ${item.value}`}</title>
          </circle>
        ))}
        <text x="60" y="58" textAnchor="middle" className="os-donut-number">{total}</text>
        <text x="60" y="74" textAnchor="middle" className="os-donut-caption">TOTAL</text>
      </svg>
      <ul className="os-legend">
        {items.map((item, i) => (
          <li key={item.label}>
            <span style={{ background: colors[i % colors.length] }} />
            {item.label} <strong>{item.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
