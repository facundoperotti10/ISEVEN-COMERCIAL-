import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: sellers }, { data: period }, { data: contacts }] = await Promise.all([
    supabase.from('sellers').select('*').order('created_at', { ascending: true }),
    supabase.from('period').select('*').eq('id', 1).single(),
    supabase.from('contacts').select('*').order('date', { ascending: false }),
  ]);

  if (!period) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center text-text-secondary">
        No hay un período configurado todavía.
      </main>
    );
  }

  return (
    <AdminDashboard initialSellers={sellers ?? []} initialPeriod={period} initialContacts={contacts ?? []} />
  );
}
