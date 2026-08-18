import { requireSeller } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { VendedorDashboard } from '@/components/vendedor/VendedorDashboard';

export default async function VendedorPage() {
  const profile = await requireSeller();
  const supabase = await createClient();

  const [{ data: seller }, { data: period }, { data: contacts }] = await Promise.all([
    supabase.from('sellers').select('*').eq('id', profile.sellerId!).single(),
    supabase.from('period').select('*').eq('id', 1).single(),
    supabase
      .from('contacts')
      .select('*')
      .eq('seller_id', profile.sellerId!)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
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
      initialContacts={contacts ?? []}
      sellerName={profile.displayName ?? seller.name}
    />
  );
}
