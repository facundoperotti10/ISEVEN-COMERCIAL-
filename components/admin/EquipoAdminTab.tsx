'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { TaskList } from '@/components/oficina/TaskList';
import {
  AREA_COLOR,
  errorMessage,
  fechaLarga,
  proximosSabados,
  type SaturdayShift,
  type Staff,
  type Task,
  type TaskTemplate,
} from '@/lib/oficina';

interface Props {
  staff: Staff[];
  tasks: Task[];
  templates: TaskTemplate[];
  shifts: SaturdayShift[];
  today: string;
  supabase: SupabaseClient<Database>;
  onStaffChange: (s: Staff[]) => void;
  onTasksChange: (t: Task[]) => void;
  onTemplatesChange: (t: TaskTemplate[]) => void;
}

export function EquipoAdminTab({
  staff,
  tasks,
  templates,
  shifts,
  today,
  supabase,
  onStaffChange,
  onTasksChange,
  onTemplatesChange,
}: Props) {
  const [msg, setMsg] = useState<string | null>(null);
  const [section, setSection] = useState<'tareas' | 'sabados' | 'config'>('tareas');
  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? id;

  async function addTask(staffId: string, title: string) {
    const { data, error } = await supabase.from('tasks').insert({ staff_id: staffId, date: today, title, source: 'extra' }).select().single();
    if (error) return setMsg(errorMessage(error));
    onTasksChange([...tasks, data]);
  }

  async function deleteTask(task: Task) {
    const { error } = await supabase.from('tasks').delete().eq('id', task.id);
    if (error) return setMsg(errorMessage(error));
    onTasksChange(tasks.filter((t) => t.id !== task.id));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['tareas', 'Tareas de hoy'],
            ['sabados', 'Sábados'],
            ['config', 'PIN, horarios y tareas fijas'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              section === id ? 'border-primary-bright bg-primary/30 text-text' : 'border-border text-text-secondary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {msg && (
        <button onClick={() => setMsg(null)} className="rounded-[10px] bg-bg-elevated px-3 py-2 text-left text-sm text-text-secondary">
          {msg}
        </button>
      )}

      {section === 'tareas' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {staff.map((s) => (
            <section key={s.id} className="card p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: AREA_COLOR[s.area] }} />
                <h2 className="font-display text-base font-bold">{s.name}</h2>
                <span className="text-xs text-text-muted">{s.role_label}</span>
              </div>
              <TaskList
                tasks={tasks.filter((t) => t.staff_id === s.id)}
                canToggle={false}
                canAdd
                onAdd={(title) => addTask(s.id, title)}
                onDelete={deleteTask}
              />
            </section>
          ))}
        </div>
      )}

      {section === 'sabados' && (
        <section className="card p-4">
          <h2 className="mb-3 font-display text-base font-bold">Quién va los próximos sábados</h2>
          <div className="flex flex-col gap-2">
            {proximosSabados(4).map((d) => {
              const going = shifts.filter((s) => s.date === d);
              return (
                <div key={d} className="flex flex-wrap justify-between gap-2 rounded-[10px] bg-bg-elevated px-3 py-2.5 text-sm">
                  <span className="font-medium">{fechaLarga(d)}</span>
                  <span className={going.length ? 'text-text' : 'text-red'}>
                    {going.length ? going.map((s) => nameOf(s.staff_id)).join(', ') : 'Nadie anotado'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {section === 'config' && (
        <div className="grid gap-4 md:grid-cols-2">
          {staff.map((s) => (
            <StaffConfig
              key={s.id}
              s={s}
              templates={templates.filter((t) => t.staff_id === s.id)}
              supabase={supabase}
              onStaff={(ns) => onStaffChange(staff.map((x) => (x.id === ns.id ? ns : x)))}
              onTemplates={(list) => onTemplatesChange([...templates.filter((t) => t.staff_id !== s.id), ...list])}
              onMsg={setMsg}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StaffConfig({
  s,
  templates,
  supabase,
  onStaff,
  onTemplates,
  onMsg,
}: {
  s: Staff;
  templates: TaskTemplate[];
  supabase: SupabaseClient<Database>;
  onStaff: (s: Staff) => void;
  onTemplates: (t: TaskTemplate[]) => void;
  onMsg: (m: string) => void;
}) {
  const [pin, setPin] = useState('');
  const [start, setStart] = useState(s.start_time.slice(0, 5));
  const [newTask, setNewTask] = useState('');
  const active = templates.filter((t) => t.active).sort((a, b) => a.sort - b.sort);
  const input = 'rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm';

  async function savePin() {
    const { error } = await supabase.rpc('set_staff_pin', { p_staff: s.id, p_pin: pin });
    if (error) return onMsg(errorMessage(error));
    setPin('');
    onStaff({ ...s, pin_set: true });
    onMsg(`PIN de ${s.name} guardado.`);
  }

  async function saveStart() {
    const { error } = await supabase.from('staff').update({ start_time: start }).eq('id', s.id);
    if (error) return onMsg(errorMessage(error));
    onStaff({ ...s, start_time: start });
    onMsg(`${s.name} entra a las ${start}.`);
  }

  async function addTemplate() {
    const title = newTask.trim();
    if (!title) return;
    const { data, error } = await supabase
      .from('task_templates')
      .insert({ staff_id: s.id, title, sort: active.length + 1 })
      .select()
      .single();
    if (error) return onMsg(errorMessage(error));
    setNewTask('');
    onTemplates([...templates, data]);
  }

  async function removeTemplate(t: TaskTemplate) {
    const { error } = await supabase.from('task_templates').update({ active: false }).eq('id', t.id);
    if (error) return onMsg(errorMessage(error));
    onTemplates(templates.map((x) => (x.id === t.id ? { ...x, active: false } : x)));
  }

  return (
    <section className="card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold">{s.full_name}</h2>
        <span className={`badge ${s.pin_set ? 'bg-green/15 text-green' : 'bg-red/15 text-red'}`}>{s.pin_set ? 'Tiene PIN' : 'Sin PIN'}</span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-text-muted">
          PIN nuevo (4 números)
          <input
            id={`pin-${s.id}`}
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className={`${input} block w-28`}
          />
        </label>
        <button disabled={pin.length !== 4} onClick={savePin} className="rounded-[10px] bg-primary-bright px-3 py-2 text-sm text-bg disabled:opacity-40">
          Guardar PIN
        </button>
        <label className="ml-auto text-xs text-text-muted">
          Entrada
          <input id={`start-${s.id}`} type="time" value={start} onChange={(e) => setStart(e.target.value)} className={`${input} block`} />
        </label>
        <button onClick={saveStart} className="rounded-[10px] border border-border px-3 py-2 text-sm text-text-secondary">
          Guardar
        </button>
      </div>
      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">Tareas fijas (aparecen todos los días)</p>
        <ul className="flex flex-col gap-1.5">
          {active.map((t) => (
            <li key={t.id} className="flex justify-between gap-2 rounded-[8px] bg-bg-elevated px-3 py-2 text-sm">
              <span className="min-w-0">{t.title}</span>
              <button onClick={() => removeTemplate(t)} className="text-xs text-text-muted hover:text-red">
                Quitar
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input
            id={`tpl-${s.id}`}
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Nueva tarea fija"
            className={`${input} min-w-0 flex-1`}
          />
          <button onClick={addTemplate} className="rounded-[10px] bg-primary-bright px-3 py-2 text-sm text-bg">
            Agregar
          </button>
        </div>
        <p className="mt-1 text-[11px] text-text-muted">Los cambios en tareas fijas se ven desde mañana.</p>
      </div>
    </section>
  );
}
