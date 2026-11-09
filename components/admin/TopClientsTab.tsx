'use client';

import { useMemo, useState } from 'react';
import {
  accesoriosMasVendidos,
  topClients,
  type AccessorySale,
  type ClientSale,
  type Contact,
  type Period,
  type Seller,
} from '@/lib/calc';

interface TopClientsTabProps {
  contacts: Contact[];
  clientSales: ClientSale[];
  accessorySales?: AccessorySale[];
  sellers: Seller[];
  period: Period;
  today: string;
}

const RANGOS = [
  { id: 'mes', label: 'Este mes' },
  { id: 'anio', label: 'Este año' },
  { id: 'todo', label: 'Desde siempre' },
] as const;

type RangoId = (typeof RANGOS)[number]['id'];

const MEDALS = ['🥇', '🥈', '🥉'];

function waNumber(tel: string): string {
  const d = tel.replace(/\D/g, '').replace(/^0/, '');
  if (d.startsWith('54')) return d;
  return d.length === 10 ? `549${d}` : d;
}

function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${iso}T12:00:00Z`)
  );
}

/** Ranking de clientes que más compran (pensado para mayoristas): para premiar a fin
 *  de año con un obsequio o ir aplicando descuentos a los que más repiten. */
export function TopClientsTab({ contacts, clientSales, accessorySales = [], sellers, period, today }: TopClientsTabProps) {
  const [rango, setRango] = useState<RangoId>('anio');
  const [orden, setOrden] = useState<'equipos' | 'accesorios'>('equipos');
  const [sellerFilter, setSellerFilter] = useState<string>('todos');
  const [search, setSearch] = useState('');
  const sellersById = Object.fromEntries(sellers.map((s) => [s.id, s]));
  const year = today.slice(0, 4);

  const range =
    rango === 'mes'
      ? { start: period.start_date, end: period.end_date }
      : rango === 'anio'
        ? { start: `${year}-01-01`, end: `${year}-12-31` }
        : undefined;

  const rows = useMemo(() => {
    const cs = sellerFilter === 'todos' ? contacts : contacts.filter((c) => c.seller_id === sellerFilter);
    const ss = sellerFilter === 'todos' ? clientSales : clientSales.filter((s) => s.seller_id === sellerFilter);
    const as = sellerFilter === 'todos' ? accessorySales : accessorySales.filter((a) => a.seller_id === sellerFilter);
    const base = topClients(cs, ss, range, as);
    return orden === 'accesorios'
      ? base.filter((r) => r.accesorios > 0).sort((a, b) => b.accesorios - a.accesorios || b.compras - a.compras)
      : base.filter((r) => r.compras > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, clientSales, accessorySales, sellerFilter, rango, orden, period.start_date, period.end_date, year]);

  const accesoriosRango = useMemo(
    () =>
      accessorySales.filter(
        (a) =>
          (sellerFilter === 'todos' || a.seller_id === sellerFilter) &&
          (!range || (a.date >= range.start && a.date <= range.end))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessorySales, sellerFilter, rango, period.start_date, period.end_date, year]
  );
  const topAccesorios = useMemo(() => accesoriosMasVendidos(accesoriosRango).slice(0, 5), [accesoriosRango]);
  const unidadesAccesorios = accesoriosRango.reduce((acc, a) => acc + a.cantidad, 0);

  const q = search.trim().toLowerCase();
  const visibles = q
    ? rows.filter((r) => r.nombre.toLowerCase().includes(q) || (r.telefono ?? '').includes(q))
    : rows;

  const totalCompras = rows.reduce((acc, r) => acc + r.compras, 0);
  const repiten = rows.filter((r) => r.compras >= 2).length;
  const valor = (r: (typeof rows)[number]) => (orden === 'accesorios' ? r.accesorios : r.compras);
  const max = rows[0] ? valor(rows[0]) : 0;
  const rangoLabel = RANGOS.find((r) => r.id === rango)!.label.toLowerCase();

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          {RANGOS.map((r) => (
            <button
              key={r.id}
              onClick={() => setRango(r.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                rango === r.id ? 'bg-primary-bright text-bg' : 'bg-bg-elevated text-text-secondary hover:text-text'
              }`}
            >
              {r.label}
            </button>
          ))}
          <select
            value={sellerFilter}
            onChange={(e) => setSellerFilter(e.target.value)}
            className="rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text focus:border-primary-bright focus:outline-none"
          >
            <option value="todos">Todos los vendedores</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente o teléfono"
            className="min-w-[200px] flex-1 rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary-bright focus:outline-none"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-muted">Ordenar por</span>
          {(
            [
              ['equipos', 'Equipos'],
              ['accesorios', 'Accesorios'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setOrden(id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                orden === id ? 'bg-primary-bright/20 text-text' : 'bg-bg-elevated text-text-secondary hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: orden === 'accesorios' ? 'Clientes con accesorios' : 'Clientes que compraron', value: rows.length },
            { label: 'Equipos vendidos', value: totalCompras },
            { label: 'Clientes que repitieron', value: repiten },
            { label: 'Accesorios (unidades)', value: unidadesAccesorios },
          ].map((k) => (
            <div key={k.label} className="rounded-[10px] border border-border bg-bg-elevated px-3 py-2.5">
              <div className="stat-number text-xl text-text">{k.value}</div>
              <div className="text-[11px] text-text-muted">{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {topAccesorios.length > 0 && (
        <div className="card p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-text">Accesorios más vendidos ({rangoLabel})</h3>
          <ul className="flex flex-col gap-1.5">
            {topAccesorios.map((a) => (
              <li key={a.descripcion} className="flex items-center justify-between text-sm">
                <span className="text-text">{a.descripcion}</span>
                <span className="stat-number text-lilac">{a.cantidad}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-4">
        <p className="mb-3 text-xs text-text-muted">
          {orden === 'accesorios'
            ? `Clientes ordenados por unidades de accesorios (${rangoLabel}). Los accesorios no suman al objetivo de equipos.`
            : `Clientes ordenados por cantidad de compras de equipos (${rangoLabel}). Cada cliente vendido cuenta 1 compra y cada "venta repetida" suma otra. Si un cliente se cargó más de una vez con el mismo teléfono, se cuenta junto.`}
        </p>

        <ol className="flex flex-col gap-2">
          {visibles.map((r) => {
            const pos = rows.indexOf(r);
            return (
              <li key={r.key} className="rounded-[10px] border border-border bg-bg-elevated px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 flex-none text-center text-lg">{MEDALS[pos] ?? `${pos + 1}º`}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-medium text-text">{r.nombre}</span>
                      {r.accesorios > 0 && orden === 'equipos' && (
                        <span className="rounded-full bg-lilac/15 px-2 py-0.5 text-[10px] font-semibold text-lilac">
                          {r.accesorios} accesorio{r.accesorios === 1 ? '' : 's'}
                        </span>
                      )}
                      {r.compras >= 2 && (
                        <span className="rounded-full bg-green/15 px-2 py-0.5 text-[10px] font-semibold text-green">Repite</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-text-muted">
                      {r.telefono ? (
                        <a
                          href={`https://wa.me/${waNumber(r.telefono)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary-bright hover:underline"
                        >
                          {r.telefono}
                        </a>
                      ) : (
                        <span>Sin teléfono</span>
                      )}
                      <span>{r.sellerIds.map((id) => sellersById[id]?.name ?? id).join(', ')}</span>
                      <span>Última compra: {fechaCorta(r.ultimaCompra)}</span>
                      <span>Cliente desde: {fechaCorta(r.primeraCompra)}</span>
                    </div>
                  </div>
                  <div className="flex-none text-right">
                    <div className={`stat-number text-2xl ${orden === 'accesorios' ? 'text-lilac' : 'text-primary-bright'}`}>
                      {valor(r)}
                    </div>
                    <div className="text-[10px] text-text-muted">
                      {orden === 'accesorios'
                        ? r.accesorios === 1
                          ? 'accesorio'
                          : 'accesorios'
                        : r.compras === 1
                          ? 'compra'
                          : 'compras'}
                    </div>
                    {orden === 'equipos' && rango !== 'todo' && r.comprasTotal !== r.compras && (
                      <div className="text-[10px] text-text-muted">{r.comprasTotal} en total</div>
                    )}
                  </div>
                </div>
                <div className="ml-11 mt-2 h-1.5 overflow-hidden rounded-full bg-bg">
                  <div className="h-full rounded-full bg-primary-bright" style={{ width: `${max ? (valor(r) / max) * 100 : 0}%` }} />
                </div>
              </li>
            );
          })}
          {visibles.length === 0 && (
            <li className="py-6 text-center text-sm text-text-muted">
              {rows.length === 0 ? 'Todavía no hay compras en este período.' : 'Ningún cliente coincide con la búsqueda.'}
            </li>
          )}
        </ol>
      </div>
    </div>
  );
}
