-- Tarea programada: cada 10 minutos avisa los equipos del cupo del local que
-- se liberaron. Cambiá la URL por la de producción cuando se lance la app.
create extension if not exists pg_net;

insert into app_secrets (key, value)
values ('release_url', 'https://iseven-comercial.vercel.app/api/push/release')
on conflict (key) do update set value = excluded.value;

select cron.unschedule('iseven-cupo-liberado') where exists (select 1 from cron.job where jobname = 'iseven-cupo-liberado');

select cron.schedule(
  'iseven-cupo-liberado',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := (select value from public.app_secrets where key = 'release_url'),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('secret', (select value from public.app_secrets where key = 'release_secret'))
  );
  $$
);
