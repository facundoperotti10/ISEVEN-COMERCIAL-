// Claves públicas de Supabase (la "publishable key" viaja igual al navegador;
// lo que protege los datos son las políticas de Row Level Security).
// Si el entorno no las tiene cargadas (por ejemplo, las vistas previas de
// Vercel), se usan estas para que la app no se rompa.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ihqulihyqvfuljfeynaq.supabase.co';
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_i9Lor6OdYNWqpsuSh-y8ZA_OIahZlDy';
