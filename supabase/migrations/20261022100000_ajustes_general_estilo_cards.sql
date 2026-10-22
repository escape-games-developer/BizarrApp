-- ─── Ajustes → General: estilo de cards en los contenedores de postulación ──
--
-- Suma `estiloCards` a la fila admin_ui_config key='general':
--   true  → el contenedor de postulación de cada juego (FTL, PT, Duelo) usa el
--           estilo de las cards del catálogo: borde neón con el color de ese
--           juego y fondo casi transparente.
--   false → los colores propios de cada juego, como antes.
-- En los dos casos el contenedor ocupa toda la pantalla con el botón adentro.

alter table public.admin_ui_config
  drop constraint if exists admin_ui_config_general_valido;

update public.admin_ui_config
   set value = jsonb_build_object('estiloCards', true) || value
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
     and jsonb_typeof(v->'estiloCards') is not distinct from 'boolean'
     and (v - 'version' - 'geoObligatoria' - 'modoInvitado' - 'catalogoJuegos'
            - 'titulos' - 'vestuarioFtl' - 'vestuarioPt' - 'estiloCards') = '{}'::jsonb,
         false);
$$;

alter table public.admin_ui_config
  add constraint admin_ui_config_general_valido
  check (key <> 'general' or public.admin_ui_general_valido(value));
