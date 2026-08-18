-- ISEVEN Control Comercial — esquema Supabase (Postgres)
-- Ejecutar en el SQL editor de Supabase (o via `supabase db push`).

create extension if not exists pgcrypto;

do $$ begin
  create type contact_estado as enum ('consulta','respondio','presupuesto','seguimiento','vendido','perdido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('admin','seller');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists sellers (
  id text primary key,
  name text not null,
  target int not null default 0,
  initial_sales int not null default 0,
  bonus_usd numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists period (
  id int primary key default 1,
  name text not null,
  start_date date not null,
  end_date date not null,
  constraint period_single_row check (id = 1)
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  seller_id text not null references sellers(id) on delete cascade,
  date date not null default current_date,
  nombre text not null,
  telefono text,
  estado contact_estado not null default 'consulta',
  observacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contacts_seller_id_idx on contacts(seller_id);
create index if not exists contacts_date_idx on contacts(date);
create index if not exists contacts_estado_idx on contacts(estado);

-- Vincula un usuario de Supabase Auth a un vendedor o a un rol admin.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'seller',
  seller_id text references sellers(id),
  display_name text,
  created_at timestamptz not null default now(),
  constraint profiles_seller_role_check check (
    (role = 'seller' and seller_id is not null) or (role = 'admin')
  )
);

-- ---------------------------------------------------------------------------
-- updated_at automático en contacts
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists contacts_set_updated_at on contacts;
create trigger contacts_set_updated_at
  before update on contacts
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers de rol (security definer para evitar recursión de RLS en profiles)
-- ---------------------------------------------------------------------------

create or replace function public.current_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function public.current_seller_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select seller_id from profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from profiles where id = auth.uid()) = 'admin', false);
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table sellers enable row level security;
alter table period enable row level security;
alter table contacts enable row level security;
alter table profiles enable row level security;

-- profiles: cada usuario ve solo su propio perfil; los admins ven todos.
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles
  for select using (id = auth.uid() or public.is_admin());

-- sellers: un vendedor ve solo su propia fila; los admins ven y editan todo.
drop policy if exists "sellers_select" on sellers;
create policy "sellers_select" on sellers
  for select using (public.is_admin() or id = public.current_seller_id());

drop policy if exists "sellers_admin_write" on sellers;
create policy "sellers_admin_write" on sellers
  for all using (public.is_admin()) with check (public.is_admin());

-- period: todos los autenticados pueden leer; solo admin escribe.
drop policy if exists "period_select" on period;
create policy "period_select" on period
  for select using (auth.role() = 'authenticated');

drop policy if exists "period_admin_write" on period;
create policy "period_admin_write" on period
  for all using (public.is_admin()) with check (public.is_admin());

-- contacts: un vendedor lee/escribe solo lo propio; admin lee/escribe todo.
drop policy if exists "contacts_select" on contacts;
create policy "contacts_select" on contacts
  for select using (public.is_admin() or seller_id = public.current_seller_id());

drop policy if exists "contacts_insert" on contacts;
create policy "contacts_insert" on contacts
  for insert with check (public.is_admin() or seller_id = public.current_seller_id());

drop policy if exists "contacts_update" on contacts;
create policy "contacts_update" on contacts
  for update using (public.is_admin() or seller_id = public.current_seller_id())
  with check (public.is_admin() or seller_id = public.current_seller_id());

drop policy if exists "contacts_delete" on contacts;
create policy "contacts_delete" on contacts
  for delete using (public.is_admin() or seller_id = public.current_seller_id());

-- ---------------------------------------------------------------------------
-- Datos iniciales
-- ---------------------------------------------------------------------------

insert into sellers (id, name, target, initial_sales, bonus_usd, active) values
  ('agus', 'Agus', 90, 36, 300, true),
  ('mateo', 'Mateo', 70, 18, 200, true),
  ('fran', 'Fran', 40, 12, 150, true)
on conflict (id) do nothing;

insert into period (id, name, start_date, end_date) values
  (1, 'Agosto 2026', '2026-08-01', '2026-08-31')
on conflict (id) do update set
  name = excluded.name,
  start_date = excluded.start_date,
  end_date = excluded.end_date;
