'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { LogoutButton } from '@/components/ui/LogoutButton';
import { TaskList } from '@/components/oficina/TaskList';
import { StockRequestCard } from '@/components/oficina/StockRequestCard';
import {
  COMIDA_MIN,
  KIND_LABEL,
  SLOT_LABEL,
  TARDES_POR_DESCUENTO,
  dateARPlus,
  descuentoTardes,
  errorMessage,
  fechaLarga,
  horaAR,
  proximosSabados,
  type ClockEvent,
  type SaturdayShift,
  type Staff,
  type StockRequest,
  type Task,
} from '@/lib/oficina';

const TABS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'stock', label: 'Stock' },
  { id: 'sabados', label: 'Sábados' },
  { id: 'mes', label: 'Mi mes' },
  { id: 'equipo', label: 'Mi equipo' },
] as const;
type TabId = (typeof TABS)[number]['id'];

interface Props {
  me: Staff;
  staff: Staff[];
  initialTasks: Task[];
  events: ClockEvent[];
  initialStock: StockRequest[];
  initialShifts: SaturdayShift[];
  today: string;
}

export function EquipoDashboard({ me, staff, initialTasks, events, initialStock, initialShifts, today }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<TabId>('hoy');
  const [tasks, setTasks] = useState(initialTasks);
  const [stock, setStock] = useState(initialStock);
  const [shifts, setShifts] = useState(initialShifts);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const myTasks = tasks.filter((t) => t.staff_id === me.id);
  const pending = myTasks.filter((t) => !t.done_at).length;
  const myEvents = events.filter((e) => e.staff_id === me.id);
  const todayEvents = myEvents.filter((e) => e.work_date === today);
  const lastEvent = todayEvents[todayEvents.length - 1];
  const nowHHMM = horaAR(new Date(now));
  const showReminder = nowHHMM >= '16:30' && pending > 0;
  const tabs = TABS.filter((t) => t.id !== 'equipo' || me.is_manager);
  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? id;

  async function toggle(task: Task) {
    const done_at = task.done_at ? null : new Date().toISOString();
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, done_at } : t)));
    const { error: e } = await supabase.from('tasks').update({ done_at }).eq('id', task.id);
    if (e) {
      setError(errorMessage(e));
      setTasks((ts) => ts.map((t) => (t.id === task.id ? task : t)));
    }
  }

  async function addTask(staffId: string, title: string) {
    const { data, error: e } = await supabase
      .from('tasks')
      .insert({ staff_id: staffId, date: today, title, source: 'extra' })
      .select()
      .single();
    if (e) return setError(errorMessage(e));
    setTasks((ts) => [...ts, data]);
  }

  async function deleteTask(task: Task) {
    const { error: e } = await supabase.from('tasks').delete().eq('id', task.id);
    if (e) return setError(errorMessage(e));
    setTasks((ts) => ts.filter((t) => t.id !== task.id));
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-text">Hola, {me.name}</h1>
          <p className="text-xs text-text-muted">
            {me.role_label} · {fechaLarga(today)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {me.seller_id && (
            <Link href="/vendedor" className="rounded-full border border-border px-3 py-1.5 text-xs text-text-secondary">
              Mis ventas
            </Link>
          )}
          <LogoutButton />
        </div>
      </header>

      {showReminder && (
        <div className="mb-4 rounded-[12px] border border-pink/40 bg-pink/10 px-4 py-3 text-sm text-pink">
          Son más de las 16:30 y te quedan {pending} {pending === 1 ? 'tarea' : 'tareas'} sin marcar.
        </div>
      )}
      {lastEvent?.kind === 'salida_comida' && <LunchTimer since={lastEvent.at} now={now} />}
      {error && (
        <button onClick={() => setError(null)} className="mb-4 w-full rounded-[10px] bg-red/15 px-3 py-2 text-left text-sm text-red">
          {error}
        </button>
      )}

      <nav className="mb-5 flex flex-wrap gap-2 border-b border-border pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              tab === t.id ? 'bg-primary-bright text-bg' : 'text-text-secondary hover:bg-bg-elevated hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'hoy' && (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
          <section className="card p-4">
            <h2 className="mb-3 font-display text-base font-bold">Mis tareas de hoy</h2>
            <TaskList
              tasks={myTasks}
              canToggle
              canAdd
              onToggle={toggle}
              onAdd={(title) => addTask(me.id, title)}
              onDelete={deleteTask}
              emptyText="Hoy no tenés tareas cargadas."
            />
          </section>
          <section className="card h-fit p-4">
            <h2 className="mb-3 font-display text-base font-bold">Fichajes de hoy</h2>
            {todayEvents.length === 0 ? (
              <p className="text-sm text-text-muted">Todavía no fichaste. Se ficha en el iPhone de la oficina.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {todayEvents.map((e) => (
                  <li key={e.id} className="flex justify-between gap-2">
                    <span className="text-text-secondary">{KIND_LABEL[e.kind]}</span>
                    <span className={`stat-number ${e.late_minutes > 0 ? 'text-red' : 'text-text'}`}>
                      {horaAR(e.at)}
                      {e.late_minutes > 0 ? ` · ${e.late_minutes} min tarde` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === 'stock' && (
        <StockTab
          me={me}
          stock={stock}
          nameOf={nameOf}
          onCreated={(r) => setStock((s) => [...s, r])}
          onDeleted={(id) => setStock((s) => s.filter((x) => x.id !== id))}
          onError={setError}
        />
      )}

      {tab === 'sabados' && (
        <ShiftsTab me={me} shifts={shifts} nameOf={nameOf} onChange={setShifts} onError={setError} />
      )}

      {tab === 'mes' && <MonthTab events={myEvents} />}

      {tab === 'equipo' && me.is_manager && (
        <TeamTab
          team={staff.filter((s) => s.area === 'minorista' && s.id !== me.id)}
          tasks={tasks}
          events={events}
          today={today}
          onAdd={addTask}
        />
      )}
    </main>
  );
}

function LunchTimer({ since, now }: { since: string; now: number }) {
  const left = Math.ceil(COMIDA_MIN - (now - new Date(since).getTime()) / 60000);
  const back = horaAR(new Date(new Date(since).getTime() + COMIDA_MIN * 60000));
  const over = left < 0;
  return (
    <div
      className={`mb-4 rounded-[12px] px-4 py-3 text-sm ${
        over ? 'bg-red/15 text-red' : left <= 10 ? 'bg-yellow/15 text-yellow' : 'bg-bg-elevated text-text-secondary'
      }`}
    >
      {over
        ? `Te pasaste ${-left} min de la hora de comida. Volvé y marcá la vuelta en el iPhone de la oficina.`
        : `Estás comiendo: te quedan ${left} min. Volvé antes de las ${back}.`}
    </div>
  );
}

function StockTab({
  me,
  stock,
  nameOf,
  onCreated,
  onDeleted,
  onError,
}: {
  me: Staff;
  stock: StockRequest[];
  nameOf: (id: string) => string;
  onCreated: (r: StockRequest) => void;
  onDeleted: (id: string) => void;
  onError: (m: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const tomorrow = dateARPlus(1);
  const [form, setForm] = useState({
    cliente: '',
    turno_date: tomorrow,
    turno_time: '',
    modelo: '',
    capacidad: '',
    color: '',
    tipo: 'venta' as 'venta' | 'mostrar',
    urgent: false,
  });
  const [saving, setSaving] = useState(false);
  const mine = stock.filter((r) => r.staff_id === me.id).sort((a, b) => b.created_at.localeCompare(a.created_at));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await supabase
      .from('stock_requests')
      .insert({
        staff_id: me.id,
        cliente: form.cliente.trim(),
        turno_date: form.turno_date,
        turno_time: form.turno_time || null,
        modelo: form.modelo.trim(),
        capacidad: form.capacidad.trim() || null,
        color: form.color.trim() || null,
        tipo: form.tipo,
        urgent: form.urgent,
      })
      .select()
      .single();
    setSaving(false);
    if (error) return onError(errorMessage(error));
    onCreated(data);
    setForm((f) => ({ ...f, cliente: '', turno_time: '', modelo: '', capacidad: '', color: '', urgent: false }));
  }

  async function remove(id: string) {
    const { error } = await supabase.from('stock_requests').delete().eq('id', id);
    if (error) return onError(errorMessage(error));
    onDeleted(id);
  }

  const input =
    'w-full rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm placeholder:text-text-muted focus:border-primary-bright focus:outline-none';

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form onSubmit={submit} className="card flex flex-col gap-3 p-4">
        <h2 className="font-display text-base font-bold">Pedir stock</h2>
        <p className="text-xs text-text-secondary">
          Lo de mañana cargalo hasta las 23:00 y va en el viaje de las 10:00. Lo de hoy, antes de las 14:00 para el viaje de las
          15:00. Pasado el corte, solo como urgente.
        </p>
        <label className="text-xs text-text-muted">
          Cliente
          <input id="st-cliente" required value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} className={input} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-text-muted">
            Día del turno
            <input id="st-fecha" type="date" required min={dateARPlus(0)} value={form.turno_date} onChange={(e) => setForm({ ...form, turno_date: e.target.value })} className={input} />
          </label>
          <label className="text-xs text-text-muted">
            Hora
            <input id="st-hora" type="time" value={form.turno_time} onChange={(e) => setForm({ ...form, turno_time: e.target.value })} className={input} />
          </label>
        </div>
        <label className="text-xs text-text-muted">
          Modelo
          <input id="st-modelo" required placeholder="iPhone 15 Pro" value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} className={input} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-text-muted">
            Capacidad
            <input id="st-cap" placeholder="256 GB" value={form.capacidad} onChange={(e) => setForm({ ...form, capacidad: e.target.value })} className={input} />
          </label>
          <label className="text-xs text-text-muted">
            Color
            <input id="st-color" placeholder="Titanio negro" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={input} />
          </label>
        </div>
        <div className="flex gap-2">
          {(['venta', 'mostrar'] as const).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setForm({ ...form, tipo: t })}
              className={`flex-1 rounded-[10px] border px-3 py-2 text-sm ${
                form.tipo === t ? 'border-primary-bright bg-primary/30 text-text' : 'border-border text-text-secondary'
              }`}
            >
              {t === 'venta' ? 'Venta segura' : 'Para mostrar'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input id="st-urgente" type="checkbox" checked={form.urgent} onChange={(e) => setForm({ ...form, urgent: e.target.checked })} />
          Urgente: cliente sin turno y sin stock en la oficina (decide Mike)
        </label>
        <button disabled={saving} className="rounded-[10px] bg-primary-bright px-4 py-2.5 font-medium text-bg disabled:opacity-50">
          {saving ? 'Enviando…' : 'Enviar pedido'}
        </button>
      </form>

      <section className="card p-4">
        <h2 className="mb-3 font-display text-base font-bold">Mis pedidos</h2>
        {mine.length === 0 && <p className="text-sm text-text-muted">No cargaste pedidos esta semana.</p>}
        <div className="flex flex-col gap-2">
          {mine.map((r) => (
            <StockRequestCard key={r.id} r={r}>
              <span className="text-[11px] text-text-muted">{SLOT_LABEL[r.trip_slot]}</span>
              {r.status === 'pendiente' && (
                <button onClick={() => remove(r.id)} className="text-[11px] text-text-muted underline hover:text-red">
                  Cancelar
                </button>
              )}
            </StockRequestCard>
          ))}
        </div>
        {me.is_manager && (
          <>
            <h3 className="mb-2 mt-5 text-xs uppercase tracking-wide text-text-muted">Pedidos de tu equipo</h3>
            <div className="flex flex-col gap-2">
              {stock
                .filter((r) => r.staff_id !== me.id)
                .map((r) => (
                  <StockRequestCard key={r.id} r={r} who={nameOf(r.staff_id)} />
                ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ShiftsTab({
  me,
  shifts,
  nameOf,
  onChange,
  onError,
}: {
  me: Staff;
  shifts: SaturdayShift[];
  nameOf: (id: string) => string;
  onChange: (s: SaturdayShift[]) => void;
  onError: (m: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const sabados = proximosSabados(4);

  async function toggle(date: string) {
    const mine = shifts.find((s) => s.staff_id === me.id && s.date === date);
    if (mine) {
      const { error } = await supabase.from('saturday_shifts').delete().eq('id', mine.id);
      if (error) return onError(errorMessage(error));
      onChange(shifts.filter((s) => s.id !== mine.id));
    } else {
      const { data, error } = await supabase.from('saturday_shifts').insert({ staff_id: me.id, date }).select().single();
      if (error) return onError(errorMessage(error));
      onChange([...shifts, data]);
    }
  }

  return (
    <section className="card p-4">
      <h2 className="font-display text-base font-bold">Turnos del sábado</h2>
      <p className="mb-4 mt-1 text-xs text-text-secondary">Marcá los sábados que vas. El horario es de 10:00 a 14:00.</p>
      <div className="flex flex-col gap-3">
        {sabados.map((d) => {
          const going = shifts.filter((s) => s.date === d);
          const imIn = going.some((s) => s.staff_id === me.id);
          return (
            <div key={d} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-bg-elevated px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text">{fechaLarga(d)}</p>
                <p className="text-xs text-text-muted">
                  {going.length ? `Van: ${going.map((s) => nameOf(s.staff_id)).join(', ')}` : 'Todavía no hay nadie anotado'}
                </p>
              </div>
              <button
                onClick={() => toggle(d)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
                  imIn ? 'bg-green/20 text-green' : 'border border-border text-text-secondary'
                }`}
              >
                {imIn ? 'Voy ✓' : 'Anotarme'}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MonthTab({ events }: { events: ClockEvent[] }) {
  const lates = events.filter((e) => e.late_minutes > 0);
  const descuento = descuentoTardes(lates.length);
  const faltan = TARDES_POR_DESCUENTO - (lates.length % TARDES_POR_DESCUENTO);
  const days = [...new Set(events.filter((e) => e.kind === 'entrada').map((e) => e.work_date))];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="card p-4">
        <p className="text-xs text-text-muted">Días fichados</p>
        <p className="stat-number text-3xl">{days.length}</p>
      </div>
      <div className="card p-4">
        <p className="text-xs text-text-muted">Llegadas tarde</p>
        <p className={`stat-number text-3xl ${lates.length ? 'text-red' : 'text-green'}`}>{lates.length}</p>
        <p className="mt-1 text-xs text-text-muted">
          {lates.length === 0 ? 'Venís perfecto.' : `Te faltan ${faltan} para el próximo descuento.`}
        </p>
      </div>
      <div className="card p-4">
        <p className="text-xs text-text-muted">Descuento del mes</p>
        <p className={`stat-number text-3xl ${descuento ? 'text-red' : 'text-text'}`}>USD {descuento}</p>
        <p className="mt-1 text-xs text-text-muted">Cada 3 llegadas tarde, USD 20.</p>
      </div>
      <div className="card p-4 md:col-span-3">
        <h3 className="mb-2 font-display text-sm font-bold">Llegadas tarde del mes</h3>
        {lates.length === 0 ? (
          <p className="text-sm text-text-muted">Ninguna.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {lates.map((e) => (
              <li key={e.id} className="flex justify-between gap-2">
                <span className="text-text-secondary">
                  {fechaLarga(e.work_date)} · {KIND_LABEL[e.kind]}
                </span>
                <span className="stat-number text-red">{e.late_minutes} min</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TeamTab({
  team,
  tasks,
  events,
  today,
  onAdd,
}: {
  team: Staff[];
  tasks: Task[];
  events: ClockEvent[];
  today: string;
  onAdd: (staffId: string, title: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {team.map((s) => {
        const ev = events.filter((e) => e.staff_id === s.id);
        const todayEv = ev.filter((e) => e.work_date === today);
        const lates = ev.filter((e) => e.late_minutes > 0).length;
        const entrada = todayEv.find((e) => e.kind === 'entrada');
        return (
          <section key={s.id} className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-bold">{s.name}</h2>
              <span className={`badge ${entrada ? (entrada.late_minutes ? 'bg-red/15 text-red' : 'bg-green/15 text-green') : 'bg-bg text-text-muted'}`}>
                {entrada ? `Entró ${horaAR(entrada.at)}` : 'Sin fichar'}
              </span>
            </div>
            <p className="mb-3 text-xs text-text-muted">Llegadas tarde del mes: {lates}</p>
            <TaskList
              tasks={tasks.filter((t) => t.staff_id === s.id)}
              canToggle={false}
              canAdd
              onAdd={(title) => onAdd(s.id, title)}
            />
          </section>
        );
      })}
    </div>
  );
}
