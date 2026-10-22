-- ─── Duelo de Talentos: lo que se ve en la pantalla durante la votación ─────
--
-- Fila admin_ui_config key='duelo_pantalla':
--   { version: 1,
--     centro:      'texto' | 'imagen',  -- qué va en el centro cuando no hay video
--     texto:       string (1..24),      -- p. ej. "DUELO"
--     imagen:      url | null,          -- PNG/WEBP de la Biblioteca de imágenes
--     porcentajes: bool }               -- 👍 + % debajo de cada duelista
--
-- Escritura: la de admin_ui_config (UPDATE de `value` con is_admin()).
-- Lectura pública con duelo_pantalla_config(): la TV entra sin sesión.

create or replace function public.admin_ui_duelo_pantalla_valido(v jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_typeof(v) is not distinct from 'object'
     and jsonb_typeof(v->'version') is not distinct from 'number'
     and (v->>'version') ~ '^[1-9][0-9]*$'
     and (v->>'centro') in ('texto', 'imagen')
     and jsonb_typeof(v->'texto') is not distinct from 'string'
     and char_length(btrim(v->>'texto')) between 1 and 24
     and (jsonb_typeof(v->'imagen') is not distinct from 'null'
          or (jsonb_typeof(v->'imagen') is not distinct from 'string' and (v->>'imagen') ~ '^https://'))
     and jsonb_typeof(v->'porcentajes') is not distinct from 'boolean'
     and (v->>'centro' <> 'imagen' or jsonb_typeof(v->'imagen') is not distinct from 'string')
     and (v - 'version' - 'centro' - 'texto' - 'imagen' - 'porcentajes') = '{}'::jsonb;
$$;

alter table public.admin_ui_config
  drop constraint if exists admin_ui_config_duelo_pantalla_valido;
alter table public.admin_ui_config
  add constraint admin_ui_config_duelo_pantalla_valido
  check (key <> 'duelo_pantalla' or public.admin_ui_duelo_pantalla_valido(value));

insert into public.admin_ui_config (key, value)
values ('duelo_pantalla', '{"version":1,"centro":"texto","texto":"DUELO","imagen":null,"porcentajes":true}'::jsonb)
on conflict (key) do nothing;

create or replace function public.duelo_pantalla_config()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select value from public.admin_ui_config where key = 'duelo_pantalla';
$$;

revoke all on function public.duelo_pantalla_config() from public;
grant execute on function public.duelo_pantalla_config() to anon, authenticated;
