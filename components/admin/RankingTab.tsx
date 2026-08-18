'use client';

import { useMemo, useState } from 'react';
import { formatPct, type SellerMetrics } from '@/lib/calc';

interface RankingTabProps {
  metrics: SellerMetrics[];
}

const CRITERIA = [
  { id: 'ventas', label: 'Ventas', get: (m: SellerMetrics) => m.currentSales, format: (v: number) => `${v}` },
  { id: 'cierre', label: '% cierre sobre respondidos', get: (m: SellerMetrics) => m.convRespondidos, format: formatPct },
  { id: 'cumplimiento', label: '% cumplimiento', get: (m: SellerMetrics) => m.cumplimientoPct, format: formatPct },
] as const;

const MEDALS = ['🥇', '🥈', '🥉'];

export function RankingTab({ metrics }: RankingTabProps) {
  const [criterion, setCriterion] = useState<(typeof CRITERIA)[number]['id']>('ventas');
  const active = CRITERIA.find((c) => c.id === criterion)!;

  const sorted = useMemo(
    () => [...metrics].sort((a, b) => active.get(b) - active.get(a)),
    [metrics, active]
  );

  return (
    <div className="card p-4">
      <div className="mb-4 flex flex-wrap gap-2">
        {CRITERIA.map((c) => (
          <button
            key={c.id}
            onClick={() => setCriterion(c.id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              criterion === c.id ? 'bg-primary-bright text-bg' : 'bg-bg-elevated text-text-secondary hover:text-text'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <ol className="flex flex-col gap-2">
        {sorted.map((m, i) => (
          <li key={m.seller.id} className="flex items-center justify-between rounded-[10px] border border-border bg-bg-elevated px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="w-6 text-center text-lg">{MEDALS[i] ?? `${i + 1}º`}</span>
              <span className="font-medium text-text">{m.seller.name}</span>
            </div>
            <span className="stat-number text-lg text-primary-bright">{active.format(active.get(m))}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
