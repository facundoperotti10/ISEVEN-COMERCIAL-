'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import {
  CUPO_HORAS,
  diaHoraAR,
  errorMessage,
  faltaTexto,
  type ReservedUnit,
  type Staff,
  type StockLot,
} from '@/lib/oficina';

interface Props {
  mode: 'admin' | 'staff';
  me?: Staff;
  staff: Staff[];
  lots: StockLot[];
  units: ReservedUnit[];
  supabase: SupabaseClient<Database>;
  onChange: (lots: StockLot[], units: ReservedUnit[]) => void;
  /** Vendedor: arma un pedido de stock con este equipo. */
  onPedir?: (u: ReservedUnit) => void;
}

type Estado = 'local' | 'liberado' | 'vendido';

function estadoDe(u: ReservedUnit, now: number): Estado {
  if (u.status === 'vendido') return 'vendido';
  return new Date(u.release_at).getTime() > now ? 'local' : 'liberado';
}

const emptyRow = { modelo: '', capacidad: '', color: '', imei: '' };

/**
 * Cupo del local: los equipos que se separan de cada caja para el minorista.
 * Durante 72 h son solo del local; después se liberan para todos.
 */
export function CupoLocal({ mode, me, staff, lots, units, supabase, onChange, onPedir }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [msg, setMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState('');
  const [rows, setRows] = useState([emptyRow]);
  const [saving, setSaving] = useState(false);
  const [showSold, setShowSold] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const nameOf = (id: string | null) => staff.find((s) => s.id === id)?.name ?? (id ? id : 'Panel');
  const esLocal = mode === 'admin' || me?.area === 'minorista';

  const resumen = useMemo(() => {
    const r = { local: 0, liberado: 0, hoy: 0 };
    const finDia = new Date();
    finDia.setHours(23, 59, 59, 999);
    units.forEach((u) => {
      const e = estadoDe(u, now);
      if (e === 'local') {
        r.local++;
        if (new Date(u.release_at).getTime() <= finDia.getTime()) r.hoy++;
      } else if (e === 'liberado') r.liberado++;
    });
    return r;
  }, [units, now]);

  const visibleLots = lots
    .filter((l) => units.some((u) => u.lot_id === l.id && (showSold || u.status !== 'vendido')))
    .sort((a, b) => b.received_at.localeCompare(a.received_at));

  async function vender(u: ReservedUnit) {
    const { data, error } = await supabase.rpc('sell_reserved', { p_id: u.id });
    if (error) return setMsg(errorMessage(error));
    const nu = data as ReservedUnit;
    onChange(lots, units.map((x) => (x.id === nu.id ? nu : x)));
  }

  async function quitar(u: ReservedUnit) {
    const { error } = await supabase.from('reserved_units').delete().eq('id', u.id);
    if (error) return setMsg(errorMessage(error));
    onChange(lots, units.filter((x) => x.id !== u.id));
  }

  async function cargarCaja(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const { data: lot, error } = await supabase
      .from('stock_lots')
      .insert({ note: note.trim() || null })
      .select()
      .single();
    if (error || !lot) {
      setSaving(false);
      return setMsg(errorMessage(error));
    }
    const { data: nuevos, error: e2 } = await supabase
      .from('reserved_units')
      .insert(
        rows.map((r) => ({
          lot_id: lot.id,
          modelo: r.modelo.trim(),
          capacidad: r.capacidad.trim() || null,
          color: r.color.trim() || null,
          imei: r.imei || null,
        }))
      )
      .select();
    setSaving(false);
    if (e2 || !nuevos) return setMsg(errorMessage(e2));
    onChange([...lots, lot], [...units, ...nuevos]);
    setRows([emptyRow]);
    setNote('');
    setShowForm(false);
    setMsg(`Listo: ${nuevos.length} equipos separados para el local hasta ${diaHoraAR(nuevos[0].release_at)}.`);
  }

  const input =
    'w-full rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm placeholder:text-text-muted focus:border-primary-bright focus:outline-none';

  return (
    <section className="card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-bold">Cupo del local</h2>
          <p className="text-xs text-text-secondary">
            Equipos separados para el minorista. Durante {CUPO_HORAS} h solo los vende el local; después los puede vender
            cualquiera.
          </p>
        </div>
        {mode === 'admin' && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-[10px] bg-orange px-3 py-2 text-sm font-semibold text-bg"
          >
            {showForm ? 'Cerrar' : 'Cargar caja'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="badge bg-pink/15 text-pink">{resumen.local} del local</span>
        {resumen.hoy > 0 && <span className="badge bg-yellow/15 text-yellow">{resumen.hoy} se liberan hoy</span>}
        <span className="badge bg-green/15 text-green">{resumen.liberado} liberados</span>
      </div>

      {mode === 'staff' && me && (
        <p
          className={`rounded-[10px] px-3 py-2 text-sm ${
            esLocal ? 'bg-pink/10 text-pink' : 'bg-bg-elevated text-text-secondary'
          }`}
        >
          {esLocal
            ? 'Estos equipos son del local: vendelos antes de que se liberen.'
            : 'Los equipos del local se pueden vender recién cuando se liberan.'}
        </p>
      )}

      {msg && (
        <button onClick={() => setMsg(null)} className="rounded-[10px] bg-bg-elevated px-3 py-2 text-left text-sm text-text-secondary">
          {msg}
        </button>
      )}

      {mode === 'admin' && showForm && (
        <form onSubmit={cargarCaja} className="flex flex-col gap-2 rounded-[12px] border border-border p-3">
          <label className="text-xs text-text-muted">
            Caja (opcional)
            <input id="cupo-nota" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Caja 1 de la semana" className={input} />
          </label>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-[10px] bg-bg-elevated/50 p-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
              <input
                id={`cupo-modelo-${i}`}
                required
                placeholder="Modelo"
                value={r.modelo}
                onChange={(e) => setRows((l) => l.map((x, j) => (j === i ? { ...x, modelo: e.target.value } : x)))}
                className={`${input} col-span-2 sm:col-span-1`}
              />
              <input
                id={`cupo-cap-${i}`}
                placeholder="Capacidad"
                value={r.capacidad}
                onChange={(e) => setRows((l) => l.map((x, j) => (j === i ? { ...x, capacidad: e.target.value } : x)))}
                className={input}
              />
              <input
                id={`cupo-color-${i}`}
                placeholder="Color"
                value={r.color}
                onChange={(e) => setRows((l) => l.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))}
                className={input}
              />
              <input
                id={`cupo-imei-${i}`}
                required
                inputMode="numeric"
                maxLength={4}
                pattern="[0-9]{4}"
                placeholder="IMEI (4)"
                value={r.imei}
                onChange={(e) =>
                  setRows((l) => l.map((x, j) => (j === i ? { ...x, imei: e.target.value.replace(/\D/g, '').slice(0, 4) } : x)))
                }
                className={`${input} font-mono`}
              />
              {rows.length > 1 && (
                <button type="button" onClick={() => setRows((l) => l.filter((_, j) => j !== i))} className="text-xs text-text-muted hover:text-red">
                  Quitar
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRows((l) => [...l, emptyRow])}
              className="flex-1 rounded-[10px] border border-dashed border-border px-3 py-2 text-sm text-text-secondary"
            >
              + Agregar otro equipo
            </button>
            <button disabled={saving} className="flex-1 rounded-[10px] bg-primary-bright px-3 py-2 text-sm font-medium text-bg disabled:opacity-50">
              {saving ? 'Guardando…' : `Separar ${rows.length} para el local`}
            </button>
          </div>
        </form>
      )}

      {visibleLots.length === 0 ? (
        <p className="py-3 text-center text-sm text-text-muted">
          {mode === 'admin' ? 'Cuando llegue una caja, tocá "Cargar caja" y separá los equipos del local.' : 'Todavía no hay equipos separados para el local.'}
        </p>
      ) : (
        visibleLots.map((l) => {
          const list = units
            .filter((u) => u.lot_id === l.id && (showSold || u.status !== 'vendido'))
            .sort((a, b) => a.modelo.localeCompare(b.modelo));
          return (
            <div key={l.id} className="flex flex-col gap-1.5">
              <p className="text-[11px] uppercase tracking-wide text-text-muted">
                {l.note ? `${l.note} · ` : ''}Entró {diaHoraAR(l.received_at)}
              </p>
              {list.map((u) => {
                const e = estadoDe(u, now);
                const puede = e !== 'vendido' && (mode === 'admin' || esLocal || e === 'liberado');
                return (
                  <div
                    key={u.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-[10px] px-3 py-2 ${
                      e === 'vendido' ? 'bg-bg-elevated/40 opacity-60' : 'bg-bg-elevated'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text">
                        {u.modelo}
                        {u.capacidad ? ` ${u.capacidad}` : ''}
                        {u.color ? ` · ${u.color}` : ''}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {u.imei && (
                          <>
                            IMEI …<span className="font-mono font-semibold text-text">{u.imei}</span> ·{' '}
                          </>
                        )}
                        {e === 'local' && (
                          <span className="text-pink">Del local · se libera en {faltaTexto(u.release_at, now)}</span>
                        )}
                        {e === 'liberado' && <span className="text-green">Liberado · lo puede vender cualquiera</span>}
                        {e === 'vendido' && <span>Vendido por {nameOf(u.sold_by)}</span>}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      {puede && onPedir && (
                        <button onClick={() => onPedir(u)} className="rounded-full border border-border px-3 py-1 text-xs text-text-secondary">
                          Pedir este
                        </button>
                      )}
                      {puede && (
                        <button onClick={() => vender(u)} className="rounded-full bg-green/20 px-3 py-1 text-xs font-semibold text-green">
                          {mode === 'admin' ? 'Vendido' : 'Lo vendí'}
                        </button>
                      )}
                      {mode === 'admin' && e !== 'vendido' && (
                        <button onClick={() => quitar(u)} className="px-2 text-xs text-text-muted hover:text-red">
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })
      )}

      <label className="flex items-center gap-2 self-start text-xs text-text-muted">
        <input id={`cupo-vendidos-${mode}`} type="checkbox" checked={showSold} onChange={(e) => setShowSold(e.target.checked)} />
        Ver también los vendidos
      </label>
    </section>
  );
}
