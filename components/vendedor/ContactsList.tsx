'use client';

import { ESTADOS, type Contact } from '@/lib/calc';
import type { ContactEstado } from '@/lib/database.types';

interface ContactsListProps {
  contacts: Contact[];
  onUpdate: (id: string, patch: Partial<Pick<Contact, 'estado' | 'observacion'>>) => void;
  onDelete: (id: string) => void;
  emptyMessage?: string;
}

export function ContactsList({ contacts, onUpdate, onDelete, emptyMessage }: ContactsListProps) {
  if (contacts.length === 0) {
    return <p className="text-sm text-text-muted">{emptyMessage ?? 'No hay clientes cargados.'}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="text-left text-xs text-text-muted">
            <th className="py-2 pr-3 font-normal">Fecha</th>
            <th className="py-2 pr-3 font-normal">Nombre</th>
            <th className="py-2 pr-3 font-normal">Teléfono</th>
            <th className="py-2 pr-3 font-normal">Estado</th>
            <th className="py-2 pr-3 font-normal">Observación</th>
            <th className="py-2 pr-3 font-normal" />
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr key={c.id} className="border-t border-border">
              <td className="py-2 pr-3 text-text-muted">{c.date}</td>
              <td className="py-2 pr-3 text-text">{c.nombre}</td>
              <td className="py-2 pr-3 text-text-secondary">{c.telefono || '—'}</td>
              <td className="py-2 pr-3">
                <select
                  value={c.estado}
                  onChange={(e) => onUpdate(c.id, { estado: e.target.value as ContactEstado })}
                  className="rounded-md border border-border bg-bg-elevated px-2 py-1 text-xs text-text focus:border-primary-bright focus:outline-none"
                >
                  {ESTADOS.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-2 pr-3">
                <input
                  defaultValue={c.observacion ?? ''}
                  onBlur={(e) => onUpdate(c.id, { observacion: e.target.value })}
                  className="w-full rounded-md border border-border bg-bg-elevated px-2 py-1 text-xs text-text focus:border-primary-bright focus:outline-none"
                />
              </td>
              <td className="py-2 pr-3 text-right">
                <button
                  onClick={() => onDelete(c.id)}
                  className="text-xs text-red hover:underline"
                >
                  Borrar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
