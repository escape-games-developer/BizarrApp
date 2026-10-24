-- ─── Editor libre de pantallas (lienzo) ─────────────────────────────────────
--
-- Filas admin_ui_config key='lienzo_<juego>' (piloto: lienzo_palabra):
--   { version: 1, pantallas: { <estado>: { fondo, elementos: [...] } } }
-- Cada pantalla es un lienzo de 1920 × 1080 con elementos de texto, imagen y
-- dato (ver src/lienzo/). Un estado sin entrada en `pantallas` usa el diseño
-- original del código.
--
-- El contenido lo valida el cliente (normalizar): acá sólo se exige la forma
-- de arriba y un tope de tamaño, para que nadie infle la fila.
--
-- Escritura: la de admin_ui_config (UPDATE de `value` con is_admin()).
-- Lectura pública con pantalla_lienzo_config(juego): la TV entra sin sesión.

create or replace function public.admin_ui_lienzo_valido(v jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_typeof(v) is not distinct from 'object'
     and jsonb_typeof(v->'version') is not distinct from 'number'
     and (v->>'version') ~ '^[1-9][0-9]*$'
     and jsonb_typeof(v->'pantallas') is not distinct from 'object'
     and (v - 'version' - 'pantallas') = '{}'::jsonb
     and pg_column_size(v) < 262144;
$$;

alter table public.admin_ui_config
  add constraint admin_ui_config_lienzo_valido
  check (key not like 'lienzo\_%' or public.admin_ui_lienzo_valido(value));

insert into public.admin_ui_config (key, value)
values ('lienzo_palabra', '{"version":1,"pantallas":{}}'::jsonb)
on conflict (key) do nothing;

create or replace function public.pantalla_lienzo_config(p_juego text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select value from public.admin_ui_config
   where p_juego ~ '^[a-z]{2,20}$' and key = 'lienzo_' || p_juego;
$$;

revoke all on function public.pantalla_lienzo_config(text) from public;
grant execute on function public.pantalla_lienzo_config(text) to anon, authenticated;
