import webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';
import { VAPID_PUBLIC_KEY } from '@/lib/push';

interface Target {
  title: string;
  body: string;
  subs: { endpoint: string; p256dh: string; auth: string }[];
}

/**
 * Avisa a los celulares del panel de control que un vendedor cargó un pedido
 * de stock. Lo llama la app del vendedor justo después de guardar el pedido.
 */
export async function POST(request: Request) {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!privateKey) return Response.json({ sent: 0, reason: 'Falta VAPID_PRIVATE_KEY' });

  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return Response.json({ error: 'Falta el pedido' }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('push_targets_for_stock', { p_id: id });
  if (error || !data) return Response.json({ error: 'Sin permiso' }, { status: 403 });

  const target = data as Target;
  webpush.setVapidDetails('mailto:admin@iseven.app', VAPID_PUBLIC_KEY, privateKey);
  const payload = JSON.stringify({ title: target.title, body: target.body, url: '/admin', tag: `stock-${id}` });

  let sent = 0;
  await Promise.all(
    target.subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 3600,
          urgency: 'high',
        });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await supabase.rpc('push_drop', { p_endpoint: s.endpoint });
      }
    })
  );
  return Response.json({ sent });
}
