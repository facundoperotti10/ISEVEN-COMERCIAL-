'use client';

import { formatPct, pct, type SellerMetrics } from '@/lib/calc';

interface FunnelTabProps {
  metrics: SellerMetrics[];
}

const STAGES: { key: 'consultas' | 'respondidos' | 'presupuestos' | 'seguimientos' | 'ventas'; label: string; color: string }[] = [
  { key: 'consultas', label: 'Consultas', color: '#2A5860' },
  { key: 'respondidos', label: 'Respondieron', color: '#1B5968' },
  { key: 'presupuestos', label: 'Presupuestos', color: '#2C8598' },
  { key: 'seguimientos', label: 'Seguimientos', color: '#C9C6E5' },
  { key: 'ventas', label: 'Ventas', color: '#4ADE80' },
];

export function FunnelTab({ metrics }: FunnelTabProps) {
  return (
    <div className="flex flex-col gap-4">
      {metrics.map((m) => {
        const values = {
          consultas: m.consultas,
          respondidos: m.respondidos,
          presupuestos: m.presupuestos,
          seguimientos: m.seguimientos,
          ventas: m.ventasNuevas,
        };
        const max = Math.max(values.consultas, 1);

        return (
          <div key={m.seller.id} className="card p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-text">{m.seller.name}</h3>
            <div className="flex flex-col gap-2">
              {STAGES.map((stage, i) => {
                const value = values[stage.key];
                const prevValue = i === 0 ? value : values[STAGES[i - 1].key];
                const widthPct = Math.max((value / max) * 100, value > 0 ? 4 : 0);
                const conv = i === 0 ? null : pct(value, prevValue);

                return (
                  <div key={stage.key} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-xs text-text-secondary">{stage.label}</span>
                    <div className="relative h-6 flex-1 rounded-md bg-bg-elevated">
                      <div
                        className="flex h-full items-center rounded-md px-2 text-xs font-medium text-bg"
                        style={{ width: `${widthPct}%`, background: stage.color, minWidth: value > 0 ? 28 : 0 }}
                      >
                        {value}
                      </div>
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs text-text-muted">
                      {conv !== null ? formatPct(conv) : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
