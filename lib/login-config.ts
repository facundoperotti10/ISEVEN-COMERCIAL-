// Mapeo de nombre de vendedor -> email de Supabase Auth.
// Debe coincidir con scripts/seed-users.mjs.

export const SELLER_LOGINS = [
  { id: 'agus', name: 'Agus', email: 'agus@iseven.app' },
  { id: 'mateo', name: 'Mateo', email: 'mateo@iseven.app' },
  { id: 'fran', name: 'Fran', email: 'fran@iseven.app' },
] as const;

export const ADMIN_LOGIN = { name: 'Panel de control', email: 'admin@iseven.app' } as const;

export const LAST_LOGIN_KEY = 'iseven:last-login';
