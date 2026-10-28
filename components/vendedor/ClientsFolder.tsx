'use client';

import { useMemo, useState } from 'react';
import { ESTADOS, ESTADO_LABEL, fuenteOptions, type Contact } from '@/lib/calc';
import type { ContactEstado } from '@/lib/database.types';
import { fechaLarga } from '@/lib/oficina';

const ESTADO_CLASS: Record<ContactEstado, string> = {
  consulta: 'bg-bg text-text-secondary',
  respondio: 'bg-lilac/15 text-lilac',
  presupuesto: 'bg-primary-bright/20 text-text',
  seguimiento: 'bg-yellow/15 text-yellow',
  vendido: 'bg-green/15 text-green',
  perdido: 'bg-red/15 text-red',
};

/** Número para WhatsApp: a los celulares locales (10 dígitos) les agrega 549 (Argentina). */
function waNumber(tel: string): string {
  const d = tel.replace(/\D/g, '').replace(/^0/, '');
  if (d.startsWith('54')) return d;
  return d.length === 10 ? `549${d}` : d;
}

interface Props {
  contacts: Contact[];
  today: string;
  onUpdate: (id: string, patch: Partial<Pick<Contact, 'estado' | 'observacion' | 'fuente'>>) => void;
  onDelete: (id: string) => void;
}

/**
 * Carpeta de clientes: lista compacta (nombre, estado, fecha) con buscador y
 * filtros. Cada cliente se abre para ver y editar el detalle.
 */
export function ClientsFolder({ contacts, today, onUpdate, onDelete }: Props) {
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState<'todos' | ContactEstado>('todos');
  const [cuando, setCuando] = useState<'todo' | 'hoy' | 'fecha'>('todo');
  const [fecha, setFecha] = useState(today);
  const [open, setOpen] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: contacts.length };
    contacts.forEach((x) => (c[x.estado] = (c[x.estado] ?? 0) + 1));
    return c;
  }, [contacts]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return contacts.filter(
      (c) =>
        (estado === 'todos' || c.estado === estado) &&
        (cuando === 'todo' || c.date === (cuando === 'hoy' ? today : fecha)) &&
        (!term || c.nombre.toLowerCase().includes(term) || (c.telefono ?? '').includes(term))
    );
  }, [contacts, q, estado, cuando, fecha, today]);

  const input =
    'rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary-bright focus:outline-none';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          id="clientes-buscar"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o teléfono"
          className={`${input} min-w-0 flex-1`}
        />
        <select id="clientes-cuando" value={cuando} onChange={(e) => setCuando(e.target.value as typeof cuando)} className={input}>
          <option value="todo">Todas las fechas</option>
          <option value="hoy">Hoy</option>
          <option value="fecha">Elegir día</option>
        </select>
        {cuando === 'fecha' && (
          <input id="clientes-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={input} />
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(['todos', ...ESTADOS.map((e) => e.value)] as const).map((v) => (
          <button
            key={v}
            onClick={() => setEstado(v)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              estado === v ? 'bg-primary-bright text-bg' : 'bg-bg-elevated text-text-secondary hover:text-text'
            }`}
          >
            {v === 'todos' ? 'Todos' : ESTADO_LABEL[v]} <span className="opacity-70">{counts[v] ?? 0}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">
          {contacts.length === 0 ? 'Todavía no cargaste clientes.' : 'No hay clientes que coincidan con la búsqueda.'}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-[12px] border border-border">
          {list.map((c) => {
            const isOpen = open === c.id;
            return (
              <li key={c.id} className="bg-bg-elevated/40">
                <button
                  onClick={() => {
                    setOpen(isOpen ? null : c.id);
                    setConfirmDelete(null);
                  }}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-bg-elevated"
                >
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-card font-display text-sm font-bold text-text-secondary">
                    {c.nombre.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text">{c.nombre}</span>
                    <span className="block text-[11px] text-text-muted">
                      {c.date === today ? 'Hoy' : fechaLarga(c.date)}
                      {c.fuente ? ` · ${c.fuente}` : ''}
                    </span>
                  </span>
                  <span className={`badge flex-none ${ESTADO_CLASS[c.estado]}`}>{ESTADO_LABEL[c.estado]}</span>
                  <span className={`flex-none text-text-muted transition ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true">
                    ▾
                  </span>
                </button>

                {isOpen && (
                  <div className="grid gap-3 border-t border-border bg-bg-elevated px-3 py-3 sm:grid-cols-2">
                    <div className="text-sm">
                      <p className="text-[11px] uppercase tracking-wide text-text-muted">Teléfono</p>
                      {c.telefono ? (
                        <p className="mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="select-all text-text">{c.telefono}</span>
                          <a
                            href={`https://wa.me/${waNumber(c.telefono)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full bg-green/15 px-2 py-0.5 text-[11px] font-semibold text-green"
                          >
                            WhatsApp
                          </a>
                        </p>
                      ) : (
                        <p className="mt-0.5 text-text-muted">Sin teléfono</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[11px] uppercase tracking-wide text-text-muted">
                        Estado
                        <select
                          value={c.estado}
                          onChange={(e) => onUpdate(c.id, { estado: e.target.value as ContactEstado })}
                          className={`${input} mt-0.5 block w-full py-1.5 text-xs normal-case tracking-normal`}
                        >
                          {ESTADOS.map((e) => (
                            <option key={e.value} value={e.value}>
                              {e.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[11px] uppercase tracking-wide text-text-muted">
                        Fuente
                        <select
                          value={c.fuente ?? ''}
                          onChange={(e) => onUpdate(c.id, { fuente: e.target.value })}
                          className={`${input} mt-0.5 block w-full py-1.5 text-xs normal-case tracking-normal`}
                        >
                          <option value="">—</option>
                          {fuenteOptions(c.fuente).map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="text-[11px] uppercase tracking-wide text-text-muted sm:col-span-2">
                      Observación
                      <textarea
                        defaultValue={c.observacion ?? ''}
                        onBlur={(e) => {
                          if (e.target.value !== (c.observacion ?? '')) onUpdate(c.id, { observacion: e.target.value });
                        }}
                        rows={2}
                        className={`${input} mt-0.5 block w-full text-sm normal-case tracking-normal`}
                      />
                    </label>
                    <div className="flex justify-end gap-2 sm:col-span-2">
                      {confirmDelete === c.id ? (
                        <>
                          <span className="self-center text-xs text-text-secondary">¿Borrar a {c.nombre}?</span>
                          <button onClick={() => setConfirmDelete(null)} className="rounded-full border border-border px-3 py-1 text-xs">
                            No
                          </button>
                          <button onClick={() => onDelete(c.id)} className="rounded-full bg-red/20 px-3 py-1 text-xs font-semibold text-red">
                            Sí, borrar
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDelete(c.id)} className="text-xs text-text-muted hover:text-red">
                          Borrar cliente
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[11px] text-text-muted">
        {list.length} de {contacts.length} clientes
      </p>
    </div>
  );
}
