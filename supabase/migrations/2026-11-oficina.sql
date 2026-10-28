-- Oficina iSeven: equipo, fichaje (ingreso y egreso), tareas del día,
-- pedidos de stock y turnos del sábado.
--
-- Se corre UNA vez en el SQL editor de Supabase, DESPUÉS de crear en
-- Authentication → Users los usuarios nuevos (emi@iseven.app,
-- sofi@iseven.app, santi@iseven.app). Se puede volver a correr sin problema.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Equipo
-- ---------------------------------------------------------------------------

create table if not exists staff (
  id text primary key,
  name text not null,
  full_name text not null,
  area text not null check (area in ('minorista', 'mayorista', 'marketing', 'tecnico')),
  role_label text not null,
  is_manager boolean not null default false,
  seller_id text references sellers(id),
  start_time time not null default '10:00',
  pin_hash text,
  pin_set boolean not null default false,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

insert into staff (id, name, full_name, area, role_label, is_manager, seller_id, sort) values
  ('agus',  'Agus',  'Agustín Peralta',      'minorista', 'Gerente de ventas',    true,  'agus',  1),
  ('mateo', 'Mateo', 'Mateo Loforte',        'minorista', 'Ventas minoristas',    false, 'mateo', 2),
  ('fran',  'Fran',  'Francisco Casasnovas', 'minorista', 'Ventas minoristas',    false, 'fran',  3),
  ('emi',   'Emi',   'Emilia Heredia',       'mayorista', 'Ventas mayoristas',    false, null,    4),
  ('sofi',  'Sofi',  'Sofía Barrera',        'marketing', 'Marketing presencial', false, null,    5),
  ('santi', 'Santi', 'Santi Pacheco',        'tecnico',   'Servicio técnico',     false, null,    6)
on conflict (id) do update set
  name = excluded.name,
  full_name = excluded.full_name,
  area = excluded.area,
  role_label = excluded.role_label,
  is_manager = excluded.is_manager,
  seller_id = excluded.seller_id,
  sort = excluded.sort;

-- Perfiles: un usuario puede ser vendedor (seller_id) y/o integrante del equipo (staff_id).
alter table profiles add column if not exists staff_id text references staff(id);
alter table profiles drop constraint if exists profiles_seller_role_check;
alter table profiles add constraint profiles_seller_role_check check (
  (role = 'seller' and (seller_id is not null or staff_id is not null)) or (role = 'admin')
);

update profiles set staff_id = seller_id where seller_id in ('agus', 'mateo', 'fran');

insert into profiles (id, role, seller_id, staff_id, display_name)
select u.id, 'seller', null, s.id, s.name
from auth.users u
join staff s on u.email = s.id || '@iseven.app'
where s.id in ('emi', 'sofi', 'santi')
on conflict (id) do update set staff_id = excluded.staff_id, display_name = excluded.display_name;

create or replace function public.current_staff_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select staff_id from profiles where id = auth.uid();
$$;

-- true si el usuario es el gerente de ventas (ve a los vendedores minoristas).
create or replace function public.is_sales_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select s.is_manager from profiles p join staff s on s.id = p.staff_id where p.id = auth.uid()
  ), false);
$$;

-- true si el usuario puede ver los datos de ese integrante: él mismo, un admin,
-- o el gerente de ventas mirando a un vendedor minorista.
create or replace function public.can_see_staff(target text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or target = public.current_staff_id()
    or (public.is_sales_manager() and exists (select 1 from staff where id = target and area = 'minorista'));
$$;

alter table staff enable row level security;

drop policy if exists "staff_select" on staff;
create policy "staff_select" on staff for select using (auth.role() = 'authenticated');

drop policy if exists "staff_admin_write" on staff;
create policy "staff_admin_write" on staff for all using (public.is_admin()) with check (public.is_admin());

-- El hash del PIN nunca sale de la base.
revoke select on staff from anon, authenticated;
grant select (id, name, full_name, area, role_label, is_manager, seller_id, start_time, pin_set, active, sort, created_at)
  on staff to authenticated;

-- Hora local de Córdoba.
create or replace function public.now_ar()
returns timestamp
language sql
stable
as $$
  select (now() at time zone 'America/Argentina/Cordoba');
$$;

-- ---------------------------------------------------------------------------
-- Fichaje: dispositivo de la oficina, eventos y PIN
-- ---------------------------------------------------------------------------

create table if not exists kiosk_devices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token_hash text not null unique,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table kiosk_devices enable row level security;
drop policy if exists "kiosk_devices_admin" on kiosk_devices;
create policy "kiosk_devices_admin" on kiosk_devices for all using (public.is_admin()) with check (public.is_admin());

create table if not exists clock_events (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null references staff(id) on delete cascade,
  kind text not null check (kind in ('entrada', 'salida_comida', 'vuelta_comida', 'salida')),
  at timestamptz not null default now(),
  work_date date not null,
  late_minutes int not null default 0,
  photo_path text,
  device_id uuid references kiosk_devices(id) on delete set null,
  manual boolean not null default false,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists clock_events_staff_date_idx on clock_events(staff_id, work_date);
create index if not exists clock_events_date_idx on clock_events(work_date);

alter table clock_events enable row level security;

drop policy if exists "clock_events_select" on clock_events;
create policy "clock_events_select" on clock_events for select using (public.can_see_staff(staff_id));

drop policy if exists "clock_events_admin_write" on clock_events;
create policy "clock_events_admin_write" on clock_events for all using (public.is_admin()) with check (public.is_admin());

-- Admin: activa el dispositivo actual como reloj de fichaje. Devuelve el token
-- (se guarda solo en ese dispositivo; en la base queda el hash).
create or replace function public.register_kiosk(p_name text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare tok text;
begin
  if not public.is_admin() then raise exception 'Solo el panel de control puede activar el reloj'; end if;
  tok := encode(gen_random_bytes(24), 'hex');
  insert into kiosk_devices (name, token_hash, created_by)
  values (coalesce(nullif(btrim(p_name), ''), 'iPhone oficina'), encode(digest(tok, 'sha256'), 'hex'), auth.uid());
  return tok;
end;
$$;

create or replace function public._kiosk_device(p_token text)
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select id from kiosk_devices
  where active and token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- Admin: define el PIN de 4 números de un integrante.
create or replace function public.set_staff_pin(p_staff text, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_admin() then raise exception 'Solo el panel de control puede cambiar PINs'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'El PIN tiene que ser de 4 números'; end if;
  update staff set pin_hash = crypt(p_pin, gen_salt('bf')), pin_set = true where id = p_staff;
end;
$$;

-- Estado del día para la pantalla de fichaje (sin login, validado por dispositivo).
create or replace function public.kiosk_board(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare dev uuid; d date;
begin
  dev := public._kiosk_device(p_token);
  if dev is null then raise exception 'DEVICE'; end if;
  d := public.now_ar()::date;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'area', s.area,
      'pin_set', s.pin_set,
      'start_time', to_char(s.start_time, 'HH24:MI'),
      'last_kind', e.kind,
      'last_at', e.at,
      'lunch_at', (select max(at) from clock_events x where x.staff_id = s.id and x.work_date = d and x.kind = 'salida_comida')
    ) order by s.sort)
    from staff s
    left join lateral (
      select kind, at from clock_events c
      where c.staff_id = s.id and c.work_date = d
      order by at desc limit 1
    ) e on true
    where s.active
  ), '[]'::jsonb);
end;
$$;

-- Fichar. Valida dispositivo, PIN y orden de las marcas; calcula llegada tarde.
create or replace function public.kiosk_punch(p_token text, p_staff text, p_pin text, p_kind text, p_photo text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  dev uuid; s staff%rowtype; d date; local_now timestamp; last_kind text;
  lunch_at timestamptz; entrada_at timestamptz; vuelta_at timestamptz;
  late int := 0; worked int := null; ev uuid;
begin
  dev := public._kiosk_device(p_token);
  if dev is null then raise exception 'Este dispositivo no está habilitado para fichar'; end if;

  select * into s from staff where id = p_staff and active;
  if not found then raise exception 'No encontramos a esa persona'; end if;
  if s.pin_hash is null then raise exception 'Todavía no tenés PIN. Pedíselo a Facu o Mike'; end if;
  if crypt(coalesce(p_pin, ''), s.pin_hash) <> s.pin_hash then
    perform pg_sleep(1);
    raise exception 'PIN incorrecto';
  end if;

  local_now := public.now_ar();
  d := local_now::date;

  select kind into last_kind from clock_events
  where staff_id = s.id and work_date = d order by at desc limit 1;

  if not (
    (last_kind is null and p_kind = 'entrada')
    or (last_kind = 'entrada' and p_kind in ('salida_comida', 'salida'))
    or (last_kind = 'salida_comida' and p_kind = 'vuelta_comida')
    or (last_kind = 'vuelta_comida' and p_kind = 'salida')
  ) then
    raise exception 'Esa marca no corresponde ahora (última marca: %)', coalesce(last_kind, 'ninguna');
  end if;

  if p_kind = 'entrada' then
    late := greatest(0, floor(extract(epoch from (local_now - (d + s.start_time))) / 60))::int;
    if late <= 5 then late := 0; end if;
  elsif p_kind = 'vuelta_comida' then
    select max(at) into lunch_at from clock_events where staff_id = s.id and work_date = d and kind = 'salida_comida';
    late := greatest(0, floor(extract(epoch from (now() - lunch_at)) / 60) - 60)::int;
    if late <= 5 then late := 0; end if;
  end if;

  insert into clock_events (staff_id, kind, work_date, late_minutes, photo_path, device_id)
  values (s.id, p_kind, d, late, nullif(p_photo, ''), dev)
  returning id into ev;

  if p_kind = 'salida' then
    select min(at) filter (where kind = 'entrada'), max(at) filter (where kind = 'salida_comida'), max(at) filter (where kind = 'vuelta_comida')
      into entrada_at, lunch_at, vuelta_at
    from clock_events where staff_id = s.id and work_date = d;
    worked := floor(extract(epoch from (now() - entrada_at)) / 60)::int;
    if lunch_at is not null and vuelta_at is not null then
      worked := worked - floor(extract(epoch from (vuelta_at - lunch_at)) / 60)::int;
    end if;
  end if;

  return jsonb_build_object(
    'id', ev, 'name', s.name, 'kind', p_kind, 'at', now(),
    'late_minutes', late, 'worked_minutes', worked,
    'start_time', to_char(s.start_time, 'HH24:MI')
  );
end;
$$;

revoke all on function public.register_kiosk(text) from public, anon;
grant execute on function public.register_kiosk(text) to authenticated;
revoke all on function public._kiosk_device(text) from public, anon, authenticated;
revoke all on function public.set_staff_pin(text, text) from public, anon;
grant execute on function public.set_staff_pin(text, text) to authenticated;
grant execute on function public.kiosk_board(text) to anon, authenticated;
grant execute on function public.kiosk_punch(text, text, text, text, text) to anon, authenticated;

-- Fotos del fichaje: carpeta privada. El reloj sube, solo el panel de control ve y borra.
insert into storage.buckets (id, name, public) values ('fichajes', 'fichajes', false)
on conflict (id) do nothing;

drop policy if exists "fichajes_upload" on storage.objects;
create policy "fichajes_upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'fichajes');

drop policy if exists "fichajes_admin_read" on storage.objects;
create policy "fichajes_admin_read" on storage.objects for select to authenticated
  using (bucket_id = 'fichajes' and public.is_admin());

drop policy if exists "fichajes_admin_delete" on storage.objects;
create policy "fichajes_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'fichajes' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Turnos del sábado
-- ---------------------------------------------------------------------------

create table if not exists saturday_shifts (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null references staff(id) on delete cascade,
  date date not null check (extract(dow from date) = 6),
  start_time time not null default '10:00',
  end_time time not null default '14:00',
  note text,
  created_at timestamptz not null default now(),
  unique (staff_id, date)
);

alter table saturday_shifts enable row level security;

drop policy if exists "saturday_shifts_select" on saturday_shifts;
create policy "saturday_shifts_select" on saturday_shifts for select using (auth.role() = 'authenticated');
drop policy if exists "saturday_shifts_write" on saturday_shifts;
create policy "saturday_shifts_write" on saturday_shifts for all
  using (public.is_admin() or staff_id = public.current_staff_id())
  with check (public.is_admin() or staff_id = public.current_staff_id());

-- ---------------------------------------------------------------------------
-- Tareas
-- ---------------------------------------------------------------------------

create table if not exists task_templates (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null references staff(id) on delete cascade,
  title text not null,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null references staff(id) on delete cascade,
  date date not null,
  title text not null,
  source text not null default 'extra' check (source in ('fija', 'extra')),
  template_id uuid references task_templates(id) on delete set null,
  done_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (staff_id, date, template_id)
);

create index if not exists tasks_staff_date_idx on tasks(staff_id, date);

-- Tareas fijas iniciales (solo si la persona todavía no tiene ninguna).
insert into task_templates (staff_id, title, sort)
select v.staff_id, v.title, v.sort
from (values
  ('agus', 'Liderar a Mateo y Fran para que lleguen al objetivo del mes', 1),
  ('agus', 'Seguir el avance de cada vendedor y ayudar al que viene atrasado', 2),
  ('agus', 'Vender por redes: WhatsApp, Instagram y TikTok', 3),
  ('agus', 'Traer clientes a la oficina y entregar al cliente final', 4),
  ('agus', 'Cargar contactos y ventas en la app', 5),
  ('agus', 'Abrir la oficina', 6),
  ('mateo', 'Vender por redes: WhatsApp, Instagram y TikTok', 1),
  ('mateo', 'Traer clientes a la oficina', 2),
  ('mateo', 'Entregar el equipo al cliente final', 3),
  ('mateo', 'Cargar contactos y ventas en la app', 4),
  ('fran', 'Vender por redes: WhatsApp, Instagram y TikTok', 1),
  ('fran', 'Traer clientes a la oficina', 2),
  ('fran', 'Entregar el equipo al cliente final', 3),
  ('fran', 'Cargar contactos y ventas en la app', 4),
  ('emi', 'Vender por redes a revendedores', 1),
  ('emi', 'Traer clientes mayoristas y entregar', 2),
  ('emi', 'Mandar la lista de precios a revendedores', 3),
  ('emi', 'Contactar revendedores inactivos', 4),
  ('emi', 'Armar y despachar pedidos', 5),
  ('emi', 'Cargar ventas y cobros en la app', 6),
  ('sofi', 'Marketing en el local', 1),
  ('sofi', 'Vivo en TikTok', 2),
  ('santi', 'Revisar los usados que entran', 1),
  ('santi', 'Testear los equipos antes de entregarlos', 2),
  ('santi', 'Reparaciones y garantías', 3),
  ('santi', 'Informar a ventas el estado de cada equipo', 4)
) as v(staff_id, title, sort)
where not exists (select 1 from task_templates t where t.staff_id = v.staff_id);

-- Crea las tareas fijas del día para todo el equipo (si todavía no están).
create or replace function public.ensure_tasks(p_date date default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into tasks (staff_id, date, title, source, template_id, created_by)
  select t.staff_id, coalesce(p_date, public.now_ar()::date), t.title, 'fija', t.id, null
  from task_templates t
  join staff s on s.id = t.staff_id and s.active
  where t.active
    and extract(dow from coalesce(p_date, public.now_ar()::date)) <> 0
    -- Los sábados solo tienen tareas los que cargaron turno.
    and (
      extract(dow from coalesce(p_date, public.now_ar()::date)) <> 6
      or exists (
        select 1 from saturday_shifts sh
        where sh.staff_id = t.staff_id and sh.date = coalesce(p_date, public.now_ar()::date)
      )
    )
  on conflict (staff_id, date, template_id) do nothing;
$$;

revoke all on function public.ensure_tasks(date) from public, anon;
grant execute on function public.ensure_tasks(date) to authenticated;

alter table task_templates enable row level security;
alter table tasks enable row level security;

drop policy if exists "task_templates_select" on task_templates;
create policy "task_templates_select" on task_templates for select using (public.can_see_staff(staff_id));
drop policy if exists "task_templates_admin" on task_templates;
create policy "task_templates_admin" on task_templates for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "tasks_select" on tasks;
create policy "tasks_select" on tasks for select using (public.can_see_staff(staff_id));
drop policy if exists "tasks_insert" on tasks;
create policy "tasks_insert" on tasks for insert with check (public.can_see_staff(staff_id));
drop policy if exists "tasks_update" on tasks;
create policy "tasks_update" on tasks for update using (public.is_admin() or staff_id = public.current_staff_id())
  with check (public.is_admin() or staff_id = public.current_staff_id());
drop policy if exists "tasks_delete" on tasks;
create policy "tasks_delete" on tasks for delete using (public.is_admin() or (staff_id = public.current_staff_id() and source = 'extra'));

-- ---------------------------------------------------------------------------
-- Pedidos de stock (el depósito está en otro lugar: se agrupan por viaje)
-- ---------------------------------------------------------------------------

create table if not exists stock_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null references staff(id) on delete cascade,
  cliente text not null,
  turno_date date not null,
  turno_time time,
  modelo text not null,
  capacidad text,
  color text,
  tipo text not null default 'venta' check (tipo in ('venta', 'mostrar')),
  urgent boolean not null default false,
  trip_date date not null,
  trip_slot text not null check (trip_slot in ('10:00', '15:00', 'urgente')),
  status text not null default 'pendiente' check (status in ('pendiente', 'autorizado', 'rechazado', 'entregado')),
  note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists stock_requests_trip_idx on stock_requests(trip_date, trip_slot);

-- Reglas de corte:
--  · Turnos de un día futuro cargados hasta las 23:00 de la noche anterior → viaje de las 10:00.
--  · Cargados después de las 23:00 de la noche anterior → viaje de las 15:00.
--  · Para hoy, cargados antes de las 14:00 → viaje de las 15:00.
--  · Para hoy después de las 14:00 → solo como urgente (Mike decide).
create or replace function public.stock_request_assign_trip()
returns trigger
language plpgsql
set search_path = public
as $$
declare local_now timestamp := public.now_ar(); today date := public.now_ar()::date;
begin
  if tg_op = 'UPDATE' and new.turno_date = old.turno_date and new.urgent = old.urgent then
    return new;
  end if;

  if new.turno_date < today then
    raise exception 'La fecha del turno ya pasó';
  end if;

  new.trip_date := new.turno_date;

  if new.urgent then
    new.trip_slot := 'urgente';
  elsif new.turno_date > today + 1 then
    new.trip_slot := '10:00';
  elsif new.turno_date = today + 1 then
    new.trip_slot := case when local_now::time < '23:00' then '10:00' else '15:00' end;
  elsif local_now::time < '14:00' then
    new.trip_slot := '15:00';
  else
    raise exception 'Pasó el corte de las 14:00. Dale turno para mañana o marcalo como urgente';
  end if;

  return new;
end;
$$;

drop trigger if exists stock_requests_assign_trip on stock_requests;
create trigger stock_requests_assign_trip
  before insert or update on stock_requests
  for each row execute function public.stock_request_assign_trip();

alter table stock_requests enable row level security;

drop policy if exists "stock_requests_select" on stock_requests;
create policy "stock_requests_select" on stock_requests for select using (public.can_see_staff(staff_id));
drop policy if exists "stock_requests_insert" on stock_requests;
create policy "stock_requests_insert" on stock_requests for insert
  with check (public.is_admin() or (staff_id = public.current_staff_id() and status = 'pendiente'));
drop policy if exists "stock_requests_admin_update" on stock_requests;
create policy "stock_requests_admin_update" on stock_requests for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "stock_requests_delete" on stock_requests;
create policy "stock_requests_delete" on stock_requests for delete
  using (public.is_admin() or (staff_id = public.current_staff_id() and status = 'pendiente'));
