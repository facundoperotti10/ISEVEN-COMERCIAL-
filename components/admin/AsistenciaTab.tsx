'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClockKind, Database } from '@/lib/database.types';
import {
  COMIDA_MIN,
  KIND_LABEL,
  KIOSK_TOKEN_KEY,
  descuentoTardes,
  errorMessage,
  fechaLarga,
  horaAR,
  minutosATexto,
  type ClockEvent,
  type Staff,
} from '@/lib/oficina';

interface Props {
  staff: Staff[];
  events: ClockEvent[];
  today: string;
  supabase: SupabaseClient<Database>;
  onEventsChange: (e: ClockEvent[]) => void;
}

const KINDS: ClockKind[] = ['entrada', 'salida_comida', 'vuelta_comida', 'salida'];

function workedMinutes(dayEvents: ClockEvent[]): number | null {
  const at = (k: ClockKind) => dayEvents.find((e) => e.kind === k)?.at;
  const entrada = at('entrada');
  const salida = at('salida');
  if (!entrada || !salida) return null;
  let m = (new Date(salida).getTime() - new Date(entrada).getTime()) / 60000;
  const ida = at('salida_comida');
  const vuelta = at('vuelta_comida');
  if (ida && vuelta) m -= (new Date(vuelta).getTime() - new Date(ida).getTime()) / 60000;
  return Math.max(0, Math.round(m));
}

export function AsistenciaTab({ staff, events, today, supabase, onEventsChange }: Props) {
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [zoom, setZoom] = useState<{ url: string; label: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [day, setDay] = useState(today);
  const [now, setNow] = useState(() => Date.now());
  const [devices, setDevices] = useState<{ id: string; name: string; active: boolean; created_at: string }[]>([]);

  useEffect(() => {
    supabase
      .from('kiosk_devices')
      .select('id, name, active, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => setDevices(data ?? []));
  }, [supabase]);

  async function deactivate(id: string) {
    const { error } = await supabase.from('kiosk_devices').update({ active: false }).eq('id', id);
    if (error) return setMsg(errorMessage(error));
    setDevices((d) => d.map((x) => (x.id === id ? { ...x, active: false } : x)));
    setMsg('Dispositivo dado de baja: desde ahí ya no se puede fichar.');
  }

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const dayEvents = useMemo(() => events.filter((e) => e.work_date === day), [events, day]);

  // Fotos del día elegido (links temporales; la carpeta es privada).
  useEffect(() => {
    const paths = dayEvents.map((e) => e.photo_path).filter((p): p is string => Boolean(p) && !photos[p!]);
    if (!paths.length) return;
    supabase.storage
      .from('fichajes')
      .createSignedUrls(paths, 3600)
      .then(({ data }) => {
        if (!data) return;
        setPhotos((prev) => {
          const next = { ...prev };
          data.forEach((d) => {
            if (d.path && d.signedUrl) next[d.path] = d.signedUrl;
          });
          return next;
        });
      });
  }, [dayEvents, photos, supabase]);

  // Borra las fotos de más de 60 días (se conserva el registro del fichaje).
  useEffect(() => {
    const limit = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 7);
    supabase.storage
      .from('fichajes')
      .list('', { limit: 100 })
      .then(async ({ data }) => {
        for (const folder of data ?? []) {
          if (!/^\d{4}-\d{2}$/.test(folder.name) || folder.name >= limit) continue;
          const { data: files } = await supabase.storage.from('fichajes').list(folder.name, { limit: 1000 });
          const names = (files ?? []).map((f) => `${folder.name}/${f.name}`);
          if (names.length) await supabase.storage.from('fichajes').remove(names);
        }
      });
  }, [supabase]);

  const monthStats = staff.map((s) => {
    const ev = events.filter((e) => e.staff_id === s.id);
    const lates = ev.filter((e) => e.late_minutes > 0).length;
    const dates = [...new Set(ev.map((e) => e.work_date))];
    const minutes = dates.reduce((acc, d) => acc + (workedMinutes(ev.filter((e) => e.work_date === d)) ?? 0), 0);
    return { s, days: ev.filter((e) => e.kind === 'entrada').length, lates, descuento: descuentoTardes(lates), minutes };
  });

  async function activateDevice() {
    const { data, error } = await supabase.rpc('register_kiosk', { p_name: 'iPhone 13 oficina' });
    if (error) return setMsg(errorMessage(error));
    const { data: list } = await supabase
      .from('kiosk_devices')
      .select('id, name, active, created_at')
      .order('created_at', { ascending: false });
    setDevices(list ?? []);
    try {
      window.localStorage.setItem(KIOSK_TOKEN_KEY, data as string);
      setMsg('Listo: este dispositivo quedó activado como reloj. Cerrá sesión y entrá a “Ingreso y egreso”.');
    } catch {
      setMsg('No se pudo guardar en este navegador. Probá sin modo privado.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {msg && (
        <button onClick={() => setMsg(null)} className="rounded-[10px] bg-bg-elevated px-3 py-2 text-left text-sm text-text-secondary">
          {msg}
        </button>
      )}

      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-bold">Fichajes · {fechaLarga(day)}</h2>
          <input
            id="asis-dia"
            type="date"
            value={day}
            min={`${today.slice(0, 8)}01`}
            max={today}
            onChange={(e) => e.target.value && setDay(e.target.value)}
            className="rounded-[10px] border border-border bg-bg-elevated px-3 py-1.5 text-sm"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="pb-2 font-medium">Persona</th>
                {KINDS.map((k) => (
                  <th key={k} className="pb-2 font-medium">
                    {KIND_LABEL[k]}
                  </th>
                ))}
                <th className="pb-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const ev = dayEvents.filter((e) => e.staff_id === s.id);
                const last = ev[ev.length - 1];
                const lateAny = ev.some((e) => e.late_minutes > 0);
                let estado = { label: 'No fichó', cls: 'bg-red/15 text-red' };
                if (last?.kind === 'salida') estado = { label: `Salió · ${minutosATexto(workedMinutes(ev) ?? 0)}`, cls: 'bg-lilac/15 text-lilac' };
                else if (last?.kind === 'salida_comida') {
                  const left = Math.ceil(COMIDA_MIN - (now - new Date(last.at).getTime()) / 60000);
                  estado = left >= 0 ? { label: `Comiendo · ${left} min`, cls: 'bg-yellow/15 text-yellow' } : { label: `Comiendo · pasado ${-left} min`, cls: 'bg-red/15 text-red' };
                } else if (last) estado = lateAny ? { label: 'En la ofi · llegó tarde', cls: 'bg-orange/15 text-orange' } : { label: 'En la ofi', cls: 'bg-green/15 text-green' };
                if (day !== today && !last) estado = { label: 'Sin fichajes', cls: 'bg-bg text-text-muted' };
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="py-2.5 font-medium">{s.name}</td>
                    {KINDS.map((k) => {
                      const e = ev.find((x) => x.kind === k);
                      if (!e) return <td key={k} className="py-2.5 text-text-muted">—</td>;
                      const url = e.photo_path ? photos[e.photo_path] : null;
                      return (
                        <td key={k} className="py-2.5">
                          <span className="flex items-center gap-2">
                            {url ? (
                              <button onClick={() => setZoom({ url, label: `${s.name} · ${KIND_LABEL[k]} ${horaAR(e.at)}` })}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt={`Foto de ${s.name}`} className="h-8 w-8 rounded-full object-cover" />
                              </button>
                            ) : (
                              <span className="grid h-8 w-8 place-items-center rounded-full bg-bg text-[9px] text-text-muted" title="Sin foto">
                                {e.manual ? 'man.' : 's/f'}
                              </span>
                            )}
                            <span className={`stat-number ${e.late_minutes > 0 ? 'text-red' : ''}`}>
                              {horaAR(e.at)}
                              {e.late_minutes > 0 && <span className="block text-[10px] font-normal">+{e.late_minutes} min</span>}
                            </span>
                          </span>
                        </td>
                      );
                    })}
                    <td className="py-2.5">
                      <span className={`badge ${estado.cls}`}>{estado.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-display text-base font-bold">Resumen del mes</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="pb-2 font-medium">Persona</th>
                <th className="pb-2 font-medium">Días</th>
                <th className="pb-2 font-medium">Horas</th>
                <th className="pb-2 font-medium">Llegadas tarde</th>
                <th className="pb-2 font-medium">Descuento</th>
              </tr>
            </thead>
            <tbody>
              {monthStats.map(({ s, days, lates, descuento, minutes }) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-2.5 font-medium">{s.name}</td>
                  <td className="stat-number py-2.5">{days}</td>
                  <td className="stat-number py-2.5">{minutosATexto(minutes)}</td>
                  <td className={`stat-number py-2.5 ${lates ? 'text-red' : ''}`}>{lates}</td>
                  <td className={`stat-number py-2.5 ${descuento ? 'text-red' : 'text-text-muted'}`}>USD {descuento}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-text-muted">Cada 3 llegadas tarde en el mes (entrada o vuelta de comer) se descuentan USD 20.</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <ManualForm staff={staff} today={today} supabase={supabase} onAdded={(e) => onEventsChange([...events, e])} onMsg={setMsg} />
        <section className="card p-4">
          <h2 className="font-display text-base font-bold">Reloj de fichaje</h2>
          <p className="mt-1 text-xs text-text-secondary">
            Hacelo una sola vez desde el iPhone 13 de la oficina: entrá al Panel de control en ese teléfono, tocá el botón y
            después cerrá sesión. Desde ese momento “Ingreso y egreso” funciona solo en ese teléfono.
          </p>
          <button onClick={activateDevice} className="mt-3 rounded-[10px] bg-orange px-4 py-2.5 text-sm font-semibold text-bg">
            Activar este dispositivo como reloj
          </button>
          <div className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">Dispositivos habilitados para fichar</p>
            {devices.filter((d) => d.active).length === 0 ? (
              <p className="text-sm text-text-muted">Ninguno todavía.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {devices
                  .filter((d) => d.active)
                  .map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 rounded-[8px] bg-bg-elevated px-3 py-2 text-sm">
                      <span className="min-w-0">
                        {d.name}
                        <span className="block text-[11px] text-text-muted">Activado {fechaLarga(d.created_at.slice(0, 10))}</span>
                      </span>
                      <button onClick={() => deactivate(d.id)} className="text-xs text-text-muted hover:text-red">
                        Dar de baja
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>
          <p className="mt-3 text-xs text-text-muted">Las fotos son privadas y se borran solas a los 60 días.</p>
        </section>
      </div>

      {zoom && (
        <button onClick={() => setZoom(null)} className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/80 p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom.url} alt={zoom.label} className="max-h-[70vh] max-w-full rounded-[14px]" />
          <span className="text-sm text-white">{zoom.label}</span>
        </button>
      )}
    </div>
  );
}

function ManualForm({
  staff,
  today,
  supabase,
  onAdded,
  onMsg,
}: {
  staff: Staff[];
  today: string;
  supabase: SupabaseClient<Database>;
  onAdded: (e: ClockEvent) => void;
  onMsg: (m: string) => void;
}) {
  const [f, setF] = useState({ staff_id: staff[0]?.id ?? '', kind: 'entrada' as ClockKind, date: today, time: '10:00', late: '0', note: '' });
  const input = 'w-full rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    const at = new Date(`${f.date}T${f.time}:00-03:00`).toISOString();
    const { data, error } = await supabase
      .from('clock_events')
      .insert({
        staff_id: f.staff_id,
        kind: f.kind,
        at,
        work_date: f.date,
        late_minutes: Math.max(0, Number(f.late) || 0),
        manual: true,
        note: f.note.trim() || 'Corrección manual',
        created_by: u.user?.id ?? null,
      })
      .select()
      .single();
    if (error) return onMsg(errorMessage(error));
    onAdded(data);
    onMsg('Fichaje corregido. Queda marcado como manual.');
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-2 p-4">
      <h2 className="font-display text-base font-bold">Corregir un fichaje</h2>
      <p className="text-xs text-text-secondary">Para cuando alguien se olvidó de marcar. Queda registrado como manual.</p>
      <div className="grid grid-cols-2 gap-2">
        <select id="man-staff" value={f.staff_id} onChange={(e) => setF({ ...f, staff_id: e.target.value })} className={input}>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select id="man-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as ClockKind })} className={input}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <input id="man-date" type="date" max={today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={input} />
        <input id="man-time" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} className={input} />
        <label className="col-span-2 text-xs text-text-muted">
          Minutos tarde (0 si llegó a tiempo)
          <input id="man-late" type="number" min={0} value={f.late} onChange={(e) => setF({ ...f, late: e.target.value })} className={input} />
        </label>
      </div>
      <input id="man-note" placeholder="Motivo" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={input} />
      <button className="rounded-[10px] bg-primary-bright px-4 py-2 text-sm font-medium text-bg">Guardar corrección</button>
    </form>
  );
}
