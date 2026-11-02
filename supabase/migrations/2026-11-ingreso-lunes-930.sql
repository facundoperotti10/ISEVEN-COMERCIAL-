-- Horario de ingreso de los lunes: 9:30 (el resto de los días sigue siendo start_time, 10:00).
-- Correr una sola vez en Supabase → SQL Editor. Es seguro volver a correrla.

alter table public.staff add column if not exists monday_start_time time not null default '09:30';

-- Hora de ingreso que corresponde a un día: lunes usa monday_start_time, el resto start_time.
create or replace function public.staff_start_for(p_start time, p_monday time, p_date date)
returns time
language sql
immutable
as $$ select case when extract(dow from p_date) = 1 then p_monday else p_start end $$;

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
      'start_time', to_char(public.staff_start_for(s.start_time, s.monday_start_time, d), 'HH24:MI'),
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
    late := greatest(0, floor(extract(epoch from (local_now - (d + public.staff_start_for(s.start_time, s.monday_start_time, d)))) / 60))::int;
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
    'start_time', to_char(public.staff_start_for(s.start_time, s.monday_start_time, d), 'HH24:MI')
  );
end;
$$;

grant execute on function public.staff_start_for(time, time, date) to anon, authenticated;
grant execute on function public.kiosk_board(text) to anon, authenticated;
grant execute on function public.kiosk_punch(text, text, text, text, text) to anon, authenticated;
