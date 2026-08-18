'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-[10px] border border-border px-3 py-1.5 text-sm text-text-secondary transition hover:border-primary-bright hover:text-text"
    >
      Salir
    </button>
  );
}
