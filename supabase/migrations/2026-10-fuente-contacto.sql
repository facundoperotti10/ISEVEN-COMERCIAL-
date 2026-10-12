-- Fuente del cliente: de qué publicidad, reel, recomendación, etc. vino.
-- Campo libre (con autocompletado en la app a partir de lo ya cargado), así
-- no se les impone una lista fija de canales.

alter table public.contacts add column if not exists fuente text;
