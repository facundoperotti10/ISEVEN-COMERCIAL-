'use client';

import { useState } from 'react';
import { limpiarImei } from '@/lib/calc';

export interface RepairDraft {
  imei: string;
  modelo: string;
  arreglo: string;
  observacion: string;
}

const EMPTY: RepairDraft = { imei: '', modelo: '', arreglo: '', observacion: '' };

export const inputClass =
  'w-full rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary-bright focus:outline-none';

interface RepairFormProps {
  /** Devuelve un texto de error si no se pudo guardar, o null si salió bien. */
  onSave: (draft: RepairDraft) => Promise<string | null>;
  initial?: RepairDraft;
  submitLabel?: string;
  onCancel?: () => void;
  modelos?: string[];
  arreglos?: string[];
}

export function RepairForm({ onSave, initial, submitLabel = 'Cargar arreglo', onCancel, modelos = [], arreglos = [] }: RepairFormProps) {
  const [f, setF] = useState<RepairDraft>(initial ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imeiDigits = limpiarImei(f.imei);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!imeiDigits || !f.modelo.trim() || !f.arreglo.trim()) {
      setError('Completá IMEI, modelo y arreglo.');
      return;
    }
    setSaving(true);
    setError(null);
    const err = await onSave({ ...f, imei: imeiDigits });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    if (!initial) setF(EMPTY);
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-text-secondary">IMEI</span>
        <input
          inputMode="numeric"
          autoComplete="off"
          placeholder="Ej: 356789012345678"
          value={f.imei}
          onChange={(e) => setF({ ...f, imei: e.target.value })}
          className={inputClass}
        />
        {imeiDigits.length > 0 && imeiDigits.length !== 15 && (
          <span className="text-[11px] text-yellow">El IMEI suele tener 15 números (este tiene {imeiDigits.length}).</span>
        )}
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-text-secondary">Modelo</span>
        <input
          list="repair-modelos"
          placeholder="Ej: iPhone 13 Pro"
          value={f.modelo}
          onChange={(e) => setF({ ...f, modelo: e.target.value })}
          className={inputClass}
        />
        <datalist id="repair-modelos">
          {modelos.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs text-text-secondary">Qué arreglo le hiciste</span>
        <input
          list="repair-arreglos"
          placeholder="Ej: Cambio de batería"
          value={f.arreglo}
          onChange={(e) => setF({ ...f, arreglo: e.target.value })}
          className={inputClass}
        />
        <datalist id="repair-arreglos">
          {arreglos.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs text-text-secondary">Observación (opcional)</span>
        <textarea
          rows={2}
          placeholder="Si le quedó algo pendiente o algo para tener en cuenta"
          value={f.observacion}
          onChange={(e) => setF({ ...f, observacion: e.target.value })}
          className={inputClass}
        />
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-[10px] bg-primary-bright px-3 py-2.5 text-sm font-medium text-bg transition hover:brightness-110 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[10px] border border-border px-4 py-2.5 text-sm text-text-secondary hover:text-text"
          >
            Cancelar
          </button>
        )}
      </div>
      {error && <p className="select-all text-xs text-red sm:col-span-2">{error}</p>}
    </form>
  );
}
