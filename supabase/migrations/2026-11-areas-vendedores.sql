-- Áreas del panel de control: cada vendedor pertenece a un área para que el
-- panel muestre Minorista y Mayorista por separado (y deje afuera a quien no
-- vende, como marketing). Los vendedores nuevos arrancan en 'minorista'.

alter table public.sellers
  add column if not exists area text not null default 'minorista';

alter table public.sellers drop constraint if exists sellers_area_check;
alter table public.sellers
  add constraint sellers_area_check check (area in ('minorista', 'mayorista', 'tecnico', 'marketing'));

update public.sellers set area = 'mayorista' where id = 'emi';
update public.sellers set area = 'tecnico' where id = 'santi';
update public.sellers set area = 'marketing' where id = 'sofi';

notify pgrst, 'reload schema';
