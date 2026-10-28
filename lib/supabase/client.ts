'use client';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/env';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';

export function createClient() {
  return createBrowserClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
}
