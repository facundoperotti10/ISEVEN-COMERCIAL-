import type { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
}

export function KpiCard({ label, value, sub, accent }: KpiCardProps) {
  return (
    <div className="card p-4">
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="stat-number text-3xl mt-1" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-text-muted">{sub}</div>}
    </div>
  );
}
