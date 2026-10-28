'use client';

import { useState } from 'react';
import type { Task } from '@/lib/oficina';
import { horaAR } from '@/lib/oficina';

interface TaskListProps {
  tasks: Task[];
  canToggle: boolean;
  canAdd: boolean;
  onToggle?: (task: Task) => void;
  onAdd?: (title: string) => Promise<void> | void;
  onDelete?: (task: Task) => void;
  emptyText?: string;
}

/** Checklist de tareas del día: fijas + extra. */
export function TaskList({ tasks, canToggle, canAdd, onToggle, onAdd, onDelete, emptyText }: TaskListProps) {
  const [title, setTitle] = useState('');
  const done = tasks.filter((t) => t.done_at).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs text-text-muted">
        <span>
          {done} de {tasks.length} hechas
        </span>
        <span className="h-1.5 w-28 overflow-hidden rounded-full bg-bg">
          <span
            className="block h-full rounded-full bg-green transition-all"
            style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }}
          />
        </span>
      </div>
      {tasks.length === 0 && <p className="text-sm text-text-muted">{emptyText ?? 'No hay tareas para hoy.'}</p>}
      <ul className="flex flex-col gap-2">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-start gap-3 rounded-[10px] bg-bg-elevated px-3 py-2.5">
            <button
              disabled={!canToggle}
              onClick={() => onToggle?.(t)}
              aria-label={t.done_at ? `Desmarcar ${t.title}` : `Marcar ${t.title} como hecha`}
              className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-md border-2 transition ${
                t.done_at ? 'border-green bg-green text-bg' : 'border-border'
              } ${canToggle ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {t.done_at && (
                <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
                  <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                </svg>
              )}
            </button>
            <span className="min-w-0 flex-1">
              <span className={`block text-sm ${t.done_at ? 'text-text-muted line-through' : 'text-text'}`}>{t.title}</span>
              <span className="text-[11px] text-text-muted">
                {t.done_at ? `Hecha ${horaAR(t.done_at)}` : 'Pendiente'}
              </span>
            </span>
            {onDelete && (
              <button onClick={() => onDelete(t)} className="text-xs text-text-muted hover:text-red" aria-label={`Borrar ${t.title}`}>
                Borrar
              </button>
            )}
          </li>
        ))}
      </ul>
      {canAdd && onAdd && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const v = title.trim();
            if (!v) return;
            await onAdd(v);
            setTitle('');
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nueva tarea"
            className="min-w-0 flex-1 rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm placeholder:text-text-muted focus:border-primary-bright focus:outline-none"
          />
          <button className="rounded-[10px] bg-primary-bright px-3 py-2 text-sm font-medium text-bg">Agregar</button>
        </form>
      )}
    </div>
  );
}
