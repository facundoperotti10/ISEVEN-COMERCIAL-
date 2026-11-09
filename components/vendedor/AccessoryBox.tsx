'use client';

import { useState } from 'react';
import type { AccessorySale } from '@/lib/calc';
import { fechaLarga } from '@/lib/oficina';

interface AccessoryBoxProps {
  contactId: string;
  sales: AccessorySale[];
  today: string;
  sugerencias: string[];
  onAdd: (contactId: string, descripcion: string, cantidad: number) => Promise<string | null>;
  onDelete?: (id: string) => void;
}

const input =
  'rounded-[10px] border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text placeholder:text-text-muted focus:border-primary-bright focus:outline-none';

/** Accesorios vendidos a un cliente: se cargan aparte y no suman al objetivo de equipos. */
export function AccessoryBox({ contactId, sales, today, sugerencias, onAdd, onDelete }: AccessoryBoxProps) {
  const [abierto, setAbierto] = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unidades = sales.reduce((acc, s) => acc + s.cantidad, 0);
  const listId = `accesorios-${contactId}`;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const n = Number.parseInt(cantidad, 10);
    if (!descripcion.trim() || !Number.isFinite(n) || n < 1) {
      setError('Poné qué accesorio es y una cantidad de 1 o más.');
      return;
    }
    setSaving(true);
    setError(null);
    const err = await onAdd(contactId, descripcion.trim(), n);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setDescripcion('');
    setCantidad('1');
    setAbierto(false);
  }

  return (
    <div className="rounded-[10px] border border-border bg-bg p-2.5 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text">
          Accesorios: {unidades} {unidades === 1 ? 'unidad' : 'unidades'}
        </span>
        {!abierto && (
          <button
            onClick={() => setAbierto(true)}
            className="rounded-full bg-lilac/15 px-3 py-1 text-xs font-semibold text-lilac"
          >
            + Cargar accesorios
          </button>
        )}
      </div>

      {abierto && (
        <form onSubmit={guardar} className="mt-2 flex flex-wrap items-center gap-2">
          <input
            list={listId}
            autoFocus
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Qué es (funda, cargador, vidrio...)"
            className={`${input} w-full sm:w-auto sm:min-w-0 sm:flex-1`}
          />
          <datalist id={listId}>
            {sugerencias.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            aria-label="Cantidad"
            className={`${input} w-20`}
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-[10px] bg-primary-bright px-3 py-1.5 text-sm font-medium text-bg disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAbierto(false);
              setError(null);
            }}
            className="px-1 text-xs text-text-muted hover:text-text"
          >
            Cancelar
          </button>
          {error && <p className="w-full select-all text-xs text-red">{error}</p>}
        </form>
      )}

      {sales.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {sales.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 text-[11px] text-text-muted">
              <span>
                <span className="text-text-secondary">
                  {s.descripcion} × {s.cantidad}
                </span>{' '}
                · {s.date === today ? 'Hoy' : fechaLarga(s.date)}
              </span>
              {onDelete && (
                <button onClick={() => onDelete(s.id)} className="text-text-muted hover:text-red">
                  Borrar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
