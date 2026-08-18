'use client';

import { useMemo, useState } from 'react';
import { ESTADOS, ESTADO_LABEL, type Contact, type Seller } from '@/lib/calc';
import type { ContactEstado } from '@/lib/database.types';

interface ContactsTabProps {
  contacts: Contact[];
  sellers: Seller[];
}

export function ContactsTab({ contacts, sellers }: ContactsTabProps) {
  const [sellerFilter, setSellerFilter] = useState<string>('todos');
  const [estadoFilter, setEstadoFilter] = useState<ContactEstado | 'todos'>('todos');
  const sellersById = Object.fromEntries(sellers.map((s) => [s.id, s]));

  const filtered = useMemo(
    () =>
      contacts.filter(
        (c) =>
          (sellerFilter === 'todos' || c.seller_id === sellerFilter) &&
          (estadoFilter === 'todos' || c.estado === estadoFilter)
      ),
    [contacts, sellerFilter, estadoFilter]
  );

  return (
    <div className="card p-4">
      <div className="mb-4 flex flex-wrap gap-2">
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
        <select
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value as ContactEstado | 'todos')}
          className="rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text focus:border-primary-bright focus:outline-none"
        >
          <option value="todos">Todas las etapas</option>
          {ESTADOS.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </select>
        <span className="ml-auto self-center text-xs text-text-muted">{filtered.length} resultados</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-xs text-text-muted">
              <th className="py-2 pr-3 font-normal">Vendedor</th>
              <th className="py-2 pr-3 font-normal">Fecha</th>
              <th className="py-2 pr-3 font-normal">Nombre</th>
              <th className="py-2 pr-3 font-normal">Teléfono</th>
              <th className="py-2 pr-3 font-normal">Estado</th>
              <th className="py-2 pr-3 font-normal">Observación</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="py-2 pr-3 text-text">{sellersById[c.seller_id]?.name ?? c.seller_id}</td>
                <td className="py-2 pr-3 text-text-secondary">{c.date}</td>
                <td className="py-2 pr-3 text-text">{c.nombre}</td>
                <td className="py-2 pr-3 text-text-secondary">{c.telefono || '—'}</td>
                <td className="py-2 pr-3 text-text-secondary">{ESTADO_LABEL[c.estado]}</td>
                <td className="py-2 pr-3 text-text-muted">{c.observacion || '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-text-muted">
                  No hay clientes que coincidan con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
