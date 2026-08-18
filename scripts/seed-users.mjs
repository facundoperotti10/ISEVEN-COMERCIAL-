// Crea los usuarios de Supabase Auth + su fila en `profiles`.
// Se corre UNA sola vez, en forma local, con la service role key (nunca en el
// cliente ni committeada). No se ejecuta como parte del build de Vercel.
//
// Uso:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-users.mjs
//
// Podés cambiar las contraseñas antes de correrlo (o después, desde el
// dashboard de Supabase Auth). Las de acá son las que ya usaba el prototipo,
// para no romper el flujo de login del equipo durante la migración.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Faltan variables de entorno. Necesitás NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ' +
      '(la service_role key está en Supabase → Project Settings → API, NO es la anon key).'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  { email: 'agus@iseven.app', password: 'AP1234567', role: 'seller', seller_id: 'agus', display_name: 'Agus' },
  { email: 'mateo@iseven.app', password: 'ML1234567', role: 'seller', seller_id: 'mateo', display_name: 'Mateo' },
  { email: 'fran@iseven.app', password: 'FC1234567', role: 'seller', seller_id: 'fran', display_name: 'Fran' },
  { email: 'admin@iseven.app', password: 'FM2025', role: 'admin', seller_id: null, display_name: 'Panel de control' },
];

async function upsertUser(u) {
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw listErr;

  let user = list.users.find((x) => x.email === u.email);

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { display_name: u.display_name },
    });
    if (error) throw error;
    user = data.user;
    console.log(`Creado ${u.email}`);
  } else {
    console.log(`Ya existía ${u.email}, actualizo perfil`);
  }

  const { error: profileErr } = await supabase.from('profiles').upsert({
    id: user.id,
    role: u.role,
    seller_id: u.seller_id,
    display_name: u.display_name,
  });
  if (profileErr) throw profileErr;
}

for (const u of USERS) {
  await upsertUser(u);
}

console.log('Listo. Usuarios y perfiles sincronizados.');
