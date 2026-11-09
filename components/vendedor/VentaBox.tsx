'use client';

import { useState } from 'react';
import type { AccessorySale, ClientSale } from '@/lib/calc';
import { fechaLarga } from '@/lib/oficina';

interface VentaBoxProps {
  contactId: string;
  today: string;
  /** Ventas repetidas de equipos de este cliente (la primera venta es el propio contacto). */
  ventasEquipo: ClientSale[];
  onAddSale: (contactId: string) => void;
  onDeleteSale?: (id: string) => void;
  /** Solo mayorista: accesorios de este cliente. Si no se pasa onAddAccessory, el botón carga un celular directo. */
  accesorios?: AccessorySale[];
  sugerencias?: string[];
  onAddAccessory?: (contactId: string, descripcion: string, cantidad: number) => Promise<string | null>;
  onDeleteAccessory?: (id: string) => void;
}

const input =
  'rounded-[10px] border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text placeholder:text-text-muted focus:border-primary-bright focus:outline-none';

type Paso = 'cerrado' | 'elegir' | 'accesorio';

/** Ventas de un cliente ya vendido: "+ Registrar otra venta" y adentro, celular o accesorio. */
export function VentaBox({
  contactId,
  today,
  ventasEquipo,
  onAddSale,
  onDeleteSale,
  accesorios = [],
  sugerencias = [],
  onAddAccessory,
  onDeleteAccessory,
}: VentaBoxProps) {
  const [paso, setPaso] = useState<Paso>('cerrado');
  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conAccesorios = Boolean(onAddAccessory);
  const equipos = 1 + ventasEquipo.length;
  const unidades = accesorios.reduce((acc, a) => acc + a.cantidad, 0);
  const listId = `accesorios-${contactId}`;

  const historial = [
    ...ventasEquipo.map((s) => ({ id: s.id, tipo: 'equipo' as const, date: s.date, orden: s.created_at, texto: 'Celular' })),
    ...accesorios.map((a) => ({
      id: a.id,
      tipo: 'accesorio' as const,
      date: a.date,
      orden: a.created_at,
      texto: `${a.descripcion} × ${a.cantidad}`,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.orden.localeCompare(a.orden));

  function cerrar() {
    setPaso('cerrado');
    setDescripcion('');
    setCantidad('1');
    setError(null);
  }

  async function guardarAccesorio(e: React.FormEvent) {
    e.preventDefault();
    if (!onAddAccessory) return;
    const n = Number.parseInt(cantidad, 10);
    if (!descripcion.trim() || !Number.isFinite(n) || n < 1) {
      setError('Poné qué accesorio es y una cantidad de 1 o más.');
      return;
    }
    setSaving(true);
    setError(null);
    const err = await onAddAccessory(contactId, descripcion.trim(), n);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    cerrar();
  }

  return (
    <div className="rounded-[10px] border border-border bg-bg p-2.5 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text">
          Ventas: {equipos} {equipos === 1 ? 'celular' : 'celulares'}
          {conAccesorios && unidades > 0 && (
            <span className="font-normal text-lilac">
              {' '}
              · {unidades} {unidades === 1 ? 'accesorio' : 'accesorios'}
            </span>
          )}
        </span>
        {paso === 'cerrado' && (
          <button
            onClick={() => (conAccesorios ? setPaso('elegir') : onAddSale(contactId))}
            className="rounded-full bg-green/15 px-3 py-1 text-xs font-semibold text-green"
          >
            + Registrar otra venta
          </button>
        )}
      </div>

      {paso === 'elegir' && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="w-full text-[11px] text-text-muted">¿Qué le vendiste?</span>
          <button
            onClick={() => {
              onAddSale(contactId);
              cerrar();
            }}
            className="flex-1 rounded-[10px] bg-green/15 px-3 py-2 text-sm font-semibold text-green"
          >
            📱 Celular
          </button>
          <button
            onClick={() => setPaso('accesorio')}
            className="flex-1 rounded-[10px] bg-lilac/15 px-3 py-2 text-sm font-semibold text-lilac"
          >
            🎧 Accesorio
          </button>
          <button onClick={cerrar} className="px-1 text-xs text-text-muted hover:text-text">
            Cancelar
          </button>
        </div>
      )}

      {paso === 'accesorio' && (
        <form onSubmit={guardarAccesorio} className="mt-2 flex flex-wrap items-center gap-2">
          <input
            list={listId}
            autoFocus
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Qué accesorio (funda, cargador, vidrio...)"
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
          <button type="button" onClick={cerrar} className="px-1 text-xs text-text-muted hover:text-text">
            Cancelar
          </button>
          {error && <p className="w-full select-all text-xs text-red">{error}</p>}
        </form>
      )}

      {historial.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {historial.map((h) => {
            const borrar = h.tipo === 'equipo' ? onDeleteSale : onDeleteAccessory;
            return (
              <li key={`${h.tipo}-${h.id}`} className="flex items-center justify-between gap-2 text-[11px] text-text-muted">
                <span>
                  <span className={h.tipo === 'equipo' ? 'text-text-secondary' : 'text-lilac'}>
                    {h.tipo === 'equipo' ? '📱' : '🎧'} {h.texto}
                  </span>{' '}
                  · {h.date === today ? 'Hoy' : fechaLarga(h.date)}
                </span>
                {borrar && (
                  <button onClick={() => borrar(h.id)} className="text-text-muted hover:text-red">
                    Borrar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
