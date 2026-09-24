-- Cierre de mes automático.
-- Cuando termina el período activo, se guarda la foto de cada vendedor en
-- period_history y arranca el mes siguiente (ventas en 0, objetivos y bonos iguales).
-- Corre solo todos los días (pg_cron) y además cada vez que alguien abre la app.

-- 1) Lógica de cierre sin chequeo de rol (solo la usan funciones internas)
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

  update sellers set initial_sales = 0 where active;
  update period set name = btrim(new_name), start_date = new_start, end_date = new_end where id = 1;
end;
$$;

revoke all on function public._close_period_internal(text, date, date) from public, anon, authenticated;

-- 2) Cierre manual (admin) reutiliza la misma lógica
create or replace function public.close_period(new_name text, new_start date, new_end date)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not is_admin() then
    raise exception 'Solo un administrador puede cerrar el mes';
  end if;
  perform _close_period_internal(new_name, new_start, new_end);
end;
$$;

-- 3) Pasaje automático: si el período ya terminó (hora Argentina), cierra y abre
--    el mes calendario siguiente. Si pasaron varios meses, los cierra uno por uno.
create or replace function public.auto_rollover_period()
returns int
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  hoy date := (now() at time zone 'America/Argentina/Cordoba')::date;
  meses text[] := array['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  p record;
  ini date;
  fin date;
  n int := 0;
begin
  -- evita que dos llamadas simultáneas cierren el mismo mes
  perform pg_advisory_xact_lock(hashtext('iseven_auto_rollover'));
  loop
    select * into p from period where id = 1;
    exit when p is null or hoy <= p.end_date or n >= 24;
    ini := p.end_date + 1;
    fin := (date_trunc('month', ini) + interval '1 month - 1 day')::date;
    perform _close_period_internal(meses[extract(month from ini)::int] || ' ' || extract(year from ini)::int, ini, fin);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.auto_rollover_period() from public, anon;
grant execute on function public.auto_rollover_period() to authenticated;

-- 4) Tarea diaria: 00:05 hora Argentina (03:05 UTC)
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'iseven-auto-rollover';
select cron.schedule('iseven-auto-rollover', '5 3 * * *', 'select public.auto_rollover_period();');
