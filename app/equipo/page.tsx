import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { todayAR } from '@/lib/calc';
import { STAFF_COLUMNS, dateARPlus, monthRange } from '@/lib/oficina';
import { EquipoDashboard } from '@/components/equipo/EquipoDashboard';

export default async function EquipoPage() {
  const profile = await requireStaff();
  const supabase = await createClient();
  const today = todayAR();
  const { start, end } = monthRange(today);

  await supabase.rpc('ensure_tasks', {});

  const [
    { data: staff },
    { data: tasks },
    { data: events },
    { data: stock },
    { data: shifts },
    { data: lots },
    { data: units },
  ] = await Promise.all([
    supabase.from('staff').select(STAFF_COLUMNS).eq('active', true).order('sort'),
    supabase.from('tasks').select('*').eq('date', today).order('created_at'),
    supabase.from('clock_events').select('*').gte('work_date', start).lte('work_date', end).order('at'),
    supabase
      .from('stock_requests')
      .select('*')
      .gte('turno_date', dateARPlus(-7))
      .order('turno_date')
      .order('turno_time'),
    supabase.from('saturday_shifts').select('*').gte('date', today).order('date'),
    supabase
      .from('stock_lots')
      .select('*')
      .gte('received_at', `${dateARPlus(-21)}T00:00:00`)
      .order('received_at'),
    supabase
      .from('reserved_units')
      .select('*')
      .gte('created_at', `${dateARPlus(-21)}T00:00:00`)
      .order('created_at'),
  ]);

  const me = (staff ?? []).find((s) => s.id === profile.staffId);
  if (!me) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center text-text-secondary">
        No encontramos tu ficha en el equipo. Avisale a Facu o Mike.
      </main>
    );
  }

  return (
    <EquipoDashboard
      me={me}
      staff={staff ?? []}
      initialTasks={tasks ?? []}
      events={events ?? []}
      initialStock={stock ?? []}
      initialShifts={shifts ?? []}
      initialLots={lots ?? []}
      initialUnits={units ?? []}
      today={today}
    />
  );
}
