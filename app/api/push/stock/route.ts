import { createClient } from '@/lib/supabase/server';
import { sendPush, type PushSub } from '@/lib/push-server';

/**
 * Avisa a los celulares del panel de control que un vendedor cargó un pedido
 * de stock. Lo llama la app del vendedor justo después de guardar el pedido.
 */
export async function POST(request: Request) {
  if (!process.env.VAPID_PRIVATE_KEY) return Response.json({ sent: 0, reason: 'Falta VAPID_PRIVATE_KEY' });

  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return Response.json({ error: 'Falta el pedido' }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('push_targets_for_stock', { p_id: id });
  if (error || !data) return Response.json({ error: 'Sin permiso' }, { status: 403 });

  const t = data as { title: string; body: string; subs: PushSub[] };
  const sent = await sendPush(supabase, t.subs, { title: t.title, body: t.body, url: '/admin', tag: `stock-${id}` });
  return Response.json({ sent });
}
