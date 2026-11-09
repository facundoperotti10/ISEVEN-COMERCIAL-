'use client';

import { useMemo, useState } from 'react';
import { buscarArreglos, type Repair } from '@/lib/calc';
import { RepairForm, inputClass, type RepairDraft } from '@/components/tecnico/RepairForm';

interface RepairsListProps {
  repairs: Repair[];
  today: string;
  /** Si se pasan, se puede editar y borrar cada arreglo. */
  onUpdate?: (id: string, draft: RepairDraft) => Promise<string | null>;
  onDelete?: (id: string) => void;
  /** Nombre de quien lo cargó (en el panel, si hay más de un técnico). */
  nameOf?: (sellerId: string) => string | null;
  modelos?: string[];
  arreglos?: string[];
}

function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${iso}T12:00:00Z`)
  );
}

/** Lista de arreglos con buscador por IMEI, modelo o arreglo. */
export function RepairsList({ repairs, today, onUpdate, onDelete, nameOf, modelos, arreglos }: RepairsListProps) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const visibles = useMemo(() => buscarArreglos(repairs, search), [repairs, search]);

  return (
    <div className="flex flex-col gap-3">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por IMEI, modelo o arreglo"
        className={inputClass}
      />
      <ul className="flex flex-col gap-2">
        {visibles.map((r) => (
          <li key={r.id} className="rounded-[10px] border border-border bg-bg-elevated px-4 py-3">
            {editing === r.id && onUpdate ? (
              <RepairForm
                initial={{ imei: r.imei, modelo: r.modelo, arreglo: r.arreglo, observacion: r.observacion ?? '' }}
                submitLabel="Guardar cambios"
                modelos={modelos}
                arreglos={arreglos}
                onCancel={() => setEditing(null)}
                onSave={async (d) => {
                  const err = await onUpdate(r.id, d);
                  if (!err) setEditing(null);
                  return err;
                }}
              />
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium text-text">{r.modelo}</span>
                    <span className="font-mono text-xs text-text-secondary">IMEI {r.imei}</span>
                  </div>
                  <div className="mt-0.5 text-sm text-text">{r.arreglo}</div>
                  {r.observacion && <div className="mt-1 text-xs text-yellow">Obs: {r.observacion}</div>}
                  <div className="mt-1 text-[11px] text-text-muted">
                    {r.date === today ? 'Hoy' : fechaCorta(r.date)}
                    {nameOf && ` · ${nameOf(r.seller_id) ?? r.seller_id}`}
                  </div>
                </div>
                {(onUpdate || onDelete) && (
                  <div className="flex flex-none gap-3 text-xs">
                    {onUpdate && (
                      <button onClick={() => setEditing(r.id)} className="text-text-secondary hover:text-text">
                        Editar
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => {
                          if (window.confirm(`¿Borrar el arreglo de ${r.modelo} (IMEI ${r.imei})?`)) onDelete(r.id);
                        }}
                        className="text-text-muted hover:text-red"
                      >
                        Borrar
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
        {visibles.length === 0 && (
          <li className="py-6 text-center text-sm text-text-muted">
            {repairs.length === 0 ? 'Todavía no hay arreglos cargados.' : 'Ningún arreglo coincide con la búsqueda.'}
          </li>
        )}
      </ul>
    </div>
  );
}
