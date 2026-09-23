-- Reinicio mensual con historial.
-- Crea period_history y la función close_period() que usa el botón
-- "Cerrar mes y empezar uno nuevo" (pestaña Objetivos).

create table if not exists public.period_history (
  id uuid primary key default gen_random_uuid(),
  period_name text not null,
  start_date date not null,
  end_date date not null,
  seller_id text not null references public.sellers(id) on delete cascade,
  seller_name text not null,
  initial_sales int not null default 0,
  sales int not null default 0,            -- initial_sales + vendidos del período
  target int not null default 0,
  bonus_usd numeric not null default 0,
  reached boolean not null default false,
  consultas int not null default 0,        -- mismas definiciones que lib/calc.ts
  respondidos int not null default 0,
  presupuestos int not null default 0,
  seguimientos int not null default 0,
  perdidos int not null default 0,
  closed_at timestamptz not null default now(),
  closed_by uuid default auth.uid(),
  unique (start_date, seller_id)
);

alter table public.period_history enable row level security;

drop policy if exists period_history_select on public.period_history;
create policy period_history_select on public.period_history
  for select using (is_admin() or seller_id = current_seller_id());

drop policy if exists period_history_admin_write on public.period_history;
create policy period_history_admin_write on public.period_history
  for all using (is_admin()) with check (is_admin());

create or replace function public.close_period(new_name text, new_start date, new_end date)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare p record;
begin
  if not is_admin() then
    raise exception 'Solo un administrador puede cerrar el mes';
  end if;
  if new_name is null or btrim(new_name) = '' or new_start is null or new_end is null or new_end < new_start then
    raise exception 'Datos del nuevo período inválidos';
  end if;

  select * into p from period where id = 1 for update;
  if new_start <= p.end_date then
    raise exception 'El nuevo período tiene que empezar después del %', p.end_date;
  end if;

  -- 1) Foto final de cada vendedor activo del período que cierra
  insert into period_history (
    period_name, start_date, end_date, seller_id, seller_name, initial_sales, sales,
    target, bonus_usd, reached, consultas, respondidos, presupuestos, seguimientos, perdidos
  )
  select
    p.name, p.start_date, p.end_date, s.id, s.name, s.initial_sales,
    s.initial_sales + coalesce(c.vendidos, 0),
    s.target, s.bonus_usd,
    s.target > 0 and s.initial_sales + coalesce(c.vendidos, 0) >= s.target,
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
  where s.active
  on conflict (start_date, seller_id) do nothing;

  -- 2) El nuevo mes arranca de cero. Objetivos y bonos no se tocan.
  update sellers set initial_sales = 0 where active;

  -- 3) Nuevo período activo
  update period set name = btrim(new_name), start_date = new_start, end_date = new_end where id = 1;
end;
$$;

revoke all on function public.close_period(text, date, date) from public, anon;
grant execute on function public.close_period(text, date, date) to authenticated;
