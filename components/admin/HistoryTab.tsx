'use client';

import { useMemo, useState } from 'react';
import { SalesLineChart } from '@/components/ui/SalesLineChart';
import { SellerBarChart } from '@/components/ui/SellerBarChart';
import { currentSales, salesByDay, type Contact, type Period, type Seller } from '@/lib/calc';

interface HistoryTabProps {
  sellers: Seller[];
  contacts: Contact[];
  period: Period;
}

export function HistoryTab({ sellers, contacts, period }: HistoryTabProps) {
  const [sellerFilter, setSellerFilter] = useState<string>('todos');

  const dailySales = useMemo(
    () => salesByDay(sellerFilter === 'todos' ? null : sellerFilter, contacts, period),
    [sellerFilter, contacts, period]
  );

  const bySellerBar = useMemo(
    () => sellers.map((s) => ({ name: s.name, value: currentSales(s, contacts) })),
    [sellers, contacts]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold text-text">Ventas por día</h2>
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
        <h2 className="mb-3 font-display text-sm font-bold text-text">Ventas totales por vendedor</h2>
        <SellerBarChart data={bySellerBar} />
      </div>
    </div>
  );
}
