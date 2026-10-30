import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchAll } from '@/lib/fetch-all';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { todayAR } from '@/lib/calc';
import { STAFF_COLUMNS, dateARPlus, monthRange } from '@/lib/oficina';

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();

  // Si el mes ya terminó, lo cierra y arranca el siguiente (también corre solo cada noche).
  await supabase.rpc('auto_rollover_period');

  const today = todayAR();
  const month = monthRange(today);
  await supabase.rpc('ensure_tasks', {});

  const [
    { data: sellers },
    { data: period },
    contacts,
    { data: history },
    { data: staff },
    { data: events },
    { data: tasks },
    { data: templates },
    { data: stock },
    { data: shifts },
    { data: lots },
    { data: units },
  ] = await Promise.all([
    supabase.from('sellers').select('*').order('created_at', { ascending: true }),
    supabase.from('period').select('*').eq('id', 1).single(),
    fetchAll((from, to) =>
      supabase
        .from('contacts')
        .select('*')
        .order('date', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to)
    ),
    supabase.from('period_history').select('*').order('start_date', { ascending: false }),
    supabase.from('staff').select(STAFF_COLUMNS).eq('active', true).order('sort'),
    supabase.from('clock_events').select('*').gte('work_date', month.start).lte('work_date', month.end).order('at'),
    supabase.from('tasks').select('*').eq('date', today).order('created_at'),
    supabase.from('task_templates').select('*').order('sort'),
    supabase.from('stock_requests').select('*').gte('trip_date', dateARPlus(-14)).order('trip_date'),
    supabase.from('saturday_shifts').select('*').gte('date', today).order('date'),
    supabase.from('stock_lots').select('*').gte('received_at', `${dateARPlus(-21)}T00:00:00`).order('received_at'),
    supabase.from('reserved_units').select('*').gte('created_at', `${dateARPlus(-21)}T00:00:00`).order('created_at'),
  ]);

  if (!period) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center text-text-secondary">
        No hay un período configurado todavía.
      </main>
    );
  }

  return (
    <AdminDashboard
      initialSellers={sellers ?? []}
      initialPeriod={period}
      initialContacts={contacts}
      initialHistory={history ?? []}
      oficina={{
        today,
        staff: staff ?? [],
        events: events ?? [],
        tasks: tasks ?? [],
        templates: templates ?? [],
        stock: stock ?? [],
        shifts: shifts ?? [],
        lots: lots ?? [],
        units: units ?? [],
      }}
    />
  );
}
