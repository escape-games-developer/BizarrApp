-- ─── Ajustes → General: títulos de sección y vestuario ──────────────────────
--
-- Suma a la fila admin_ui_config key='general':
--   titulos      → los títulos de juegos y secciones de la app del cliente
--                  («💃 Follow the Leader», «Mi Perfil», «Carta del Bar»…).
--   vestuarioFtl → el cuadro «Vestuario especial requerido» de Follow the Leader.
--   vestuarioPt  → el mismo cuadro en Personal Trainer.
-- Todos arrancan en true (lo que se veía hasta ahora).

alter table public.admin_ui_config
  drop constraint if exists admin_ui_config_general_valido;

update public.admin_ui_config
   set value = jsonb_build_object('titulos', true, 'vestuarioFtl', true, 'vestuarioPt', true) || value
 where key = 'general';

create or replace function public.admin_ui_general_valido(v jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(
         jsonb_typeof(v) is not distinct from 'object'
     and jsonb_typeof(v->'version') is not distinct from 'number'
     and (v->>'version') ~ '^[1-9][0-9]*$'
     and jsonb_typeof(v->'geoObligatoria') is not distinct from 'boolean'
     and jsonb_typeof(v->'modoInvitado') is not distinct from 'boolean'
     and jsonb_typeof(v->'catalogoJuegos') is not distinct from 'boolean'
     and jsonb_typeof(v->'titulos') is not distinct from 'boolean'
     and jsonb_typeof(v->'vestuarioFtl') is not distinct from 'boolean'
     and jsonb_typeof(v->'vestuarioPt') is not distinct from 'boolean'
     and (v - 'version' - 'geoObligatoria' - 'modoInvitado' - 'catalogoJuegos'
            - 'titulos' - 'vestuarioFtl' - 'vestuarioPt') = '{}'::jsonb,
         false);
$$;

alter table public.admin_ui_config
  add constraint admin_ui_config_general_valido
  check (key <> 'general' or public.admin_ui_general_valido(value));
