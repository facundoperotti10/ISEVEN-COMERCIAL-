'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/** Cada cuánto, sin que nadie toque la app, se recarga sola con los datos nuevos. */
const INACTIVO_MS = 2 * 60_000;
/** Si la app estuvo en segundo plano más que esto, al volver se recarga. */
const AFUERA_MS = 30_000;

/** ¿Hay algo a medio escribir que se perdería al recargar? */
function hayAlgoEscrito(): boolean {
  const a = document.activeElement as HTMLElement | null;
  if (a && (a.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName))) return true;
  const campos = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'form input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=date]):not([type=time]):not([type=month]), form textarea'
  );
  for (const c of campos) if (!c.readOnly && !c.disabled && c.value.trim() !== '') return true;
  return false;
}

/**
 * Mantiene la app al día sin tener que salir y volver a entrar:
 *  · al volver a la app después de un rato, se recarga sola;
 *  · si nadie la toca por 2 minutos, se recarga sola;
 *  · si se publicó una versión nueva, muestra un aviso para actualizar.
 * Nunca recarga si alguien está escribiendo algo.
 */
export function AutoUpdate() {
  const pathname = usePathname();
  const activo = pathname !== '/login' && !pathname.startsWith('/fichaje');
  const [nueva, setNueva] = useState(false);
  const cargada = useRef(0);
  const ultimoToque = useRef(0);
  const ocultaDesde = useRef<number | null>(null);
  const version = useRef<string | null>(null);

  useEffect(() => {
    if (!activo) return;
    cargada.current = Date.now();
    ultimoToque.current = Date.now();

    const recargar = () => {
      if (!hayAlgoEscrito()) window.location.reload();
    };
    const toque = () => {
      ultimoToque.current = Date.now();
    };
    const visibilidad = () => {
      if (document.visibilityState === 'hidden') {
        ocultaDesde.current = Date.now();
      } else if (ocultaDesde.current && Date.now() - ocultaDesde.current > AFUERA_MS) {
        ocultaDesde.current = null;
        recargar();
      }
    };
    async function revisarVersion() {
      try {
        const r = await fetch('/api/version', { cache: 'no-store' });
        const { v } = (await r.json()) as { v: string };
        if (version.current === null) version.current = v;
        else if (v !== version.current) setNueva(true);
      } catch {
        /* sin conexión: se reintenta en el próximo ciclo */
      }
    }

    const reloj = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const ahora = Date.now();
      if (ahora - ultimoToque.current > INACTIVO_MS && ahora - cargada.current > INACTIVO_MS) recargar();
      revisarVersion();
    }, 30_000);

    revisarVersion();
    const eventos = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    eventos.forEach((e) => window.addEventListener(e, toque, { passive: true }));
    document.addEventListener('visibilitychange', visibilidad);
    return () => {
      window.clearInterval(reloj);
      eventos.forEach((e) => window.removeEventListener(e, toque));
      document.removeEventListener('visibilitychange', visibilidad);
    };
  }, [activo]);

  if (!activo || !nueva) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex w-full max-w-md items-center gap-3 rounded-[14px] border border-primary-bright bg-card px-4 py-3 shadow-2xl">
        <span className="text-xl" aria-hidden="true">
          ✨
        </span>
        <span className="flex-1 text-sm text-text">Hay una versión nueva de la app.</span>
        <button
          onClick={() => window.location.reload()}
          className="rounded-[10px] bg-primary-bright px-3 py-1.5 text-sm font-semibold text-bg"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
}
