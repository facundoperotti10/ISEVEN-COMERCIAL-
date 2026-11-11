-- Stock en camino: pedidos que se compran en Estados Unidos y viajan a
-- Argentina (USA → Buenos Aires → Córdoba → Oficina). Cada pedido tiene sus
-- ítems con modelo, condición, color, cantidad, costo en USD por unidad y
-- cuántos ya se vendieron en preventa (reservado). Solo lo ven los admins.

create table if not exists public.pedidos_entrantes (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique,
  fecha date not null,
  proveedor text default '',
  ubicacion text not null default 'usa'
    check (ubicacion in ('usa','baires','cordoba','ofi')),
  notas text default '',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.pedidos_entrantes_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos_entrantes(id) on delete cascade,
  modelo text not null,
  condicion text not null,          -- SC, Sellado, Grado A+, Grado A, Grado B, Usado, CPO
  color text default '',
  cantidad integer not null check (cantidad > 0),
  costo numeric(10,2) not null check (costo >= 0),   -- USD por unidad
  reservado integer not null default 0,              -- vendidos en preventa
  constraint reservado_valido check (reservado >= 0 and reservado <= cantidad)
);

create index if not exists pedidos_entrantes_items_pedido_idx on public.pedidos_entrantes_items(pedido_id);

-- actualizado_en se mantiene solo: al tocar el pedido o cualquiera de sus ítems.
create or replace function public.pedidos_entrantes_touch()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if tg_table_name = 'pedidos_entrantes' then
    new.actualizado_en := now();
    return new;
  end if;
  update pedidos_entrantes set actualizado_en = now()
    where id = coalesce(new.pedido_id, old.pedido_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists pedidos_entrantes_touch on public.pedidos_entrantes;
create trigger pedidos_entrantes_touch
  before update on public.pedidos_entrantes
  for each row execute function public.pedidos_entrantes_touch();

drop trigger if exists pedidos_entrantes_items_touch on public.pedidos_entrantes_items;
create trigger pedidos_entrantes_items_touch
  after insert or update or delete on public.pedidos_entrantes_items
  for each row execute function public.pedidos_entrantes_touch();

alter table public.pedidos_entrantes enable row level security;
alter table public.pedidos_entrantes_items enable row level security;

-- Solo administradores (mismo criterio que el resto de la app: is_admin()).
drop policy if exists pedidos_entrantes_select on public.pedidos_entrantes;
create policy pedidos_entrantes_select on public.pedidos_entrantes for select using (is_admin());
drop policy if exists pedidos_entrantes_insert on public.pedidos_entrantes;
create policy pedidos_entrantes_insert on public.pedidos_entrantes for insert with check (is_admin());
drop policy if exists pedidos_entrantes_update on public.pedidos_entrantes;
create policy pedidos_entrantes_update on public.pedidos_entrantes for update using (is_admin()) with check (is_admin());
drop policy if exists pedidos_entrantes_delete on public.pedidos_entrantes;
create policy pedidos_entrantes_delete on public.pedidos_entrantes for delete using (is_admin());

drop policy if exists pedidos_entrantes_items_select on public.pedidos_entrantes_items;
create policy pedidos_entrantes_items_select on public.pedidos_entrantes_items for select using (is_admin());
drop policy if exists pedidos_entrantes_items_insert on public.pedidos_entrantes_items;
create policy pedidos_entrantes_items_insert on public.pedidos_entrantes_items for insert with check (is_admin());
drop policy if exists pedidos_entrantes_items_update on public.pedidos_entrantes_items;
create policy pedidos_entrantes_items_update on public.pedidos_entrantes_items for update using (is_admin()) with check (is_admin());
drop policy if exists pedidos_entrantes_items_delete on public.pedidos_entrantes_items;
create policy pedidos_entrantes_items_delete on public.pedidos_entrantes_items for delete using (is_admin());

notify pgrst, 'reload schema';
