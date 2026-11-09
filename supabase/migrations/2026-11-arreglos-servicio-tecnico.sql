-- Servicio técnico: Santi carga cada arreglo que hace (IMEI, modelo, qué se
-- le hizo y una observación opcional). Cada técnico ve y edita solo lo suyo;
-- los admins ven todo desde el panel (apartado Servicio técnico).

create table if not exists public.repairs (
  id uuid primary key default gen_random_uuid(),
  seller_id text not null references public.sellers(id),
  date date not null default (now() at time zone 'America/Argentina/Cordoba')::date,
  imei text not null,
  modelo text not null,
  arreglo text not null,
  observacion text,
  created_at timestamptz not null default now()
);

create index if not exists repairs_date_idx on public.repairs(date);
create index if not exists repairs_seller_date_idx on public.repairs(seller_id, date);
create index if not exists repairs_imei_idx on public.repairs(imei);

alter table public.repairs enable row level security;

drop policy if exists repairs_select on public.repairs;
create policy repairs_select on public.repairs
  for select using (is_admin() or seller_id = current_seller_id());

drop policy if exists repairs_insert on public.repairs;
create policy repairs_insert on public.repairs
  for insert with check (is_admin() or seller_id = current_seller_id());

drop policy if exists repairs_update on public.repairs;
create policy repairs_update on public.repairs
  for update using (is_admin() or seller_id = current_seller_id())
  with check (is_admin() or seller_id = current_seller_id());

drop policy if exists repairs_delete on public.repairs;
create policy repairs_delete on public.repairs
  for delete using (is_admin() or seller_id = current_seller_id());

notify pgrst, 'reload schema';
