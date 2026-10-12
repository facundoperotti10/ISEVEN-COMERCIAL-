'use client';

import { useState } from 'react';
import { ESTADOS, type Contact, type SeguimientoPendiente } from '@/lib/calc';
import type { ContactEstado } from '@/lib/database.types';

interface SeguimientoReminderProps {
  pendientes: SeguimientoPendiente[];
  onUpdate: (id: string, patch: Partial<Pick<Contact, 'estado' | 'observacion'>>) => void;
}

export function SeguimientoReminder({ pendientes, onUpdate }: SeguimientoReminderProps) {
  const [open, setOpen] = useState(false);

  if (pendientes.length === 0) return null;

  return (
    <div className="card border-orange p-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div>
          <h2 className="font-display text-sm font-bold text-text">
            ⏰ {pendientes.length} cliente{pendientes.length === 1 ? '' : 's'} en seguimiento
          </h2>
          {!open && (
            <p className="mt-0.5 text-xs text-text-secondary">Tocá para ver la lista y actualizarlos</p>
          )}
        </div>
        <span className="shrink-0 text-lg text-text-secondary">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <>
          <p className="mb-3 mt-2 text-xs text-text-secondary">
            Quedaron en &quot;Seguimiento&quot; sin novedades. Retomalos y actualizá el estado.
          </p>
          <ul className="flex flex-col gap-2">
            {pendientes.map(({ contact, diasSinMovimiento }) => (
              <li
                key={contact.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-border bg-bg-elevated p-3"
              >
                <div>
                  <span className="font-medium text-text">{contact.nombre}</span>
                  {contact.telefono && <span className="ml-2 text-xs text-text-secondary">{contact.telefono}</span>}
                  <div className="text-xs text-text-muted">
                    Hace {diasSinMovimiento} día{diasSinMovimiento === 1 ? '' : 's'} sin novedades
                  </div>
                </div>
                <select
                  value={contact.estado}
                  onChange={(e) => onUpdate(contact.id, { estado: e.target.value as ContactEstado })}
                  className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-text focus:border-primary-bright focus:outline-none"
                >
                  {ESTADOS.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
