'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { OficinaEnVivo } from '@/components/oficina/OficinaEnVivo';
import { createClient } from '@/lib/supabase/client';
import { LogoutButton } from '@/components/ui/LogoutButton';
import { KpiCard } from '@/components/ui/KpiCard';
import { RepairForm, type RepairDraft } from '@/components/tecnico/RepairForm';
import { RepairsList } from '@/components/tecnico/RepairsList';
import { todayAR, type Repair, type Seller } from '@/lib/calc';

function describeError(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  const detail = e ? [e.code, e.message].filter(Boolean).join(' - ') : 'sin respuesta del servidor';
  return `No se pudo guardar. Para soporte, mandá esto: ${detail || 'error desconocido'}`;
}

function distintos(values: string[]): string[] {
  const map = new Map<string, string>();
  for (const v of values) {
    const t = v.trim();
    if (t && !map.has(t.toLowerCase())) map.set(t.toLowerCase(), t);
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

interface TecnicoDashboardProps {
  seller: Seller;
  initialRepairs: Repair[];
  name: string;
}

/** Pantalla de servicio técnico: cargar cada arreglo (IMEI, modelo, arreglo, observación). */
export function TecnicoDashboard({ seller, initialRepairs, name }: TecnicoDashboardProps) {
  const [repairs, setRepairs] = useState<Repair[]>(initialRepairs);
  const supabase = useMemo(() => createClient(), []);
  const today = todayAR();
  const month = today.slice(0, 7);

  const hoy = repairs.filter((r) => r.date === today).length;
  const mes = repairs.filter((r) => r.date.startsWith(month)).length;
  const modelos = useMemo(() => distintos(repairs.map((r) => r.modelo)), [repairs]);
  const arreglos = useMemo(() => distintos(repairs.map((r) => r.arreglo)), [repairs]);

  async function handleAdd(d: RepairDraft): Promise<string | null> {
    const { data, error } = await supabase
      .from('repairs')
      .insert({
        seller_id: seller.id,
        date: today,
        imei: d.imei,
        modelo: d.modelo.trim(),
        arreglo: d.arreglo.trim(),
        observacion: d.observacion.trim() || null,
      })
      .select()
      .single();
    if (error || !data) return describeError(error);
    setRepairs((prev) => [data, ...prev]);
    return null;
  }

  async function handleUpdate(id: string, d: RepairDraft): Promise<string | null> {
    const { data, error } = await supabase
      .from('repairs')
      .update({
        imei: d.imei,
        modelo: d.modelo.trim(),
        arreglo: d.arreglo.trim(),
        observacion: d.observacion.trim() || null,
      })
      .eq('id', id)
      .select()
      .single();
    if (error || !data) return describeError(error);
    setRepairs((prev) => prev.map((r) => (r.id === id ? data : r)));
    return null;
  }

  async function handleDelete(id: string) {
    const prev = repairs;
    setRepairs((r) => r.filter((x) => x.id !== id));
    const { error } = await supabase.from('repairs').delete().eq('id', id);
    if (error) setRepairs(prev);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-text">Hola, {name}</h1>
          <p className="text-xs text-text-muted">Servicio técnico</p>
        </div>
        <LogoutButton />
      </header>

      <OficinaEnVivo />

      <nav className="mb-5 flex flex-wrap gap-2 border-b border-border pb-3">
        <span className="rounded-full bg-primary-bright px-3.5 py-1.5 text-sm font-medium text-bg">Arreglos</span>
        <Link
          href="/equipo"
          className="rounded-full px-3.5 py-1.5 text-sm font-medium text-text-secondary transition hover:bg-bg-elevated hover:text-text"
        >
          Oficina: tareas, stock y sábados →
        </Link>
      </nav>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Arreglos de hoy" value={hoy} accent="#2C8598" />
          <KpiCard label="Arreglos del mes" value={mes} />
        </div>

        <div className="card p-4">
          <h2 className="mb-3 font-display text-sm font-bold text-text">Cargar arreglo</h2>
          <RepairForm onSave={handleAdd} modelos={modelos} arreglos={arreglos} />
        </div>

        <div className="card p-4">
          <h2 className="mb-3 font-display text-sm font-bold text-text">Mis arreglos ({repairs.length})</h2>
          <RepairsList
            repairs={repairs}
            today={today}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            modelos={modelos}
            arreglos={arreglos}
          />
        </div>
      </div>
    </main>
  );
}
