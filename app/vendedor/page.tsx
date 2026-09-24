import { requireSeller } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchAll } from '@/lib/fetch-all';
import { VendedorDashboard } from '@/components/vendedor/VendedorDashboard';

export default async function VendedorPage() {
  const profile = await requireSeller();
  const supabase = await createClient();

  // Si el mes ya terminó, lo cierra y arranca el siguiente (también corre solo cada noche).
  await supabase.rpc('auto_rollover_period');

  const [{ data: seller }, { data: period }, contacts] = await Promise.all([
    supabase.from('sellers').select('*').eq('id', profile.sellerId!).single(),
    supabase.from('period').select('*').eq('id', 1).single(),
    fetchAll((from, to) =>
      supabase
        .from('contacts')
        .select('*')
        .eq('seller_id', profile.sellerId!)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to)
    ),
  ]);

  if (!seller || !period) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center text-text-secondary">
        No se pudo cargar tu información. Contactá a un admin.
      </main>
    );
  }

  return (
    <VendedorDashboard
      seller={seller}
      period={period}
      initialContacts={contacts}
      sellerName={profile.displayName ?? seller.name}
    />
  );
}
