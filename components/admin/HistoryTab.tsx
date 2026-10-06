'use client';

import { useMemo, useState } from 'react';
import { SalesLineChart } from '@/components/ui/SalesLineChart';
import { SellerBarChart } from '@/components/ui/SellerBarChart';
import { KpiCard } from '@/components/ui/KpiCard';
import {
  contactsInPeriod,
  currentSales,
  formatPct,
  groupHistory,
  pct,
  salesByDay,
  type Contact,
  type Period,
  type PeriodHistoryRow,
  type Seller,
} from '@/lib/calc';

interface HistoryTabProps {
  sellers: Seller[];
  contacts: Contact[];
  period: Period;
  history: PeriodHistoryRow[];
}

export function HistoryTab({ sellers, contacts, period, history }: HistoryTabProps) {
  const [sellerFilter, setSellerFilter] = useState<string>('todos');

  const dailySales = useMemo(
    () => salesByDay(sellerFilter === 'todos' ? null : sellerFilter, contacts, period),
    [sellerFilter, contacts, period]
  );

  const bySellerBar = useMemo(() => {
    const periodContacts = contactsInPeriod(contacts, period);
    return sellers.map((s) => ({ name: s.name, value: currentSales(s, periodContacts) }));
  }, [sellers, contacts, period]);

  const closedMonths = useMemo(() => groupHistory(history), [history]);

  const monthlyTrend = useMemo(
    () =>
      [...closedMonths]
        .sort((a, b) => a.start_date.localeCompare(b.start_date))
        .map((m) => ({ name: m.name, value: m.rows.reduce((s, r) => s + r.sales, 0) })),
    [closedMonths]
  );

  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const activeMonth = closedMonths.find((m) => m.start_date === selectedMonth) ?? closedMonths[0];

  const monthTotals = useMemo(() => {
    if (!activeMonth) return null;
    const totalSales = activeMonth.rows.reduce((s, r) => s + r.sales, 0);
    const totalTarget = activeMonth.rows.reduce((s, r) => s + r.target, 0);
    return { totalSales, totalTarget };
  }, [activeMonth]);

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold text-text">Ventas por día (mes actual)</h2>
          <select
            value={sellerFilter}
            onChange={(e) => setSellerFilter(e.target.value)}
            className="rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text focus:border-primary-bright focus:outline-none"
          >
            <option value="todos">Todo el equipo</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <SalesLineChart data={dailySales} />
      </div>

      <div className="card p-4">
        <h2 className="mb-3 font-display text-sm font-bold text-text">Ventas del mes actual por vendedor</h2>
        <SellerBarChart data={bySellerBar} />
      </div>

      {closedMonths.length === 0 ? (
        <div className="card p-4">
          <h2 className="mb-1 font-display text-sm font-bold text-text">Meses anteriores</h2>
          <p className="text-sm text-text-muted">
            Todavía no se cerró ningún mes — esta sección se va a llenar sola a medida que pasen los meses.
          </p>
        </div>
      ) : (
        <>
          <div className="card p-4">
            <h2 className="mb-3 font-display text-sm font-bold text-text">Evolución del equipo mes a mes</h2>
            <SellerBarChart data={monthlyTrend} color="#C9C6E5" />
          </div>

          <div className="card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-sm font-bold text-text">Mes cerrado</h2>
              <select
                value={activeMonth?.start_date ?? ''}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text focus:border-primary-bright focus:outline-none"
              >
                {closedMonths.map((m) => (
                  <option key={m.start_date} value={m.start_date}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {activeMonth && monthTotals && (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <KpiCard label="Ventas del equipo" value={monthTotals.totalSales} />
                  <KpiCard label="Objetivo" value={monthTotals.totalTarget} />
                  <KpiCard label="Cumplimiento" value={formatPct(pct(monthTotals.totalSales, monthTotals.totalTarget))} />
                </div>

                <SellerBarChart data={activeMonth.rows.map((r) => ({ name: r.seller_name, value: r.sales }))} />

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-text-muted">
                        <th className="py-2 pr-3 font-normal">Vendedor</th>
                        <th className="py-2 pr-3 font-normal">Ventas</th>
                        <th className="py-2 pr-3 font-normal">Objetivo</th>
                        <th className="py-2 pr-3 font-normal">Consultas</th>
                        <th className="py-2 pr-3 font-normal">Respondieron</th>
                        <th className="py-2 pr-3 font-normal">Bono</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeMonth.rows.map((r) => (
                        <tr key={r.id} className="border-t border-border">
                          <td className="py-2 pr-3 text-text">{r.seller_name}</td>
                          <td className="py-2 pr-3 text-text-secondary">{r.sales}</td>
                          <td className="py-2 pr-3 text-text-secondary">{r.target}</td>
                          <td className="py-2 pr-3 text-text-secondary">{r.consultas}</td>
                          <td className="py-2 pr-3 text-text-secondary">{r.respondidos}</td>
                          <td className="py-2 pr-3">
                            <span
                              className="badge"
                              style={{
                                background: r.reached ? '#4ADE8022' : '#F8717122',
                                color: r.reached ? '#4ADE80' : '#F87171',
                              }}
                            >
                              {r.reached ? `USD ${r.bonus_usd} ✓` : 'Sin bono'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
