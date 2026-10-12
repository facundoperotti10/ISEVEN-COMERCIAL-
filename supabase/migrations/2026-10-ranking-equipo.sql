-- Ranking del equipo, visible para los vendedores.
-- Expone solo métricas agregadas por vendedor (nombre, ventas, objetivo,
-- consultas, respondidos) del período activo — nunca nombres de clientes,
-- teléfonos ni observaciones, que siguen siendo privados de cada vendedor
-- (las políticas de RLS de `contacts` no cambian).

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
  )
  select
    s.id,
    s.name,
    s.initial_sales + coalesce(a.vendidos, 0),
    s.target,
    coalesce(a.consultas, 0),
    coalesce(a.respondidos, 0),
    coalesce(a.vendidos, 0)
  from sellers s
  left join agg a on a.seller_id = s.id
  where s.active;
$$;

revoke all on function public.team_ranking() from public, anon;
grant execute on function public.team_ranking() to authenticated;
