import { createClient } from '@/lib/supabase/server';
import { sendPush, type PushSub } from '@/lib/push-server';

/**
 * Aviso de equipos del cupo del local que cumplieron las 72 h y pasan a estar
 * disponibles para todos. Lo llama una tarea programada de Supabase cada 10
 * minutos con una clave interna que valida la base.
 */
export async function POST(request: Request) {
  // Sin la clave de avisos no se marca nada, así no se pierde el aviso.
  if (!process.env.VAPID_PRIVATE_KEY) return Response.json({ sent: 0, reason: 'Falta VAPID_PRIVATE_KEY' });

  const { secret } = (await request.json().catch(() => ({}))) as { secret?: string };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('release_due', { p_secret: secret ?? '' });
  if (error || !data) return Response.json({ error: 'Sin permiso' }, { status: 403 });

  const r = data as { count: number; title?: string; body?: string; subs: PushSub[] };
  if (!r.count) return Response.json({ sent: 0, released: 0 });
  const sent = await sendPush(supabase, r.subs, {
    title: r.title ?? 'Stock liberado',
    body: r.body ?? '',
    url: '/admin',
    tag: `release-${Date.now()}`,
  });
  return Response.json({ sent, released: r.count });
}
