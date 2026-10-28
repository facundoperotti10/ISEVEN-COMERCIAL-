'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, StockStatus, TripSlot } from '@/lib/database.types';
import { StockRequestCard } from '@/components/oficina/StockRequestCard';
import { SLOT_LABEL, errorMessage, fechaLarga, type Staff, type StockRequest } from '@/lib/oficina';

interface Props {
  staff: Staff[];
  requests: StockRequest[];
  today: string;
  supabase: SupabaseClient<Database>;
  onChange: (r: StockRequest[]) => void;
}

const SLOT_ORDER: Record<TripSlot, number> = { urgente: 0, '10:00': 1, '15:00': 2 };

export function StockAdminTab({ staff, requests, today, supabase, onChange }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? id;

  const visible = requests.filter((r) => (showPast ? true : r.trip_date >= today));
  const groups = new Map<string, StockRequest[]>();
  visible
    .slice()
    .sort((a, b) => a.trip_date.localeCompare(b.trip_date) || SLOT_ORDER[a.trip_slot] - SLOT_ORDER[b.trip_slot])
    .forEach((r) => {
      const key = `${r.trip_date}|${r.trip_slot}`;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    });

  async function setStatus(ids: string[], status: StockStatus) {
    const { data: u } = await supabase.auth.getUser();
    const { data, error: e } = await supabase
      .from('stock_requests')
      .update({ status, decided_by: u.user?.id ?? null, decided_at: new Date().toISOString() })
      .in('id', ids)
      .select();
    if (e) return setError(errorMessage(e));
    const byId = new Map((data ?? []).map((r) => [r.id, r]));
    onChange(requests.map((r) => byId.get(r.id) ?? r));
  }

  const pendientes = requests.filter((r) => r.status === 'pendiente' && r.trip_date >= today).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          {pendientes ? `${pendientes} pedidos esperando autorización.` : 'No hay pedidos pendientes.'} Lo de mañana se carga hasta
          las 23:00 (viaje de las 10:00). Lo de hoy, hasta las 14:00 (viaje de las 15:00).
        </p>
        <label className="flex items-center gap-2 text-xs text-text-muted">
          <input id="stock-past" type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
          Ver días anteriores
        </label>
      </div>
      {error && (
        <button onClick={() => setError(null)} className="rounded-[10px] bg-red/15 px-3 py-2 text-left text-sm text-red">
          {error}
        </button>
      )}
      {groups.size === 0 && <p className="card p-4 text-sm text-text-muted">Todavía no hay pedidos de stock.</p>}
      {[...groups.entries()].map(([key, list]) => {
        const [date, slot] = key.split('|') as [string, TripSlot];
        const pend = list.filter((r) => r.status === 'pendiente').map((r) => r.id);
        const aut = list.filter((r) => r.status === 'autorizado').map((r) => r.id);
        return (
          <section key={key} className={`card p-4 ${slot === 'urgente' ? 'border-red/50' : ''}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold">
                {fechaLarga(date)} · {SLOT_LABEL[slot]}
              </h2>
              <div className="flex gap-2">
                {pend.length > 1 && (
                  <button onClick={() => setStatus(pend, 'autorizado')} className="rounded-full bg-green/20 px-3 py-1 text-xs font-semibold text-green">
                    Autorizar todos ({pend.length})
                  </button>
                )}
                {aut.length > 0 && (
                  <button onClick={() => setStatus(aut, 'entregado')} className="rounded-full bg-lilac/20 px-3 py-1 text-xs font-semibold text-lilac">
                    Ya está en la oficina ({aut.length})
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {list.map((r) => (
                <StockRequestCard key={r.id} r={r} who={nameOf(r.staff_id)}>
                  {r.status === 'pendiente' && (
                    <>
                      <button onClick={() => setStatus([r.id], 'autorizado')} className="rounded-full bg-green/20 px-3 py-1 text-xs font-semibold text-green">
                        Autorizar
                      </button>
                      <button onClick={() => setStatus([r.id], 'rechazado')} className="rounded-full border border-red/40 px-3 py-1 text-xs text-red">
                        Rechazar
                      </button>
                    </>
                  )}
                  {r.status === 'autorizado' && (
                    <button onClick={() => setStatus([r.id], 'entregado')} className="rounded-full bg-lilac/20 px-3 py-1 text-xs text-lilac">
                      Ya está en la oficina
                    </button>
                  )}
                </StockRequestCard>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
