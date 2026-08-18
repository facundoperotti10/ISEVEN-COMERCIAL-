'use client';

import { KpiCard } from '@/components/ui/KpiCard';
import { SemaforoBadge } from '@/components/ui/SemaforoBadge';
import {
  buildTeamProjection,
  contactsToCSV,
  diagnosticar,
  DIAGNOSTICO_LABEL,
  formatNumber,
  formatPct,
  type Contact,
  type Period,
  type Seller,
  type SellerMetrics,
  type TeamAverages,
} from '@/lib/calc';

interface SummaryTabProps {
  metrics: SellerMetrics[];
  teamAverages: TeamAverages;
  period: Period;
  contacts: Contact[];
  sellers: Seller[];
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function SummaryTab({ metrics, teamAverages, period, contacts, sellers }: SummaryTabProps) {
  const projection = buildTeamProjection(metrics, period);
  const today = todayISO();
  const sellersById = Object.fromEntries(sellers.map((s) => [s.id, s]));

  const cargaHoy = metrics.map((m) => ({
    seller: m.seller,
    cargo: contacts.some((c) => c.seller_id === m.seller.id && c.date === today),
  }));

  const alertas = metrics
    .map((m) => ({ seller: m.seller, diagnostico: diagnosticar(m, teamAverages) }))
    .filter((a) => a.diagnostico !== 'saludable');

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Ventas del equipo" value={projection.currentSales} sub={`Objetivo: ${projection.target}`} />
        <KpiCard label="Ritmo actual" value={`${formatNumber(projection.paceActual, 2)}/día`} />
        <KpiCard label="Ritmo necesario" value={Number.isFinite(projection.paceNeeded) ? `${formatNumber(projection.paceNeeded, 2)}/día` : '—'} />
        <KpiCard label="Proyección de cierre" value={Math.round(projection.projectedClose)} />
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold text-text">Vendedores</h2>
          <button
            onClick={() => downloadCSV(contactsToCSV(contacts, sellersById), `iseven-clientes-${today}.csv`)}
            className="rounded-[10px] border border-border px-3 py-1.5 text-xs text-text-secondary hover:border-primary-bright hover:text-text"
          >
            Exportar clientes CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs text-text-muted">
                <th className="py-2 pr-3 font-normal">Vendedor</th>
                <th className="py-2 pr-3 font-normal">Ventas</th>
                <th className="py-2 pr-3 font-normal">Objetivo</th>
                <th className="py-2 pr-3 font-normal">Cumplimiento</th>
                <th className="py-2 pr-3 font-normal">Ritmo</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.seller.id} className="border-t border-border">
                  <td className="py-2 pr-3 text-text">{m.seller.name}</td>
                  <td className="py-2 pr-3 text-text-secondary">{m.currentSales}</td>
                  <td className="py-2 pr-3 text-text-secondary">{m.seller.target}</td>
                  <td className="py-2 pr-3 text-text-secondary">{formatPct(m.cumplimientoPct)}</td>
                  <td className="py-2 pr-3">
                    <SemaforoBadge semaforo={m.semaforo} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 font-display text-sm font-bold text-text">Carga de hoy</h2>
        <div className="flex flex-wrap gap-2">
          {cargaHoy.map(({ seller, cargo }) => (
            <span
              key={seller.id}
              className="badge"
              style={{
                background: cargo ? '#4ADE8022' : '#F8717122',
                color: cargo ? '#4ADE80' : '#F87171',
              }}
            >
              <span className="badge-dot" style={{ background: cargo ? '#4ADE80' : '#F87171' }} />
              {seller.name} {cargo ? '· cargó hoy' : '· sin carga'}
            </span>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 font-display text-sm font-bold text-text">Alertas de diagnóstico</h2>
        {alertas.length === 0 ? (
          <p className="text-sm text-text-muted">Todo el equipo está en buen estado.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {alertas.map((a) => (
              <li key={a.seller.id} className="flex items-center justify-between text-sm">
                <span className="text-text">{a.seller.name}</span>
                <span className="text-text-secondary">{DIAGNOSTICO_LABEL[a.diagnostico]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
