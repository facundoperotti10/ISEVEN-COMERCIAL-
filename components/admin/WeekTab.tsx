'use client';

import { getWeekRanges, variacionPct, weekMetricsFor, type Contact, type Seller, type WeekMetrics } from '@/lib/calc';

interface WeekTabProps {
  sellers: Seller[];
  contacts: Contact[];
}

const FIELDS: { key: keyof WeekMetrics; label: string }[] = [
  { key: 'ventas', label: 'Ventas' },
  { key: 'consultas', label: 'Consultas' },
  { key: 'respondidos', label: 'Respondieron' },
  { key: 'presupuestos', label: 'Presupuestos' },
  { key: 'seguimientos', label: 'Seguimientos' },
];

function Variation({ current, previous }: { current: number; previous: number }) {
  const v = variacionPct(current, previous);
  if (v === null) return <span className="text-text-muted">—</span>;
  if (v === 0) return <span className="text-text-muted">＝ 0%</span>;
  const up = v > 0;
  return (
    <span style={{ color: up ? '#4ADE80' : '#F87171' }}>
      {up ? '▲' : '▼'} {Math.abs(v).toFixed(0)}%
    </span>
  );
}

export function WeekTab({ sellers, contacts }: WeekTabProps) {
  const { currentStart, currentEnd, previousStart, previousEnd } = getWeekRanges();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-text-muted">
        Semana actual: {currentStart.toLocaleDateString('es-AR')} – {currentEnd.toLocaleDateString('es-AR')} · Semana
        anterior: {previousStart.toLocaleDateString('es-AR')} – {previousEnd.toLocaleDateString('es-AR')}
      </p>

      {sellers.map((seller) => {
        const current = weekMetricsFor(seller.id, contacts, currentStart, currentEnd);
        const previous = weekMetricsFor(seller.id, contacts, previousStart, previousEnd);

        return (
          <div key={seller.id} className="card p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-text">{seller.name}</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-text-muted">
                    <th className="py-2 pr-3 font-normal" />
                    <th className="py-2 pr-3 font-normal">Esta semana</th>
                    <th className="py-2 pr-3 font-normal">Semana anterior</th>
                    <th className="py-2 pr-3 font-normal">Variación</th>
                  </tr>
                </thead>
                <tbody>
                  {FIELDS.map((f) => (
                    <tr key={f.key} className="border-t border-border">
                      <td className="py-2 pr-3 text-text-secondary">{f.label}</td>
                      <td className="py-2 pr-3 text-text">{current[f.key]}</td>
                      <td className="py-2 pr-3 text-text-secondary">{previous[f.key]}</td>
                      <td className="py-2 pr-3">
                        <Variation current={current[f.key]} previous={previous[f.key]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
