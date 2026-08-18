import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/database.types';

export interface SessionProfile {
  userId: string;
  role: UserRole;
  sellerId: string | null;
  displayName: string | null;
}

export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, seller_id, display_name')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return {
    userId: user.id,
    role: profile.role,
    sellerId: profile.seller_id,
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
  if (profile.role !== 'seller' || !profile.sellerId) redirect('/admin');
  return profile;
}
