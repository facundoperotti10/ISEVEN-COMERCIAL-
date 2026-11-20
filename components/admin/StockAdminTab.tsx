'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, StockStatus, TripSlot } from '@/lib/database.types';
import { StockRequestCard } from '@/components/oficina/StockRequestCard';
import { PushToggle } from '@/components/oficina/PushToggle';
import { CupoLocal } from '@/components/oficina/CupoLocal';
import { usePersistentState } from '@/lib/usePersistentState';
import { SLOT_LABEL, dateARPlus, errorMessage, fechaLarga, type Staff, type StockRequest, type ReservedUnit, type StockLot } from '@/lib/oficina';

interface Props {
  staff: Staff[];
  requests: StockRequest[];
  today: string;
  supabase: SupabaseClient<Database>;
  onChange: (r: StockRequest[]) => void;
  lots: StockLot[];
  units: ReservedUnit[];
  onCupoChange: (lots: StockLot[], units: ReservedUnit[]) => void;
}

const SLOT_ORDER: Record<TripSlot, number> = { urgente: 0, '10:00': 1, '15:00': 2 };

type FiltroDia = 'hoy' | 'manana' | 'fecha' | 'atrasados' | 'todos';
type FiltroViaje = 'todos' | TripSlot;
const DIAS: readonly FiltroDia[] = ['hoy', 'manana', 'fecha', 'atrasados', 'todos'];
const VIAJES: readonly FiltroViaje[] = ['todos', 'urgente', '10:00', '15:00'];

function Chip({ on, onClick, children, danger }: { on: boolean; onClick: () => void; children: ReactNode; danger?: boolean }) {
  const base = 'rounded-full px-3.5 py-1.5 text-sm font-medium transition';
  const style = on
    ? danger
      ? 'bg-red text-bg'
      : 'bg-primary-bright text-bg'
    : danger
      ? 'border border-red/40 text-red hover:bg-red/10'
      : 'border border-border text-text-secondary hover:bg-bg-elevated hover:text-text';
  return (
    <button type="button" onClick={onClick} className={`${base} ${style}`}>
      {children}
    </button>
  );
}

export function StockAdminTab({ staff, requests, today, supabase, onChange, lots, units, onCupoChange }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [dia, setDia] = usePersistentState<FiltroDia>('stock-filtro-dia', 'hoy', DIAS);
  const [viaje, setViaje] = usePersistentState<FiltroViaje>('stock-filtro-viaje', 'todos', VIAJES);
  const [fecha, setFecha] = usePersistentState<string>('stock-filtro-fecha', today);
  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? id;
  const manana = dateARPlus(1);

  // Trae los pedidos: los últimos 14 días, todo lo abierto, y el día elegido en el filtro (aunque sea viejo).
  const refrescar = useCallback(async () => {
    let filtro = `trip_date.gte.${dateARPlus(-14)},status.in.(pendiente,autorizado)`;
    if (dia === 'fecha' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) filtro += `,trip_date.eq.${fecha}`;
    const { data } = await supabase.from('stock_requests').select('*').or(filtro).order('trip_date');
    if (data) onChange(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, dia, fecha]);

  // Al elegir un día viejo, lo trae al toque.
  useEffect(() => {
    if (dia === 'fecha' && fecha < dateARPlus(-14)) void refrescar();
  }, [dia, fecha, refrescar]);

  // Se actualiza solo cada minuto y al volver a la app, así los pedidos nuevos aparecen sin recargar.
  useEffect(() => {
    const id = window.setInterval(refrescar, 60_000);
    const onVisible = () => document.visibilityState === 'visible' && refrescar();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refrescar]);

  const term = q.trim().toLowerCase();
  const abierto = (r: StockRequest) => r.status === 'pendiente' || r.status === 'autorizado';
  const atrasados = requests.filter((r) => r.trip_date < today && abierto(r));

  const pasaDia = (r: StockRequest) => {
    if (term) return true; // buscando, se mira todo
    switch (dia) {
      case 'hoy':
        return r.trip_date === today;
      case 'manana':
        return r.trip_date === manana;
      case 'fecha':
        return r.trip_date === fecha;
      case 'atrasados':
        return r.trip_date < today && abierto(r);
      default:
        return true;
    }
  };
  const delDia = requests.filter(pasaDia);
  const cuantos = (v: FiltroViaje) => (v === 'todos' ? delDia.length : delDia.filter((r) => r.trip_slot === v).length);

  const visible = delDia.filter(
    (r) =>
      (viaje === 'todos' || r.trip_slot === viaje) &&
      (!term ||
        (r.imei ?? '').includes(term) ||
        r.cliente.toLowerCase().includes(term) ||
        r.modelo.toLowerCase().includes(term))
  );
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

  const paraLlevar = requests.filter((r) => abierto(r) && r.trip_date >= today).length;

  return (
    <div className="flex flex-col gap-4">
      <PushToggle />
      <CupoLocal mode="admin" staff={staff} lots={lots} units={units} supabase={supabase} onChange={onCupoChange} />
      <h2 className="mt-2 font-display text-base font-bold">Pedidos de los vendedores</h2>
      <p className="text-sm text-text-secondary">
        {paraLlevar ? `${paraLlevar} ${paraLlevar === 1 ? 'pedido para llevar' : 'pedidos para llevar'}.` : 'No hay pedidos para llevar.'} Los pedidos
        entran directo, sin autorizar. Lo que llega tarde pasa al próximo viaje (o urgente, si lo marcan). Se actualiza solo.
      </p>

      <div className="card flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-12 text-xs font-semibold uppercase text-text-muted">Día</span>
          <Chip on={dia === 'hoy'} onClick={() => setDia('hoy')}>Hoy</Chip>
          <Chip on={dia === 'manana'} onClick={() => setDia('manana')}>Mañana</Chip>
          <Chip on={dia === 'todos'} onClick={() => setDia('todos')}>Todos</Chip>
          {atrasados.length > 0 && (
            <Chip danger on={dia === 'atrasados'} onClick={() => setDia('atrasados')}>
              Atrasados ({atrasados.length})
            </Chip>
          )}
          <input
            id="stock-fecha"
            type="date"
            value={fecha}
            onChange={(e) => {
              if (!e.target.value) return;
              setFecha(e.target.value);
              setDia('fecha');
            }}
            className={`rounded-full border px-3 py-1.5 text-sm focus:outline-none ${
              dia === 'fecha' ? 'border-primary-bright bg-primary-bright/15 text-text' : 'border-border bg-bg-elevated text-text-secondary'
            }`}
            aria-label="Elegir un día"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-12 text-xs font-semibold uppercase text-text-muted">Viaje</span>
          <Chip on={viaje === 'todos'} onClick={() => setViaje('todos')}>Todos ({cuantos('todos')})</Chip>
          <Chip on={viaje === 'urgente'} onClick={() => setViaje('urgente')}>Urgente ({cuantos('urgente')})</Chip>
          <Chip on={viaje === '10:00'} onClick={() => setViaje('10:00')}>10:00 ({cuantos('10:00')})</Chip>
          <Chip on={viaje === '15:00'} onClick={() => setViaje('15:00')}>15:00 ({cuantos('15:00')})</Chip>
        </div>
        <input
          id="stock-buscar"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por IMEI, cliente o modelo (busca en todos los días)"
          className="min-w-0 rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm placeholder:text-text-muted focus:border-primary-bright focus:outline-none"
        />
      </div>

      {atrasados.length > 0 && dia !== 'atrasados' && dia !== 'todos' && !term && (
        <button
          onClick={() => setDia('atrasados')}
          className="rounded-[10px] bg-red/15 px-3 py-2 text-left text-sm text-red"
        >
          Ojo: hay {atrasados.length} {atrasados.length === 1 ? 'pedido atrasado' : 'pedidos atrasados'} sin resolver de días
          anteriores. Tocá para verlos.
        </button>
      )}

      {dia === 'atrasados' && atrasados.length > 0 && !term && (
        <button
          onClick={async () => {
            if (!confirm(`¿Marcar los ${atrasados.length} pedidos atrasados como ya entregados? Así desaparecen de la lista.`)) return;
            await setStatus(atrasados.map((r) => r.id), 'entregado');
            setDia('hoy');
          }}
          className="rounded-[10px] bg-lilac/20 px-3 py-2.5 text-sm font-semibold text-lilac"
        >
          Dar por entregados todos los atrasados ({atrasados.length})
        </button>
      )}

      {error && (
        <button onClick={() => setError(null)} className="rounded-[10px] bg-red/15 px-3 py-2 text-left text-sm text-red">
          {error}
        </button>
      )}
      {groups.size === 0 && (
        <p className="card p-4 text-sm text-text-muted">
          {term ? 'No hay pedidos que coincidan con la búsqueda.' : 'No hay pedidos para este filtro.'}
        </p>
      )}
      {[...groups.entries()].map(([key, list]) => {
        const [date, slot] = key.split('|') as [string, TripSlot];
        const abiertos = list.filter(abierto).map((r) => r.id);
        return (
          <section key={key} className={`card p-4 ${slot === 'urgente' ? 'border-red/50' : ''}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold">
                {fechaLarga(date)} · {SLOT_LABEL[slot]}
                {date < today && (
                  <span className="ml-2 rounded-full bg-red/15 px-2 py-0.5 align-middle text-[11px] font-semibold text-red">
                    Atrasado
                  </span>
                )}
              </h2>
              <div className="flex gap-2">
                {abiertos.length > 1 && (
                  <button onClick={() => setStatus(abiertos, 'entregado')} className="rounded-full bg-lilac/20 px-3 py-1 text-xs font-semibold text-lilac">
                    Todos ya en la oficina ({abiertos.length})
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {list.map((r) => (
                <StockRequestCard key={r.id} r={r} who={nameOf(r.staff_id)}>
                  {abierto(r) && (
                    <>
                      <button onClick={() => setStatus([r.id], 'entregado')} className="rounded-full bg-lilac/20 px-3 py-1 text-xs font-semibold text-lilac">
                        Ya está en la oficina
                      </button>
                      <button
                        onClick={() => confirm('¿Cancelar este pedido?') && setStatus([r.id], 'rechazado')}
                        className="px-2 py-1 text-[11px] text-text-muted underline hover:text-red"
                      >
                        Cancelar
                      </button>
                    </>
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
