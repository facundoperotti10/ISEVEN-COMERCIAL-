import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/database.types';

export interface SessionProfile {
  userId: string;
  role: UserRole;
  sellerId: string | null;
  staffId: string | null;
  displayName: string | null;
}

export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  let { data: profile } = await supabase
    .from('profiles')
    .select('role, seller_id, staff_id, display_name')
    .eq('id', user.id)
    .single();

  // Si la migración de la oficina todavía no se corrió, la columna staff_id
  // no existe: se lee el perfil como antes para que el login no se rompa.
  if (!profile) {
    const { data: legacy } = await supabase
      .from('profiles')
      .select('role, seller_id, display_name')
      .eq('id', user.id)
      .single();
    profile = legacy ? { ...legacy, staff_id: null } : null;
  }

  if (!profile) return null;

  return {
    userId: user.id,
    role: profile.role,
    sellerId: profile.seller_id,
    staffId: profile.staff_id,
    displayName: profile.display_name,
  };
}

export async function requireProfile(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect('/login');
  return profile;
}

export async function requireAdmin(): Promise<SessionProfile> {
  const profile = await requireProfile();
  if (profile.role !== 'admin') redirect('/vendedor');
  return profile;
}

export async function requireSeller(): Promise<SessionProfile> {
  const profile = await requireProfile();
  if (profile.role !== 'seller') redirect('/admin');
  if (!profile.sellerId) redirect(profile.staffId ? '/equipo' : '/login');
  return profile;
}

/** Integrante del equipo (vendedores, mayorista, marketing, técnico). */
export async function requireStaff(): Promise<SessionProfile> {
  const profile = await requireProfile();
  if (profile.role === 'admin') redirect('/admin');
  if (!profile.staffId) redirect('/vendedor');
  return profile;
}

/** Ruta de inicio según el perfil. */
export function homePath(profile: SessionProfile): string {
  if (profile.role === 'admin') return '/admin';
  if (profile.sellerId) return '/vendedor';
  return '/equipo';
}
