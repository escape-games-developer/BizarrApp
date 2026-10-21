-- ─── Ajustes → General: catálogo de juegos ──────────────────────────────────
--
-- Suma `catalogoJuegos` a la fila admin_ui_config key='general':
--   { version: 1, geoObligatoria: bool, modoInvitado: bool, catalogoJuegos: bool }
--
--   catalogoJuegos → sin nada activo, Juegos y Escenario muestran las cards
--                    (con logo) de los juegos que existen. Apagado, queda la
--                    pantalla de espera vacía de siempre.

alter table public.admin_ui_config
  drop constraint if exists admin_ui_config_general_valido;

update public.admin_ui_config
   set value = value || '{"catalogoJuegos":true}'::jsonb
 where key = 'general' and not (value ? 'catalogoJuegos');

create or replace function public.admin_ui_general_valido(v jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_typeof(v) is not distinct from 'object'
     and jsonb_typeof(v->'version') is not distinct from 'number'
     and (v->>'version') ~ '^[1-9][0-9]*$'
     and jsonb_typeof(v->'geoObligatoria') is not distinct from 'boolean'
     and jsonb_typeof(v->'modoInvitado') is not distinct from 'boolean'
     and jsonb_typeof(v->'catalogoJuegos') is not distinct from 'boolean'
     and (v - 'version' - 'geoObligatoria' - 'modoInvitado' - 'catalogoJuegos') = '{}'::jsonb;
$$;

alter table public.admin_ui_config
  add constraint admin_ui_config_general_valido
  check (key <> 'general' or public.admin_ui_general_valido(value));
