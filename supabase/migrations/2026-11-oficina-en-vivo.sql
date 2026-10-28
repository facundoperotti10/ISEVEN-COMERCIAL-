-- Oficina en vivo: estado del día de cada integrante para la oficina animada.
-- Lo ve todo el equipo logueado, incluida la tarea en la que está cada uno,
-- para que todos sepan qué está haciendo el resto. Los dueños no aparecen.

create or replace function public.office_live()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare d date := public.now_ar()::date;
begin
  if auth.role() <> 'authenticated' then raise exception 'Necesitás iniciar sesión'; end if;
  return jsonb_build_object(
    'now', now(),
    'stock_pending', (select count(*) from stock_requests where status = 'pendiente' and trip_date >= d),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'area', s.area,
        'role_label', s.role_label,
        'is_manager', s.is_manager,
        'last_kind', e.kind,
        'last_at', e.at,
        'entrada_at', (select min(at) from clock_events c where c.staff_id = s.id and c.work_date = d and c.kind = 'entrada'),
        'lunch_at', (select max(at) from clock_events c where c.staff_id = s.id and c.work_date = d and c.kind = 'salida_comida'),
        'late_today', exists (select 1 from clock_events c where c.staff_id = s.id and c.work_date = d and c.late_minutes > 0),
        'tasks_total', (select count(*) from tasks t where t.staff_id = s.id and t.date = d),
        'tasks_done', (select count(*) from tasks t where t.staff_id = s.id and t.date = d and t.done_at is not null),
        'current_task', (
          select title from tasks t where t.staff_id = s.id and t.date = d and t.done_at is null
          order by t.source desc, t.created_at limit 1
        ),
        'stock_pending', (select count(*) from stock_requests r where r.staff_id = s.id and r.status = 'pendiente' and r.trip_date >= d)
      ) order by s.sort)
      from staff s
      left join lateral (
        select kind, at from clock_events c
        where c.staff_id = s.id and c.work_date = d
        order by at desc limit 1
      ) e on true
      where s.active
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.office_live() from public, anon;
grant execute on function public.office_live() to authenticated;
