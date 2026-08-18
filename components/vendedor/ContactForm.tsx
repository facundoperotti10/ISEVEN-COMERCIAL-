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
  }) => Promise<void>;
}

export function ContactForm({ onAdd }: ContactFormProps) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [estado, setEstado] = useState<ContactEstado>('consulta');
  const [observacion, setObservacion] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true);
    await onAdd({ nombre: nombre.trim(), telefono: telefono.trim(), estado, observacion: observacion.trim() });
    setNombre('');
    setTelefono('');
    setEstado('consulta');
    setObservacion('');
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre del cliente"
        className="rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary-bright focus:outline-none lg:col-span-1"
      />
      <input
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        placeholder="Teléfono"
        className="rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary-bright focus:outline-none lg:col-span-1"
      />
      <select
        value={estado}
        onChange={(e) => setEstado(e.target.value as ContactEstado)}
        className="rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text focus:border-primary-bright focus:outline-none lg:col-span-1"
      >
        {ESTADOS.map((e) => (
          <option key={e.value} value={e.value}>
            {e.label}
          </option>
        ))}
      </select>
      <input
        value={observacion}
        onChange={(e) => setObservacion(e.target.value)}
        placeholder="Observación / motivo"
        className="rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary-bright focus:outline-none lg:col-span-1"
      />
      <button
        type="submit"
        disabled={saving || !nombre.trim()}
        className="rounded-[10px] bg-primary-bright px-3 py-2 text-sm font-medium text-bg transition hover:brightness-110 disabled:opacity-50 lg:col-span-1"
      >
        {saving ? 'Guardando…' : '+ Agregar cliente'}
      </button>
    </form>
  );
}
