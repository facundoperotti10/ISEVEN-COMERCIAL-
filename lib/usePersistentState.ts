'use client';

import { useEffect, useState } from 'react';

/**
 * Como useState, pero se acuerda del valor en esta pestaña (sessionStorage).
 * Sirve para que, al actualizar la app, se vuelva a la misma pestaña/sección.
 */
export function usePersistentState<T extends string>(key: string, initial: T, allowed?: readonly T[]) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(key) as T | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && (!allowed || allowed.includes(saved))) setValue(saved);
    } catch {
      /* sin storage: se usa el valor inicial */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      /* sin storage */
    }
  }, [key, value]);

  return [value, setValue] as const;
}
