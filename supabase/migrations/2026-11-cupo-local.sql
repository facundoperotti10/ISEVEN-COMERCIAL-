-- Cupo del local: de cada caja que entra se separan equipos para el minorista.
-- Durante 72 h solo los pueden vender los vendedores del local; después se
-- liberan y los puede vender cualquiera (minorista o mayorista). Al liberarse,
-- les llega un aviso a los encargados de stock (panel de control).

create table if not exists stock_lots (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists reserved_units (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references stock_lots(id) on delete cascade,
  modelo text not null,
  capacidad text,
  color text,
  imei text check (imei is null or imei ~ '^[0-9]{4}$'),
  reserved_at timestamptz not null default now(),
  release_at timestamptz not null default now() + interval '72 hours',
  status text not null default 'reservado' check (status in ('reservado', 'vendido')),
  sold_by text references staff(id),
  sold_at timestamptz,
  release_notified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists reserved_units_lot_idx on reserved_units(lot_id);
create index if not exists reserved_units_release_idx on reserved_units(release_at) where status = 'reservado';

alter table stock_lots enable row level security;
alter table reserved_units enable row level security;

drop policy if exists "stock_lots_select" on stock_lots;
create policy "stock_lots_select" on stock_lots for select using (auth.role() = 'authenticated');
drop policy if exists "stock_lots_admin" on stock_lots;
create policy "stock_lots_admin" on stock_lots for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "reserved_units_select" on reserved_units;
create policy "reserved_units_select" on reserved_units for select using (auth.role() = 'authenticated');
drop policy if exists "reserved_units_admin" on reserved_units;
create policy "reserved_units_admin" on reserved_units for all using (public.is_admin()) with check (public.is_admin());

-- Marcar un equipo del cupo como vendido. Antes de las 72 h solo el minorista
-- (o el panel de control); después, cualquiera del equipo.
create or replace function public.sell_reserved(p_id uuid)
returns reserved_units
language plpgsql
security definer
set search_path = public
as $$
declare u reserved_units%rowtype; me text := public.current_staff_id(); my_area text;
begin
  select * into u from reserved_units where id = p_id for update;
  if not found then raise exception 'No encontramos ese equipo'; end if;
  if u.status = 'vendido' then raise exception 'Ese equipo ya figura como vendido'; end if;
  select area into my_area from staff where id = me;
  if not public.is_admin() then
    if me is null then raise exception 'Sin permiso'; end if;
    if u.release_at > now() and my_area <> 'minorista' then
      raise exception 'Este equipo es del cupo del local hasta el %', to_char(u.release_at at time zone 'America/Argentina/Cordoba', 'DD/MM HH24:MI');
    end if;
  end if;
  update reserved_units set status = 'vendido', sold_by = me, sold_at = now() where id = p_id returning * into u;
  return u;
end;
$$;

revoke all on function public.sell_reserved(uuid) from public, anon;
grant execute on function public.sell_reserved(uuid) to authenticated;

-- Un pedido de stock con el IMEI de un equipo del cupo, hecho por alguien que
-- no es del local, se rechaza mientras dure la reserva.
create or replace function public.stock_request_check_reserved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare until timestamptz; req_area text;
begin
  if new.imei is null then return new; end if;
  select area into req_area from staff where id = new.staff_id;
  if req_area = 'minorista' then return new; end if;
  select release_at into until from reserved_units
  where imei = new.imei and status = 'reservado' and release_at > now()
  order by release_at desc limit 1;
  if until is not null then
    raise exception 'El equipo terminado en % es del cupo del local hasta el %', new.imei,
      to_char(until at time zone 'America/Argentina/Cordoba', 'DD/MM HH24:MI');
  end if;
  return new;
end;
$$;

drop trigger if exists stock_requests_check_reserved on stock_requests;
create trigger stock_requests_check_reserved
  before insert on stock_requests
  for each row execute function public.stock_request_check_reserved();

-- ---------------------------------------------------------------------------
-- Aviso de liberación (lo dispara una tarea programada cada 10 minutos)
-- ---------------------------------------------------------------------------

create table if not exists app_secrets (
  key text primary key,
  value text not null
);
alter table app_secrets enable row level security;
revoke all on app_secrets from anon, authenticated;

insert into app_secrets (key, value)
values ('release_secret', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

-- Marca como avisados los equipos que se liberaron y devuelve el aviso y a
-- quién mandarlo. Solo responde con la clave interna (la usa la tarea programada).
create or replace function public.release_due(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare n int; items text; caja text;
begin
  if p_secret is null or p_secret <> (select value from app_secrets where key = 'release_secret') then
    raise exception 'Sin permiso';
  end if;

  with due as (
    update reserved_units set release_notified = true
    where status = 'reservado' and release_at <= now() and not release_notified
    returning lot_id, modelo, capacidad, color, imei
  )
  select count(*),
         string_agg(modelo || coalesce(' ' || capacidad, '') || coalesce(' ' || color, '')
                    || coalesce(' (…' || imei || ')', ''), ', '),
         string_agg(distinct to_char(l.received_at at time zone 'America/Argentina/Cordoba', 'DD/MM'), ', ')
    into n, items, caja
  from due join stock_lots l on l.id = due.lot_id;

  if n = 0 then
    return jsonb_build_object('count', 0, 'subs', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'count', n,
    'title', case when n = 1 then 'Se liberó 1 equipo del local' else 'Se liberaron ' || n || ' equipos del local' end,
    'body', 'Ya los puede vender el mayorista. ' || items || ' · Caja del ' || caja,
    'subs', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth))
      from push_subscriptions ps
      join profiles p on p.id = ps.user_id and p.role = 'admin'
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.release_due(text) from public;
grant execute on function public.release_due(text) to anon, authenticated;
