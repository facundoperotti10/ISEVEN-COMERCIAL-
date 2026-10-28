'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from '@/lib/push';

type State = 'cargando' | 'no-soportado' | 'instalar' | 'bloqueado' | 'apagado' | 'activo';

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Botón para recibir en este celular los avisos de pedidos de stock. */
export function PushToggle() {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<State>('cargando');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: State;
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        next = isIOS() && !isStandalone() ? 'instalar' : 'no-soportado';
      } else if (Notification.permission === 'denied') {
        next = 'bloqueado';
      } else {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
        const sub = await reg.pushManager.getSubscription();
        next = sub ? 'activo' : 'apagado';
      }
      if (!cancelled) setState(next);
    })().catch(() => !cancelled && setState('no-soportado'));
    return () => {
      cancelled = true;
    };
  }, []);

  async function activar() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setState('bloqueado');
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }, { onConflict: 'endpoint' });
      if (error) throw error;
      setState('activo');
      setMsg('Listo: este celular va a recibir un aviso cada vez que pidan stock.');
    } catch {
      setMsg('No se pudo activar. Probá de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  async function apagar() {
    setBusy(true);
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
    setState('apagado');
    setBusy(false);
  }

  const text: Record<State, string> = {
    cargando: 'Revisando…',
    'no-soportado': 'Este navegador no recibe avisos. En la compu usá Chrome; en el iPhone, la app instalada.',
    instalar: 'Para recibir avisos en el iPhone: tocá Compartir → "Agregar a pantalla de inicio", abrí la app desde ese ícono y volvé acá.',
    bloqueado: 'Los avisos están bloqueados. Activalos en Ajustes → Notificaciones → ISEVEN y volvé a tocar el botón.',
    apagado: 'Activá los avisos para enterarte al toque cuando un vendedor pida stock.',
    activo: 'Este celular recibe un aviso cada vez que pidan stock.',
  };

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-bold">Avisos en este celular</p>
        <p className="text-xs text-text-secondary">{msg ?? text[state]}</p>
      </div>
      {state === 'apagado' || state === 'bloqueado' ? (
        <button
          onClick={activar}
          disabled={busy}
          className="rounded-[10px] bg-orange px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50"
        >
          {busy ? 'Activando…' : 'Activar avisos'}
        </button>
      ) : state === 'activo' ? (
        <button onClick={apagar} disabled={busy} className="rounded-[10px] border border-border px-3 py-2 text-xs text-text-secondary">
          Desactivar
        </button>
      ) : null}
    </div>
  );
}
