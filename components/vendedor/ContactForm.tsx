'use client';

import { useState } from 'react';
import { ESTADOS } from '@/lib/calc';
import type { ContactEstado } from '@/lib/database.types';

interface ContactFormProps {
  onAdd: (data: {
    nombre: string;
    telefono: string;
    estado: ContactEstado;
    observacion: string;
    fuente: string;
  }) => Promise<void>;
  sources: string[];
}

export function ContactForm({ onAdd, sources }: ContactFormProps) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [estado, setEstado] = useState<ContactEstado>('consulta');
  const [observacion, setObservacion] = useState('');
  const [fuente, setFuente] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true);
    await onAdd({
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      estado,
      observacion: observacion.trim(),
      fuente: fuente.trim(),
    });
    setNombre('');
    setTelefono('');
    setEstado('consulta');
    setObservacion('');
    setFuente('');
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre del cliente"
        className="rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary-bright focus:outline-none"
      />
      <input
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        placeholder="Teléfono"
        className="rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary-bright focus:outline-none"
      />
      <select
        value={estado}
        onChange={(e) => setEstado(e.target.value as ContactEstado)}
        className="rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text focus:border-primary-bright focus:outline-none"
      >
        {ESTADOS.map((e) => (
          <option key={e.value} value={e.value}>
            {e.label}
          </option>
        ))}
      </select>
      <input
        value={fuente}
        onChange={(e) => setFuente(e.target.value)}
        placeholder="Fuente (ej: Reel sillas, Google Ads)"
        list="fuentes-sugeridas"
        className="rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary-bright focus:outline-none"
      />
      <datalist id="fuentes-sugeridas">
        {sources.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <input
        value={observacion}
        onChange={(e) => setObservacion(e.target.value)}
        placeholder="Observación / motivo"
        className="rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary-bright focus:outline-none"
      />
      <button
        type="submit"
        disabled={saving || !nombre.trim()}
        className="rounded-[10px] bg-primary-bright px-3 py-2 text-sm font-medium text-bg transition hover:brightness-110 disabled:opacity-50"
      >
        {saving ? 'Guardando…' : '+ Agregar cliente'}
      </button>
    </form>
  );
}
