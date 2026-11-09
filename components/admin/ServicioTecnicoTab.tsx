'use client';

import { useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { KpiCard } from '@/components/ui/KpiCard';
import { RepairsList } from '@/components/tecnico/RepairsList';
import type { RepairDraft } from '@/components/tecnico/RepairForm';
import { arreglosPorModelo, type Repair, type Seller } from '@/lib/calc';

interface ServicioTecnicoTabProps {
  repairs: Repair[];
  sellers: Seller[];
  today: string;
  supabase: SupabaseClient<Database>;
  onChange: (repairs: Repair[]) => void;
}

function nombreMes(month: string): string {
  const txt = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-15T12:00:00Z`)
  );
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

/** Panel de servicio técnico: los arreglos que carga Santi, por mes y por modelo. */
export function ServicioTecnicoTab({ repairs, sellers, today, supabase, onChange }: ServicioTecnicoTabProps) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const sellersById = Object.fromEntries(sellers.map((s) => [s.id, s]));
  const tecnicos = new Set(repairs.map((r) => r.seller_id));

  const delMes = useMemo(() => repairs.filter((r) => r.date.startsWith(month)), [repairs, month]);
  const porModelo = useMemo(() => arreglosPorModelo(delMes), [delMes]);
  const hoy = repairs.filter((r) => r.date === today).length;
  const conObs = delMes.filter((r) => r.observacion).length;
  const max = porModelo[0]?.cantidad ?? 0;

  async function handleUpdate(id: string, d: RepairDraft): Promise<string | null> {
    const { data, error } = await supabase
      .from('repairs')
      .update({ imei: d.imei, modelo: d.modelo.trim(), arreglo: d.arreglo.trim(), observacion: d.observacion.trim() || null })
      .eq('id', id)
      .select()
      .single();
    if (error || !data) return `No se pudo guardar: ${error?.message ?? 'sin respuesta'}`;
    onChange(repairs.map((r) => (r.id === id ? data : r)));
    return null;
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('repairs').delete().eq('id', id);
    if (!error) onChange(repairs.filter((r) => r.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold text-text">Arreglos de {nombreMes(month)}</h2>
        <input
          type="month"
          value={month}
          max={today.slice(0, 7)}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm text-text focus:border-primary-bright focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Arreglos del mes" value={delMes.length} accent="#2C8598" />
        <KpiCard label="Arreglos de hoy" value={hoy} />
        <KpiCard label="Con observación" value={conObs} accent={conObs ? '#FBBF24' : undefined} />
      </div>

      {porModelo.length > 0 && (
        <div className="card p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-text">Por modelo</h3>
          <ul className="flex flex-col gap-2">
            {porModelo.map((m) => (
              <li key={m.modelo} className="flex items-center gap-3 text-sm">
                <span className="w-36 flex-none truncate text-text">{m.modelo}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
                  <div className="h-full rounded-full bg-primary-bright" style={{ width: `${(m.cantidad / max) * 100}%` }} />
                </div>
                <span className="stat-number w-8 text-right text-text">{m.cantidad}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-4">
        <h3 className="mb-3 font-display text-sm font-bold text-text">Detalle</h3>
        <RepairsList
          repairs={delMes}
          today={today}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          nameOf={tecnicos.size > 1 ? (id) => sellersById[id]?.name ?? null : undefined}
        />
      </div>
    </div>
  );
}
