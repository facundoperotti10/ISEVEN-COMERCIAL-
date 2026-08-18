'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ADMIN_LOGIN, LAST_LOGIN_KEY, SELLER_LOGINS } from '@/lib/login-config';

type Selection = { name: string; email: string } | null;

function subscribeNoop() {
  return () => {};
}

function getLastLoginSnapshot() {
  return window.localStorage.getItem(LAST_LOGIN_KEY);
}

function getLastLoginServerSnapshot() {
  return null;
}

export function LoginScreen() {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lastLogin = useSyncExternalStore(subscribeNoop, getLastLoginSnapshot, getLastLoginServerSnapshot);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selection) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: selection.email,
      password,
    });

    if (signInError) {
      setError('Contraseña incorrecta. Probá de nuevo.');
      setLoading(false);
      return;
    }

    window.localStorage.setItem(LAST_LOGIN_KEY, selection.name);
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-text">ISEVEN</h1>
          <p className="mt-1 text-sm text-text-secondary">Control comercial</p>
        </div>

        {!selection ? (
          <div className="card p-6">
            <p className="mb-4 text-xs uppercase tracking-wide text-text-muted">Ingresá como</p>
            <div className="flex flex-col gap-3">
              {SELLER_LOGINS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelection({ name: s.name, email: s.email });
                    setPassword('');
                    setError(null);
                  }}
                  className="flex items-center justify-between rounded-[10px] border border-border bg-bg-elevated px-4 py-3 text-left font-medium text-text transition hover:border-primary-bright hover:bg-primary/20"
                >
                  <span>{s.name}</span>
                  {lastLogin === s.name && (
                    <span className="text-[10px] text-text-muted">último ingreso</span>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-6 border-t border-border pt-4 text-center">
              <button
                onClick={() => {
                  setSelection({ name: ADMIN_LOGIN.name, email: ADMIN_LOGIN.email });
                  setPassword('');
                  setError(null);
                }}
                className="text-sm text-text-secondary underline decoration-dotted underline-offset-4 hover:text-primary-bright"
              >
                Panel de control
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6">
            <button
              type="button"
              onClick={() => setSelection(null)}
              className="mb-4 text-xs text-text-muted hover:text-text-secondary"
            >
              ← volver
            </button>
            <p className="mb-4 text-lg font-display font-bold text-text">{selection.name}</p>
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full rounded-[10px] border border-border bg-bg-elevated px-4 py-3 text-text placeholder:text-text-muted focus:border-primary-bright focus:outline-none"
            />
            {error && <p className="mt-2 text-sm text-red">{error}</p>}
            <button
              type="submit"
              disabled={loading || password.length === 0}
              className="mt-4 w-full rounded-[10px] bg-primary-bright px-4 py-3 font-medium text-bg transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
