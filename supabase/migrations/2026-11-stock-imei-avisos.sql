-- Pedidos de stock: últimos 4 números del IMEI (los carga el vendedor), varios teléfonos por pedido
-- (mismo group_id) y avisos al celular de los dueños (notificaciones push).

alter table stock_requests add column if not exists imei text;
alter table stock_requests drop constraint if exists stock_requests_imei_check;
alter table stock_requests add constraint stock_requests_imei_check check (imei is null or imei ~ '^[0-9]{4}$');
alter table stock_requests add column if not exists group_id uuid;
create index if not exists stock_requests_group_idx on stock_requests(group_id);

-- Celulares que reciben avisos (uno por navegador/app instalada).
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_own" on push_subscriptions;
create policy "push_subscriptions_own" on push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A quién avisar cuando un vendedor carga un pedido: a los celulares del panel
-- de control. Solo lo puede pedir quien cargó el pedido, y solo en los
-- primeros minutos (evita que se use para mandar avisos cuando quieran).
create or replace function public.push_targets_for_stock(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare r stock_requests%rowtype; n int; items text;
begin
  select * into r from stock_requests where id = p_id;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if not (public.is_admin() or r.staff_id = public.current_staff_id()) then raise exception 'Sin permiso'; end if;
  if r.created_at < now() - interval '10 minutes' then raise exception 'Pedido viejo'; end if;

  select count(*), string_agg(
           s.modelo || coalesce(' ' || s.capacidad, '') || coalesce(' ' || s.color, '')
           || coalesce(' (IMEI …' || s.imei || ')', ''), ', ' order by s.created_at)
    into n, items
  from stock_requests s
  where (r.group_id is not null and s.group_id = r.group_id) or s.id = r.id;

  return jsonb_build_object(
    'title', case when r.urgent then 'URGENTE: ' else '' end
             || (select name from staff where id = r.staff_id) || ' pide '
             || case when n = 1 then '1 equipo' else n || ' equipos' end,
    'body', items || ' · ' || r.cliente || ' · '
            || case r.trip_slot when 'urgente' then 'urgente' else 'viaje de las ' || r.trip_slot end
            || ' del ' || to_char(r.trip_date, 'DD/MM'),
    'subs', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth))
      from push_subscriptions ps
      join profiles p on p.id = ps.user_id and p.role = 'admin'
    ), '[]'::jsonb)
  );
end;
$$;

-- Borra un celular que ya no recibe avisos (el servicio de push lo dio de baja).
create or replace function public.push_drop(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from push_subscriptions where endpoint = p_endpoint;
$$;

revoke all on function public.push_targets_for_stock(uuid) from public, anon;
grant execute on function public.push_targets_for_stock(uuid) to authenticated;
revoke all on function public.push_drop(text) from public, anon;
grant execute on function public.push_drop(text) to authenticated;
