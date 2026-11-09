-- Ventas repetidas: clientes mayoristas (ej. Emi) le compran varias veces al
-- mismo cliente en el mes. `contacts.estado = 'vendido'` sigue siendo "la
-- primera venta" de ese cliente; cada venta siguiente es una fila acá, con
-- su propia fecha, para que sume al objetivo del mes y al gráfico del día
-- correcto sin tener que recrear el cliente cada vez.

create table if not exists public.client_sales (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  seller_id text not null references public.sellers(id),
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists client_sales_contact_id_idx on public.client_sales(contact_id);
create index if not exists client_sales_seller_date_idx on public.client_sales(seller_id, date);

alter table public.client_sales enable row level security;

drop policy if exists client_sales_select on public.client_sales;
create policy client_sales_select on public.client_sales
  for select using (is_admin() or seller_id = current_seller_id());

drop policy if exists client_sales_insert on public.client_sales;
create policy client_sales_insert on public.client_sales
  for insert with check (is_admin() or seller_id = current_seller_id());

drop policy if exists client_sales_delete on public.client_sales;
create policy client_sales_delete on public.client_sales
  for delete using (is_admin() or seller_id = current_seller_id());

-- Ranking del equipo: suma las ventas repetidas del período a "vendidos".
create or replace function public.team_ranking()
returns table (
  seller_id text,
  seller_name text,
  sales int,
  target int,
  consultas int,
  respondidos int,
  ventas int
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with p as (
    select start_date, end_date from period where id = 1
  ),
  agg as (
    select
      contacts.seller_id,
      count(*) as consultas,
      count(*) filter (where estado = 'vendido') as vendidos,
      count(*) filter (where estado <> 'consulta') as respondidos
    from contacts, p
    where contacts.date between p.start_date and p.end_date
    group by contacts.seller_id
  ),
  rep as (
    select client_sales.seller_id, count(*) as ventas_repetidas
    from client_sales, p
    where client_sales.date between p.start_date and p.end_date
    group by client_sales.seller_id
  )
  select
    s.id,
    s.name,
    s.initial_sales + coalesce(a.vendidos, 0) + coalesce(r.ventas_repetidas, 0),
    s.target,
    coalesce(a.consultas, 0),
    coalesce(a.respondidos, 0),
    coalesce(a.vendidos, 0) + coalesce(r.ventas_repetidas, 0)
  from sellers s
  left join agg a on a.seller_id = s.id
  left join rep r on r.seller_id = s.id
  where s.active;
$$;

revoke all on function public.team_ranking() from public, anon;
grant execute on function public.team_ranking() to authenticated;

-- Cierre de mes: mismo agregado de ventas repetidas en el archivo histórico.
create or replace function public._close_period_internal(new_name text, new_start date, new_end date)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare p record;
begin
  if new_name is null or btrim(new_name) = '' or new_start is null or new_end is null or new_end < new_start then
    raise exception 'Datos del nuevo período inválidos';
  end if;

  select * into p from period where id = 1 for update;
  if new_start <= p.end_date then
    raise exception 'El nuevo período tiene que empezar después del %', p.end_date;
  end if;

  insert into period_history (
    period_name, start_date, end_date, seller_id, seller_name, initial_sales, sales,
    target, bonus_usd, reached, consultas, respondidos, presupuestos, seguimientos, perdidos
  )
  select
    p.name, p.start_date, p.end_date, s.id, s.name, s.initial_sales,
    s.initial_sales + coalesce(c.vendidos, 0) + coalesce(r.ventas_repetidas, 0),
    s.target, s.bonus_usd,
    s.target > 0 and s.initial_sales + coalesce(c.vendidos, 0) + coalesce(r.ventas_repetidas, 0) >= s.target,
    coalesce(c.consultas, 0), coalesce(c.respondidos, 0), coalesce(c.presupuestos, 0),
    coalesce(c.seguimientos, 0), coalesce(c.perdidos, 0)
  from sellers s
  left join (
    select
      seller_id,
      count(*) as consultas,
      count(*) filter (where estado = 'vendido') as vendidos,
      count(*) filter (where estado <> 'consulta') as respondidos,
      count(*) filter (where estado in ('presupuesto', 'seguimiento', 'vendido')) as presupuestos,
      count(*) filter (where estado in ('seguimiento', 'vendido')) as seguimientos,
      count(*) filter (where estado = 'perdido') as perdidos
    from contacts
    where date between p.start_date and p.end_date
    group by seller_id
  ) c on c.seller_id = s.id
  left join (
    select seller_id, count(*) as ventas_repetidas
    from client_sales
    where date between p.start_date and p.end_date
    group by seller_id
  ) r on r.seller_id = s.id
  where s.active
  on conflict (start_date, seller_id) do nothing;

  update sellers set initial_sales = 0 where active;
  update period set name = btrim(new_name), start_date = new_start, end_date = new_end where id = 1;
end;
$$;

revoke all on function public._close_period_internal(text, date, date) from public, anon, authenticated;
