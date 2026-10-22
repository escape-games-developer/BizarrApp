-- ─── Duelo de Talentos: efecto animado del centro de la pantalla ────────────
--
-- Suma `efecto` a la fila admin_ui_config key='duelo_pantalla':
--   'ninguno' | 'latido' | 'campana' | 'flotar' | 'neon' | 'glitch' | 'giro' | 'rebote'
-- Se aplica al texto o a la imagen del centro de la votación.

alter table public.admin_ui_config
  drop constraint if exists admin_ui_config_duelo_pantalla_valido;

update public.admin_ui_config
   set value = value || '{"efecto":"ninguno"}'::jsonb
 where key = 'duelo_pantalla' and not (value ? 'efecto');

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
     and (v->>'efecto') in ('ninguno', 'latido', 'campana', 'flotar', 'neon', 'glitch', 'giro', 'rebote')
     and (v->>'centro' <> 'imagen' or jsonb_typeof(v->'imagen') is not distinct from 'string')
     and (v - 'version' - 'centro' - 'texto' - 'imagen' - 'porcentajes' - 'efecto') = '{}'::jsonb;
$$;

alter table public.admin_ui_config
  add constraint admin_ui_config_duelo_pantalla_valido
  check (key <> 'duelo_pantalla' or public.admin_ui_duelo_pantalla_valido(value));
