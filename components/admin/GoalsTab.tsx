'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import type { Period, Seller } from '@/lib/calc';

interface GoalsTabProps {
  sellers: Seller[];
  period: Period;
  onSellersChange: (sellers: Seller[]) => void;
  onPeriodChange: (period: Period) => void;
  supabase: SupabaseClient<Database>;
}

export function GoalsTab({ sellers, period, onSellersChange, onPeriodChange, supabase }: GoalsTabProps) {
  const [periodDraft, setPeriodDraft] = useState(period);
  const [savingPeriod, setSavingPeriod] = useState(false);
  const [savingSeller, setSavingSeller] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Seller>>(
    Object.fromEntries(sellers.map((s) => [s.id, s]))
  );

  async function savePeriod(e: React.FormEvent) {
    e.preventDefault();
    setSavingPeriod(true);
    const { error } = await supabase
      .from('period')
      .update({ name: periodDraft.name, start_date: periodDraft.start_date, end_date: periodDraft.end_date })
      .eq('id', 1);
    if (!error) onPeriodChange(periodDraft);
    setSavingPeriod(false);
  }

  async function saveSeller(id: string) {
    const draft = drafts[id];
    setSavingSeller(id);
    const { error } = await supabase
      .from('sellers')
      .update({
        target: draft.target,
        initial_sales: draft.initial_sales,
        bonus_usd: draft.bonus_usd,
      })
      .eq('id', id);
    if (!error) {
      onSellersChange(sellers.map((s) => (s.id === id ? draft : s)));
    }
    setSavingSeller(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={savePeriod} className="card p-4">
        <h2 className="mb-3 font-display text-sm font-bold text-text">Período</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-xs text-text-secondary">
            Nombre
            <input
              value={periodDraft.name}
              onChange={(e) => setPeriodDraft({ ...periodDraft, name: e.target.value })}
              className="mt-1 w-full rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text focus:border-primary-bright focus:outline-none"
            />
          </label>
          <label className="text-xs text-text-secondary">
            Desde
            <input
              type="date"
              value={periodDraft.start_date}
              onChange={(e) => setPeriodDraft({ ...periodDraft, start_date: e.target.value })}
              className="mt-1 w-full rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text focus:border-primary-bright focus:outline-none"
            />
          </label>
          <label className="text-xs text-text-secondary">
            Hasta
            <input
              type="date"
              value={periodDraft.end_date}
              onChange={(e) => setPeriodDraft({ ...periodDraft, end_date: e.target.value })}
              className="mt-1 w-full rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text focus:border-primary-bright focus:outline-none"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={savingPeriod}
          className="mt-4 rounded-[10px] bg-primary-bright px-4 py-2 text-sm font-medium text-bg hover:brightness-110 disabled:opacity-50"
        >
          {savingPeriod ? 'Guardando…' : 'Guardar período'}
        </button>
      </form>

      {sellers.map((seller) => {
        const draft = drafts[seller.id] ?? seller;
        return (
          <div key={seller.id} className="card p-4">
            <h2 className="mb-3 font-display text-sm font-bold text-text">{seller.name}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-xs text-text-secondary">
                Ventas iniciales
                <input
                  type="number"
                  value={draft.initial_sales}
                  onChange={(e) =>
                    setDrafts({ ...drafts, [seller.id]: { ...draft, initial_sales: Number(e.target.value) } })
                  }
                  className="mt-1 w-full rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text focus:border-primary-bright focus:outline-none"
                />
              </label>
              <label className="text-xs text-text-secondary">
                Objetivo mensual
                <input
                  type="number"
                  value={draft.target}
                  onChange={(e) => setDrafts({ ...drafts, [seller.id]: { ...draft, target: Number(e.target.value) } })}
                  className="mt-1 w-full rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text focus:border-primary-bright focus:outline-none"
                />
              </label>
              <label className="text-xs text-text-secondary">
                Bono (USD)
                <input
                  type="number"
                  value={draft.bonus_usd}
                  onChange={(e) =>
                    setDrafts({ ...drafts, [seller.id]: { ...draft, bonus_usd: Number(e.target.value) } })
                  }
                  className="mt-1 w-full rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text focus:border-primary-bright focus:outline-none"
                />
              </label>
            </div>
            <button
              onClick={() => saveSeller(seller.id)}
              disabled={savingSeller === seller.id}
              className="mt-4 rounded-[10px] bg-primary-bright px-4 py-2 text-sm font-medium text-bg hover:brightness-110 disabled:opacity-50"
            >
              {savingSeller === seller.id ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
