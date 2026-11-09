import { requireSeller } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchAll } from '@/lib/fetch-all';
import { VendedorDashboard } from '@/components/vendedor/VendedorDashboard';
import { TecnicoDashboard } from '@/components/tecnico/TecnicoDashboard';
import { sellerArea } from '@/lib/calc';

export default async function VendedorPage() {
  const profile = await requireSeller();
  const supabase = await createClient();

  // Servicio técnico: en vez del tablero de ventas, la pantalla para cargar arreglos.
  const { data: me } = await supabase.from('sellers').select('*').eq('id', profile.sellerId!).single();
  if (me && sellerArea(me) === 'tecnico') {
    const repairs = await fetchAll((from, to) =>
      supabase
        .from('repairs')
        .select('*')
        .eq('seller_id', me.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)
    );
    return <TecnicoDashboard seller={me} initialRepairs={repairs} name={profile.displayName ?? me.name} />;
  }

  // Si el mes ya terminó, lo cierra y arranca el siguiente (también corre solo cada noche).
  await supabase.rpc('auto_rollover_period');

  const [{ data: seller }, { data: period }, contacts, { data: clientSales }, { data: ranking }] = await Promise.all([
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
    supabase.from('client_sales').select('*').eq('seller_id', profile.sellerId!),
    supabase.rpc('team_ranking'),
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
      initialClientSales={clientSales ?? []}
      initialRanking={ranking ?? []}
      sellerName={profile.displayName ?? seller.name}
    />
  );
}
