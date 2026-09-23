'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { groupHistory, nextMonthPeriod, type Period, type PeriodHistoryRow, type Seller } from '@/lib/calc';

const inputClass =
  'mt-1 w-full rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text focus:border-primary-bright focus:outline-none';

interface GoalsTabProps {
  sellers: Seller[];
  period: Period;
  history: PeriodHistoryRow[];
  onSellersChange: (sellers: Seller[]) => void;
  onPeriodChange: (period: Period) => void;
  supabase: SupabaseClient<Database>;
}

export function GoalsTab({ sellers, period, history, onSellersChange, onPeriodChange, supabase }: GoalsTabProps) {
  const [periodDraft, setPeriodDraft] = useState(period);
  const [savingPeriod, setSavingPeriod] = useState(false);
  const [savingSeller, setSavingSeller] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Seller>>(
    Object.fromEntries(sellers.map((s) => [s.id, s]))
  );

  const [showClose, setShowClose] = useState(false);
  const [newPeriod, setNewPeriod] = useState<Period>(() => nextMonthPeriod(period));
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const closedMonths = groupHistory(history);

  function openClose() {
    setNewPeriod(nextMonthPeriod(period));
    setCloseError(null);
    setShowClose(true);
  }

  async function closeMonth() {
    if (!newPeriod.name.trim() || !newPeriod.start_date || !newPeriod.end_date) {
      setCloseError('Completá nombre, inicio y cierre del nuevo mes.');
      return;
    }
    if (newPeriod.end_date < newPeriod.start_date) {
      setCloseError('La fecha de cierre tiene que ser posterior al inicio.');
      return;
    }
    if (newPeriod.start_date <= period.end_date) {
      setCloseError(`El nuevo mes tiene que empezar después del ${period.end_date}.`);
      return;
    }
    setClosing(true);
    setCloseError(null);
    const { error } = await supabase.rpc('close_period', {
      new_name: newPeriod.name.trim(),
      new_start: newPeriod.start_date,
      new_end: newPeriod.end_date,
    });
    if (error) {
      setCloseError(error.message);
      setClosing(false);
      return;
    }
    // Recarga para traer el período nuevo, los contadores en 0 y el historial actualizado.
    window.location.reload();
  }

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
      <div className="card border-orange p-4">
        <h2 className="mb-1 font-display text-sm font-bold text-text">Cerrar mes y empezar uno nuevo</h2>
        <p className="mb-3 text-xs text-text-secondary">
          Guarda el resultado final de cada vendedor en {period.name} y arranca el mes siguiente con las ventas en 0.
          Los clientes cargados no se borran: siguen todos en la pestaña Clientes. Objetivos y bonos se mantienen.
        </p>
        {!showClose ? (
          <button
            onClick={openClose}
            className="rounded-[10px] bg-orange px-4 py-2 text-sm font-medium text-bg hover:brightness-110"
          >
            Cerrar {period.name}
          </button>
        ) : (
          <div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-xs text-text-secondary">
                Nombre del nuevo mes
                <input
                  value={newPeriod.name}
                  onChange={(e) => setNewPeriod({ ...newPeriod, name: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="text-xs text-text-secondary">
                Desde
                <input
                  type="date"
                  value={newPeriod.start_date}
                  onChange={(e) => setNewPeriod({ ...newPeriod, start_date: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="text-xs text-text-secondary">
                Hasta
                <input
                  type="date"
                  value={newPeriod.end_date}
                  onChange={(e) => setNewPeriod({ ...newPeriod, end_date: e.target.value })}
                  className={inputClass}
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-text-muted">
              No se puede deshacer. Las ventas iniciales de cada vendedor vuelven a 0 para el nuevo mes.
            </p>
            {closeError && <p className="mt-2 text-xs text-red">{closeError}</p>}
            <div className="mt-3 flex gap-2">
              <button
                onClick={closeMonth}
                disabled={closing}
                className="rounded-[10px] bg-orange px-4 py-2 text-sm font-medium text-bg hover:brightness-110 disabled:opacity-50"
              >
                {closing ? 'Cerrando…' : 'Confirmar cierre'}
              </button>
              <button
                onClick={() => setShowClose(false)}
                disabled={closing}
                className="rounded-[10px] border border-border px-4 py-2 text-sm text-text-secondary hover:text-text"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card p-4">
        <h2 className="mb-3 font-display text-sm font-bold text-text">Meses cerrados</h2>
        {closedMonths.length === 0 ? (
          <p className="text-sm text-text-muted">Todavía no se cerró ningún mes.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {closedMonths.map((m) => (
              <div key={m.start_date} className="rounded-[10px] border border-border bg-bg-elevated p-3">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="font-display text-sm font-bold text-text">{m.name}</span>
                  <span className="text-xs text-text-muted">
                    {m.start_date} → {m.end_date}
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {m.rows.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-text">{r.seller_name}</span>
                      <span className="flex items-center gap-2 text-text-secondary">
                        {r.sales}/{r.target}
                        <span
                          className="badge"
                          style={{
                            background: r.reached ? '#4ADE8022' : '#F8717122',
                            color: r.reached ? '#4ADE80' : '#F87171',
                          }}
                        >
                          {r.reached ? `Bono USD ${r.bonus_usd} ✓` : 'Sin bono'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

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
