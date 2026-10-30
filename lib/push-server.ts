import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';
import { VAPID_PUBLIC_KEY } from '@/lib/push';

export interface PushSub {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Manda un aviso a cada celular; borra los que el servicio dio de baja. */
export async function sendPush(
  supabase: SupabaseClient,
  subs: PushSub[],
  message: { title: string; body: string; url: string; tag: string }
): Promise<number> {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!privateKey) return 0;
  webpush.setVapidDetails('mailto:admin@iseven.app', VAPID_PUBLIC_KEY, privateKey);
  const payload = JSON.stringify(message);
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
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
  return sent;
}
