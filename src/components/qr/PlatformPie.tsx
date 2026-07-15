'use client';

interface Slice {
  label: string;
  value: number;
  color: string;
}

/**
 * Dependency-free SVG pie chart of the platform split for a campaign's scans.
 * Renders a legend with per-platform counts and percentages.
 */
export function PlatformPie({
  ios,
  android,
  other,
  size = 160
}: {
  ios: number;
  android: number;
  other: number;
  size?: number;
}) {
  const slices: Slice[] = [
    { label: 'iOS', value: ios, color: '#0ea5e9' },
    { label: 'Android', value: android, color: '#22c55e' },
    { label: 'Other', value: other, color: '#9ca3af' }
  ];
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const active = slices.filter((s) => s.value > 0);

  const r = size / 2;
  const cx = r;
  const cy = r;

  let cumulative = 0;
  const arcs = active.map((s) => {
    const start = (cumulative / total) * 2 * Math.PI;
    cumulative += s.value;
    const end = (cumulative / total) * 2 * Math.PI;
    const x1 = cx + r * Math.sin(start);
    const y1 = cy - r * Math.cos(start);
    const x2 = cx + r * Math.sin(end);
    const y2 = cy - r * Math.cos(end);
    const largeArc = end - start > Math.PI ? 1 : 0;
    return {
      key: s.label,
      color: s.color,
      d: `M ${cx} ${cy} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`
    };
  });

  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={r} fill="#e5e7eb" />
        ) : active.length === 1 ? (
          <circle cx={cx} cy={cy} r={r} fill={active[0].color} />
        ) : (
          arcs.map((a) => <path key={a.key} d={a.d} fill={a.color} />)
        )}
      </svg>
      <div className="space-y-2">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-sm">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="w-16 text-gray-600">{s.label}</span>
            <span className="font-semibold text-gray-900">{s.value}</span>
            <span className="text-xs text-gray-400">({pct(s.value)}%)</span>
          </div>
        ))}
        {total === 0 && <div className="text-xs text-gray-400">No scans yet.</div>}
      </div>
    </div>
  );
}
