'use client';

import { useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import {
  CONDICIONES,
  UBICACIONES,
  UBICACION_LABEL,
  costoNum,
  formatUSD,
  resumenPorModelo,
  siguienteNumero,
  totalesItems,
  totalesPorUbicacion,
  type PedidoEntrante,
  type PedidoItem,
  type Ubicacion,
} from '@/lib/importacion';

interface StockEnCaminoTabProps {
  pedidos: PedidoEntrante[];
  items: PedidoItem[];
  today: string;
  supabase: SupabaseClient<Database>;
  onChange: (pedidos: PedidoEntrante[], items: PedidoItem[]) => void;
}

type Filtro = 'camino' | Ubicacion | 'todos';

const input =
  'rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary-bright focus:outline-none';

type ItemDraft = { modelo: string; condicion: string; color: string; cantidad: string; costo: string };
const ITEM_VACIO: ItemDraft = { modelo: '', condicion: 'Sellado', color: '', cantidad: '1', costo: '' };

function errorTexto(e: { message?: string } | null): string {
  return `No se pudo guardar: ${e?.message ?? 'sin respuesta del servidor'}`;
}

function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${iso}T12:00:00Z`)
  );
}

/** Valida una fila de ítem; devuelve el ítem listo para guardar o un texto de error. */
function parseItem(d: ItemDraft): { ok: true; value: Omit<PedidoItem, 'id' | 'pedido_id' | 'reservado'> } | { ok: false; error: string } {
  const cantidad = Number.parseInt(d.cantidad, 10);
  const costo = Number.parseFloat(d.costo.replace(',', '.'));
  if (!d.modelo.trim()) return { ok: false, error: 'Falta el modelo.' };
  if (!Number.isFinite(cantidad) || cantidad < 1) return { ok: false, error: `Cantidad inválida en ${d.modelo}.` };
  if (!Number.isFinite(costo) || costo < 0) return { ok: false, error: `Costo inválido en ${d.modelo}.` };
  return { ok: true, value: { modelo: d.modelo.trim(), condicion: d.condicion, color: d.color.trim(), cantidad, costo } };
}

function ItemFields({ d, onChange, modelos }: { d: ItemDraft; onChange: (d: ItemDraft) => void; modelos: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_80px_110px]">
      <input
        list="pe-modelos"
        placeholder="Modelo (ej: iPhone 15 Pro 256)"
        value={d.modelo}
        onChange={(e) => onChange({ ...d, modelo: e.target.value })}
        className={`${input} col-span-2 sm:col-span-1`}
      />
      <datalist id="pe-modelos">
        {modelos.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <select value={d.condicion} onChange={(e) => onChange({ ...d, condicion: e.target.value })} className={input}>
        {CONDICIONES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input placeholder="Color" value={d.color} onChange={(e) => onChange({ ...d, color: e.target.value })} className={input} />
      <input
        type="number"
        min={1}
        inputMode="numeric"
        aria-label="Cantidad"
        placeholder="Cant."
        value={d.cantidad}
        onChange={(e) => onChange({ ...d, cantidad: e.target.value })}
        className={input}
      />
      <input
        inputMode="decimal"
        aria-label="Costo USD por unidad"
        placeholder="USD c/u"
        value={d.costo}
        onChange={(e) => onChange({ ...d, costo: e.target.value })}
        className={input}
      />
    </div>
  );
}

/** Panel de stock en camino: plata y equipos de los pedidos de USA a Argentina. */
export function StockEnCaminoTab({ pedidos, items, today, supabase, onChange }: StockEnCaminoTabProps) {
  const [filtro, setFiltro] = useState<Filtro>('camino');
  const [vista, setVista] = useState<'pedidos' | 'modelos'>('pedidos');
  const [nuevo, setNuevo] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { por, enCamino } = useMemo(() => totalesPorUbicacion(pedidos, items), [pedidos, items]);
  const modelos = useMemo(() => [...new Set(items.map((i) => i.modelo.trim()))].sort(), [items]);

  const visibles = useMemo(
    () =>
      pedidos
        .filter((p) => (filtro === 'todos' ? true : filtro === 'camino' ? p.ubicacion !== 'ofi' : p.ubicacion === filtro))
        .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numero - a.numero),
    [pedidos, filtro]
  );
  const idsVisibles = useMemo(() => new Set(visibles.map((p) => p.id)), [visibles]);
  const itemsVisibles = useMemo(() => items.filter((i) => idsVisibles.has(i.pedido_id)), [items, idsVisibles]);
  const porModelo = useMemo(() => resumenPorModelo(itemsVisibles), [itemsVisibles]);

  async function moverPedido(p: PedidoEntrante, ubicacion: Ubicacion) {
    setError(null);
    const { data, error: e } = await supabase.from('pedidos_entrantes').update({ ubicacion }).eq('id', p.id).select().single();
    if (e || !data) return setError(errorTexto(e));
    onChange(
      pedidos.map((x) => (x.id === p.id ? (data as PedidoEntrante) : x)),
      items
    );
  }

  async function borrarPedido(p: PedidoEntrante) {
    if (!window.confirm(`¿Borrar el pedido #${p.numero} con todos sus ítems? No se puede deshacer.`)) return;
    setError(null);
    const { error: e } = await supabase.from('pedidos_entrantes').delete().eq('id', p.id);
    if (e) return setError(errorTexto(e));
    onChange(
      pedidos.filter((x) => x.id !== p.id),
      items.filter((i) => i.pedido_id !== p.id)
    );
  }

  async function cambiarReservado(it: PedidoItem, reservado: number) {
    const valor = Math.max(0, Math.min(it.cantidad, reservado));
    if (valor === it.reservado) return;
    setError(null);
    onChange(pedidos, items.map((x) => (x.id === it.id ? { ...x, reservado: valor } : x)));
    const { error: e } = await supabase.from('pedidos_entrantes_items').update({ reservado: valor }).eq('id', it.id);
    if (e) {
      setError(errorTexto(e));
      onChange(pedidos, items);
    }
  }

  async function borrarItem(it: PedidoItem) {
    if (!window.confirm(`¿Borrar ${it.cantidad} × ${it.modelo}?`)) return;
    setError(null);
    const { error: e } = await supabase.from('pedidos_entrantes_items').delete().eq('id', it.id);
    if (e) return setError(errorTexto(e));
    onChange(pedidos, items.filter((x) => x.id !== it.id));
  }

  async function agregarItem(pedidoId: string, d: ItemDraft): Promise<string | null> {
    const parsed = parseItem(d);
    if (!parsed.ok) return parsed.error;
    const { data, error: e } = await supabase
      .from('pedidos_entrantes_items')
      .insert({ ...parsed.value, pedido_id: pedidoId })
      .select()
      .single();
    if (e || !data) return errorTexto(e);
    onChange(pedidos, [...items, data as PedidoItem]);
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Plata en camino', value: formatUSD(enCamino.usd), color: 'text-orange' },
          { label: 'Equipos en camino', value: enCamino.unidades, color: 'text-text' },
          { label: 'Vendidos en preventa', value: enCamino.reservadas, color: 'text-green' },
          { label: 'Libres para vender', value: enCamino.disponibles, color: 'text-primary-bright' },
        ].map((k) => (
          <div key={k.label} className="card px-4 py-3">
            <div className="text-xs text-text-secondary">{k.label}</div>
            <div className={`stat-number mt-1 text-2xl ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-bold text-text">Dónde está cada cosa</h2>
          <div className="flex gap-1.5">
            {(
              [
                ['camino', 'En camino'],
                ['todos', 'Todos'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFiltro(id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  filtro === id ? 'bg-primary-bright text-bg' : 'bg-bg-elevated text-text-secondary hover:text-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {UBICACIONES.map((u, i) => {
            const t = por[u.id];
            const activo = filtro === u.id;
            return (
              <button
                key={u.id}
                onClick={() => setFiltro(activo ? 'camino' : u.id)}
                className={`relative rounded-[12px] border px-3 py-3 text-left transition ${
                  activo ? 'border-primary-bright bg-primary-bright/15' : 'border-border bg-bg-elevated hover:border-primary-bright/60'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span>{u.emoji}</span>
                  <span>{u.label}</span>
                  {i < 3 && <span className="ml-auto hidden text-text-muted sm:inline">→</span>}
                </div>
                <div className="stat-number mt-1 text-xl text-text">{t.unidades}</div>
                <div className="text-[11px] text-text-muted">
                  {t.pedidos} {t.pedidos === 1 ? 'pedido' : 'pedidos'} · {formatUSD(t.usd)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['pedidos', 'Pedidos'],
            ['modelos', 'Por modelo'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setVista(id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              vista === id ? 'bg-primary-bright/20 text-text' : 'text-text-secondary hover:bg-bg-elevated hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="text-xs text-text-muted">
          · {filtro === 'camino' ? 'En camino' : filtro === 'todos' ? 'Todos' : UBICACION_LABEL[filtro]}
        </span>
        {!nuevo && (
          <button
            onClick={() => setNuevo(true)}
            className="ml-auto rounded-[10px] bg-primary-bright px-3.5 py-2 text-sm font-medium text-bg hover:brightness-110"
          >
            + Nuevo pedido
          </button>
        )}
      </div>

      {error && <p className="select-all rounded-[10px] border border-red/40 bg-red/10 px-3 py-2 text-xs text-red">{error}</p>}

      {nuevo && (
        <NuevoPedido
          numero={siguienteNumero(pedidos)}
          today={today}
          modelos={modelos}
          supabase={supabase}
          onCancel={() => setNuevo(false)}
          onCreated={(p, its, aviso) => {
            onChange([...pedidos, p], [...items, ...its]);
            setNuevo(false);
            setAbierto(p.id);
            setError(aviso ?? null);
          }}
        />
      )}

      {vista === 'pedidos' && (
        <ul className="flex flex-col gap-2">
          {visibles.map((p) => {
            const its = items.filter((i) => i.pedido_id === p.id);
            const t = totalesItems(its);
            const isOpen = abierto === p.id;
            const idx = UBICACIONES.findIndex((u) => u.id === p.ubicacion);
            const siguiente = UBICACIONES[idx + 1];
            return (
              <li key={p.id} className="card overflow-hidden">
                <button
                  onClick={() => setAbierto(isOpen ? null : p.id)}
                  aria-expanded={isOpen}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-bg-elevated"
                >
                  <span className="font-display text-base font-bold text-text">#{p.numero}</span>
                  <span className="text-xs text-text-secondary">{fechaCorta(p.fecha)}</span>
                  {p.proveedor && <span className="text-xs text-text-secondary">· {p.proveedor}</span>}
                  <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-[11px] text-text-secondary">
                    {UBICACIONES[idx]?.emoji} {UBICACION_LABEL[p.ubicacion]}
                  </span>
                  <span className="ml-auto text-right">
                    <span className="stat-number text-text">{t.unidades}</span>
                    <span className="text-xs text-text-muted"> equipos · </span>
                    <span className="stat-number text-orange">{formatUSD(t.usd)}</span>
                  </span>
                </button>

                {isOpen && (
                  <div className="flex flex-col gap-3 border-t border-border bg-bg-elevated/40 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-text-muted">Está en:</span>
                      <select
                        value={p.ubicacion}
                        onChange={(e) => moverPedido(p, e.target.value as Ubicacion)}
                        className={`${input} py-1.5`}
                      >
                        {UBICACIONES.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.emoji} {u.label}
                          </option>
                        ))}
                      </select>
                      {siguiente && (
                        <button
                          onClick={() => moverPedido(p, siguiente.id)}
                          className="rounded-[10px] bg-green/15 px-3 py-1.5 text-xs font-semibold text-green"
                        >
                          Llegó a {siguiente.label} →
                        </button>
                      )}
                      <span className="ml-auto text-[11px] text-text-muted">
                        {t.reservadas} vendidos en preventa · {t.disponibles} libres
                      </span>
                    </div>
                    {p.notas && <p className="text-xs text-text-secondary">📝 {p.notas}</p>}

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[620px] text-sm">
                        <thead>
                          <tr className="text-left text-xs text-text-muted">
                            <th className="py-1.5 pr-3 font-normal">Modelo</th>
                            <th className="py-1.5 pr-3 font-normal">Condición</th>
                            <th className="py-1.5 pr-3 font-normal">Color</th>
                            <th className="py-1.5 pr-3 text-right font-normal">Cant.</th>
                            <th className="py-1.5 pr-3 text-right font-normal">USD c/u</th>
                            <th className="py-1.5 pr-3 text-right font-normal">Subtotal</th>
                            <th className="py-1.5 pr-3 text-center font-normal">Preventa</th>
                            <th className="py-1.5 font-normal" />
                          </tr>
                        </thead>
                        <tbody>
                          {its.map((it) => (
                            <tr key={it.id} className="border-t border-border">
                              <td className="py-2 pr-3 text-text">{it.modelo}</td>
                              <td className="py-2 pr-3 text-text-secondary">{it.condicion}</td>
                              <td className="py-2 pr-3 text-text-secondary">{it.color || '—'}</td>
                              <td className="py-2 pr-3 text-right text-text">{it.cantidad}</td>
                              <td className="py-2 pr-3 text-right text-text-secondary">{formatUSD(costoNum(it.costo))}</td>
                              <td className="py-2 pr-3 text-right text-text">{formatUSD(it.cantidad * costoNum(it.costo))}</td>
                              <td className="py-2 pr-3">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => cambiarReservado(it, it.reservado - 1)}
                                    disabled={it.reservado <= 0}
                                    aria-label="Uno menos vendido en preventa"
                                    className="h-6 w-6 rounded-full bg-bg text-text-secondary disabled:opacity-30"
                                  >
                                    −
                                  </button>
                                  <span className="w-12 text-center text-xs text-text">
                                    {it.reservado}/{it.cantidad}
                                  </span>
                                  <button
                                    onClick={() => cambiarReservado(it, it.reservado + 1)}
                                    disabled={it.reservado >= it.cantidad}
                                    aria-label="Uno más vendido en preventa"
                                    className="h-6 w-6 rounded-full bg-green/15 text-green disabled:opacity-30"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td className="py-2 text-right">
                                <button onClick={() => borrarItem(it)} className="text-xs text-text-muted hover:text-red">
                                  Borrar
                                </button>
                              </td>
                            </tr>
                          ))}
                          {its.length === 0 && (
                            <tr>
                              <td colSpan={8} className="py-3 text-center text-xs text-text-muted">
                                Este pedido todavía no tiene equipos cargados.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <AgregarItem modelos={modelos} onAdd={(d) => agregarItem(p.id, d)} />

                    <div className="flex justify-end">
                      <button onClick={() => borrarPedido(p)} className="text-xs text-text-muted hover:text-red">
                        Borrar pedido
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
          {visibles.length === 0 && (
            <li className="card py-8 text-center text-sm text-text-muted">
              {pedidos.length === 0 ? 'Todavía no cargaste ningún pedido. Tocá “+ Nuevo pedido”.' : 'No hay pedidos en esta ubicación.'}
            </li>
          )}
        </ul>
      )}

      {vista === 'modelos' && (
        <div className="card p-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs text-text-muted">
                  <th className="py-1.5 pr-3 font-normal">Modelo</th>
                  <th className="py-1.5 pr-3 font-normal">Condición</th>
                  <th className="py-1.5 pr-3 text-right font-normal">Total</th>
                  <th className="py-1.5 pr-3 text-right font-normal">Preventa</th>
                  <th className="py-1.5 pr-3 text-right font-normal">Libres</th>
                  <th className="py-1.5 pr-3 text-right font-normal">Costo prom.</th>
                  <th className="py-1.5 text-right font-normal">Invertido</th>
                </tr>
              </thead>
              <tbody>
                {porModelo.map((m) => (
                  <tr key={`${m.modelo}|${m.condicion}`} className="border-t border-border">
                    <td className="py-2 pr-3 text-text">{m.modelo}</td>
                    <td className="py-2 pr-3 text-text-secondary">{m.condicion}</td>
                    <td className="py-2 pr-3 text-right text-text">{m.unidades}</td>
                    <td className="py-2 pr-3 text-right text-green">{m.reservadas}</td>
                    <td className="py-2 pr-3 text-right text-primary-bright">{m.disponibles}</td>
                    <td className="py-2 pr-3 text-right text-text-secondary">{formatUSD(Math.round(m.costoPromedio * 100) / 100)}</td>
                    <td className="py-2 text-right text-orange">{formatUSD(m.usd)}</td>
                  </tr>
                ))}
                {porModelo.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-xs text-text-muted">
                      No hay equipos en esta ubicación.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function AgregarItem({ modelos, onAdd }: { modelos: string[]; onAdd: (d: ItemDraft) => Promise<string | null> }) {
  const [abierto, setAbierto] = useState(false);
  const [d, setD] = useState<ItemDraft>(ITEM_VACIO);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="self-start text-xs font-semibold text-primary-bright">
        + Agregar equipo a este pedido
      </button>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        const err = await onAdd(d);
        setSaving(false);
        setError(err);
        if (!err) {
          setD(ITEM_VACIO);
          setAbierto(false);
        }
      }}
      className="flex flex-col gap-2 rounded-[10px] border border-border bg-bg p-3"
    >
      <ItemFields d={d} onChange={setD} modelos={modelos} />
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded-[10px] bg-primary-bright px-3 py-1.5 text-sm font-medium text-bg disabled:opacity-50">
          {saving ? 'Guardando…' : 'Agregar'}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="px-2 text-xs text-text-muted hover:text-text">
          Cancelar
        </button>
      </div>
      {error && <p className="select-all text-xs text-red">{error}</p>}
    </form>
  );
}

function NuevoPedido({
  numero,
  today,
  modelos,
  supabase,
  onCancel,
  onCreated,
}: {
  numero: number;
  today: string;
  modelos: string[];
  supabase: SupabaseClient<Database>;
  onCancel: () => void;
  onCreated: (p: PedidoEntrante, items: PedidoItem[], aviso?: string) => void;
}) {
  const [num, setNum] = useState(String(numero));
  const [fecha, setFecha] = useState(today);
  const [proveedor, setProveedor] = useState('');
  const [ubicacion, setUbicacion] = useState<Ubicacion>('usa');
  const [notas, setNotas] = useState('');
  const [filas, setFilas] = useState<ItemDraft[]>([{ ...ITEM_VACIO }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalUsd = filas.reduce((acc, f) => {
    const c = Number.parseInt(f.cantidad, 10);
    const u = Number.parseFloat(f.costo.replace(',', '.'));
    return acc + (Number.isFinite(c) && Number.isFinite(u) ? c * u : 0);
  }, 0);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = Number.parseInt(num, 10);
    if (!Number.isFinite(n) || n < 1) return setError('Poné un número de pedido válido.');
    const llenas = filas.filter((f) => f.modelo.trim() || f.costo.trim());
    const valores: Omit<PedidoItem, 'id' | 'pedido_id' | 'reservado'>[] = [];
    for (const f of llenas) {
      const r = parseItem(f);
      if (!r.ok) return setError(r.error);
      valores.push(r.value);
    }

    setSaving(true);
    const { data: pedido, error: e1 } = await supabase
      .from('pedidos_entrantes')
      .insert({ numero: n, fecha, proveedor: proveedor.trim(), ubicacion, notas: notas.trim() })
      .select()
      .single();
    if (e1 || !pedido) {
      setSaving(false);
      return setError(
        e1?.code === '23505' ? `Ya existe un pedido con el número ${n}.` : errorTexto(e1)
      );
    }
    let creados: PedidoItem[] = [];
    if (valores.length > 0) {
      const { data: its, error: e2 } = await supabase
        .from('pedidos_entrantes_items')
        .insert(valores.map((v) => ({ ...v, pedido_id: pedido.id })))
        .select();
      if (e2 || !its) {
        setSaving(false);
        onCreated(
          pedido as PedidoEntrante,
          [],
          `El pedido #${n} se creó, pero sus equipos no se guardaron (${e2?.message ?? 'sin respuesta'}). Cargalos con "+ Agregar equipo".`
        );
        return;
      }
      creados = its as PedidoItem[];
    }
    setSaving(false);
    onCreated(pedido as PedidoEntrante, creados);
  }

  return (
    <form onSubmit={guardar} className="card flex flex-col gap-3 border-primary-bright/50 p-4">
      <h3 className="font-display text-sm font-bold text-text">Nuevo pedido</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Número
          <input inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Proveedor
          <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Opcional" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Dónde está
          <select value={ubicacion} onChange={(e) => setUbicacion(e.target.value as Ubicacion)} className={input}>
            {UBICACIONES.map((u) => (
              <option key={u.id} value={u.id}>
                {u.emoji} {u.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas (opcional)" className={input} />

      <div className="flex flex-col gap-2">
        <span className="text-xs text-text-secondary">Equipos del pedido</span>
        {filas.map((f, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1">
              <ItemFields d={f} modelos={modelos} onChange={(d) => setFilas(filas.map((x, j) => (j === i ? d : x)))} />
            </div>
            {filas.length > 1 && (
              <button
                type="button"
                onClick={() => setFilas(filas.filter((_, j) => j !== i))}
                aria-label="Quitar fila"
                className="mt-2 text-text-muted hover:text-red"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setFilas([...filas, { ...ITEM_VACIO, condicion: filas[filas.length - 1]?.condicion ?? 'Sellado' }])}
          className="self-start text-xs font-semibold text-primary-bright"
        >
          + Otra fila
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={saving} className="rounded-[10px] bg-primary-bright px-4 py-2 text-sm font-medium text-bg disabled:opacity-50">
          {saving ? 'Guardando…' : 'Guardar pedido'}
        </button>
        <button type="button" onClick={onCancel} className="px-2 text-sm text-text-muted hover:text-text">
          Cancelar
        </button>
        <span className="ml-auto text-sm text-text-secondary">
          Total: <span className="stat-number text-orange">{formatUSD(totalUsd)}</span>
        </span>
      </div>
      {error && <p className="select-all text-xs text-red">{error}</p>}
    </form>
  );
}
