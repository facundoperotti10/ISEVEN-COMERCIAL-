-- Ventas de accesorios (mayorista): Emi registra a qué cliente le vendió
-- accesorios, qué (funda, cargador, vidrio...) y cuántas unidades. Se ven
-- aparte: NO suman al objetivo de equipos del mes ni al ranking.

create table if not exists public.accessory_sales (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  seller_id text not null references public.sellers(id),
  date date not null default (now() at time zone 'America/Argentina/Cordoba')::date,
  descripcion text not null,
  cantidad int not null default 1 check (cantidad > 0),
  created_at timestamptz not null default now()
);

create index if not exists accessory_sales_contact_id_idx on public.accessory_sales(contact_id);
create index if not exists accessory_sales_seller_date_idx on public.accessory_sales(seller_id, date);

alter table public.accessory_sales enable row level security;

drop policy if exists accessory_sales_select on public.accessory_sales;
create policy accessory_sales_select on public.accessory_sales
  for select using (is_admin() or seller_id = current_seller_id());

drop policy if exists accessory_sales_insert on public.accessory_sales;
create policy accessory_sales_insert on public.accessory_sales
  for insert with check (is_admin() or seller_id = current_seller_id());

drop policy if exists accessory_sales_delete on public.accessory_sales;
create policy accessory_sales_delete on public.accessory_sales
  for delete using (is_admin() or seller_id = current_seller_id());

notify pgrst, 'reload schema';
