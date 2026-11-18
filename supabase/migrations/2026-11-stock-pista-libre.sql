-- Pedidos de stock con "pista libre": los vendedores pueden cargar un pedido
-- en cualquier momento, urgente o no, y la base NUNCA lo rechaza por horario.
-- Antes, después de las 14:00 (para hoy) o con una fecha ya pasada, el pedido
-- se rechazaba con un error y no quedaba cargado.
--
-- Reglas del viaje (solo para ordenarlo, ya no bloquean):
--  · Urgente → sale como urgente (decide Mike).
--  · Turno de pasado mañana o más → viaje de las 10:00 de ese día.
--  · Turno de mañana → 10:00 si se carga antes de las 23:00; si no, 15:00.
--  · Turno de hoy antes de las 14:00 → viaje de las 15:00.
--  · Turno de hoy después de las 14:00 (sin urgente) → próximo viaje: mañana 10:00.
--  · Fecha pasada → se toma como hoy.

create or replace function public.stock_request_assign_trip()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  local_now timestamp := public.now_ar();
  today date := public.now_ar()::date;
  d date;
begin
  if tg_op = 'UPDATE' and new.turno_date = old.turno_date and new.urgent = old.urgent then
    return new;
  end if;

  d := greatest(new.turno_date, today);

  if new.urgent then
    new.trip_date := d;
    new.trip_slot := 'urgente';
  elsif d > today + 1 then
    new.trip_date := d;
    new.trip_slot := '10:00';
  elsif d = today + 1 then
    new.trip_date := d;
    new.trip_slot := case when local_now::time < '23:00' then '10:00' else '15:00' end;
  elsif local_now::time < '14:00' then
    new.trip_date := today;
    new.trip_slot := '15:00';
  else
    new.trip_date := today + 1;
    new.trip_slot := '10:00';
  end if;

  return new;
end;
$$;
