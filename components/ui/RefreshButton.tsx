'use client';

import { useState } from 'react';

/** Recarga la pantalla con los datos nuevos, sin cerrar la sesión. */
export function RefreshButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={() => {
        setBusy(true);
        window.location.reload();
      }}
      aria-label="Actualizar"
      className="flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-sm text-text-secondary transition hover:border-primary-bright hover:text-text"
    >
      <span className={busy ? 'inline-block animate-spin' : 'inline-block'} aria-hidden="true">
        ↻
      </span>
      Actualizar
    </button>
  );
}
