import { createClient } from '@/lib/supabase/server';
import { sendPush, type PushSub } from '@/lib/push-server';

/** Manda un aviso de prueba a los celulares del usuario que lo pide (solo a los suyos). */
export async function POST() {
  if (!process.env.VAPID_PRIVATE_KEY) {
    return Response.json({ sent: 0, reason: 'Falta la clave VAPID_PRIVATE_KEY en Vercel' }, { status: 500 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Sin sesión' }, { status: 401 });

  // RLS: cada usuario solo ve sus propios celulares.
  const { data } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', user.id);
  const subs = (data ?? []) as PushSub[];
  if (subs.length === 0) return Response.json({ sent: 0, reason: 'Este usuario no tiene celulares anotados' });

  const sent = await sendPush(supabase, subs, {
    title: 'ISEVEN · aviso de prueba',
    body: 'Si ves esto, las notificaciones de pedidos de stock funcionan.',
    url: '/admin',
    tag: `test-${Date.now()}`,
  });
  return Response.json({ sent, total: subs.length });
}
