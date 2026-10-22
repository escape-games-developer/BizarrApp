-- ─── Duelo de Talentos: layout editable de la pantalla ──────────────────────
--
-- La votación pasa a ser FONDO + MÁSCARA:
--   fondo   → el video de la ronda a pantalla completa; sin video, la imagen
--             de fondo (`fondo`); sin imagen, el negro de siempre.
--   máscara → paneles laterales, barómetros, avatares, logo de BizarrApp y el
--             logo de duelo (texto/imagen del centro). Siempre encima.
--
-- Campos nuevos de admin_ui_config key='duelo_pantalla':
--   fondo     : url https | null                  imagen de fondo (1920×1080)
--   logoPos   : 'arriba' | 'centro' | 'abajo'     dónde va el logo de duelo
--   panelIzq  : { ancho: 8..35 (% del ancho), alto: 30..100 (% del alto) }
--   panelDer  : { ancho: 8..35, alto: 30..100 }   cada lado por separado
--   barometro : { ancho: 50..200 (% del tamaño base),
--                 alto: 20..90 (% del alto del panel),
--                 y: 10..90 (% — altura del centro del barómetro en el panel) }
-- `zoom` (-100..100) pasa a escalar también el texto del centro.

create or replace function public.admin_ui_entero_en(v jsonb, minimo int, maximo int)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(jsonb_typeof(v) = 'number' and (v #>> '{}') ~ '^-?[0-9]+$'
                  and (v #>> '{}')::int between minimo and maximo, false);
$$;

create or replace function public.admin_ui_duelo_pantalla_valido(v jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(
         jsonb_typeof(v) is not distinct from 'object'
     and jsonb_typeof(v->'version') is not distinct from 'number'
     and (v->>'version') ~ '^[1-9][0-9]*$'
     and (v->>'centro') in ('texto', 'imagen')
     and jsonb_typeof(v->'texto') is not distinct from 'string'
     and char_length(btrim(v->>'texto')) between 1 and 24
     and (jsonb_typeof(v->'imagen') is not distinct from 'null'
          or (jsonb_typeof(v->'imagen') is not distinct from 'string' and (v->>'imagen') ~ '^https://'))
     and (v->>'centro' <> 'imagen' or jsonb_typeof(v->'imagen') is not distinct from 'string')
     and jsonb_typeof(v->'porcentajes') is not distinct from 'boolean'
     and (v->>'efecto') in ('ninguno', 'latido', 'campana', 'flotar', 'neon', 'glitch', 'giro', 'rebote')
     and public.admin_ui_entero_en(v->'zoom', -100, 100)
     and (jsonb_typeof(v->'fondo') is not distinct from 'null'
          or (jsonb_typeof(v->'fondo') is not distinct from 'string' and (v->>'fondo') ~ '^https://'))
     and (v->>'logoPos') in ('arriba', 'centro', 'abajo')
     and jsonb_typeof(v->'panelIzq') is not distinct from 'object'
     and public.admin_ui_entero_en(v->'panelIzq'->'ancho', 8, 35)
     and public.admin_ui_entero_en(v->'panelIzq'->'alto', 30, 100)
     and ((v->'panelIzq') - 'ancho' - 'alto') = '{}'::jsonb
     and jsonb_typeof(v->'panelDer') is not distinct from 'object'
     and public.admin_ui_entero_en(v->'panelDer'->'ancho', 8, 35)
     and public.admin_ui_entero_en(v->'panelDer'->'alto', 30, 100)
     and ((v->'panelDer') - 'ancho' - 'alto') = '{}'::jsonb
     and jsonb_typeof(v->'barometro') is not distinct from 'object'
     and public.admin_ui_entero_en(v->'barometro'->'ancho', 50, 200)
     and public.admin_ui_entero_en(v->'barometro'->'alto', 20, 90)
     and public.admin_ui_entero_en(v->'barometro'->'y', 10, 90)
     and ((v->'barometro') - 'ancho' - 'alto' - 'y') = '{}'::jsonb
     and (v - 'version' - 'centro' - 'texto' - 'imagen' - 'porcentajes' - 'efecto' - 'zoom'
            - 'fondo' - 'logoPos' - 'panelIzq' - 'panelDer' - 'barometro') = '{}'::jsonb,
         false);
$$;

alter table public.admin_ui_config
  drop constraint if exists admin_ui_config_duelo_pantalla_valido;

-- Valores iniciales = la pantalla de hoy (columnas de ~15 % y barómetro base).
update public.admin_ui_config
   set value = jsonb_build_object(
         'fondo', null, 'logoPos', 'centro',
         'panelIzq',  jsonb_build_object('ancho', 15, 'alto', 100),
         'panelDer',  jsonb_build_object('ancho', 15, 'alto', 100),
         'barometro', jsonb_build_object('ancho', 100, 'alto', 60, 'y', 64)) || value
 where key = 'duelo_pantalla';

alter table public.admin_ui_config
  add constraint admin_ui_config_duelo_pantalla_valido
  check (key <> 'duelo_pantalla' or public.admin_ui_duelo_pantalla_valido(value));
