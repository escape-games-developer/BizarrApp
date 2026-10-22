-- ─── Duelo de Talentos: ubicación horizontal de los barómetros ──────────────
--
-- Suma `barometro.x` (10..90, % del ancho del panel) a 'duelo_pantalla'.
-- Espejado entre lados: 10 = pegado al borde exterior de la pantalla,
-- 50 = centrado en el panel, 90 = hacia el centro de la pantalla.

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
     and public.admin_ui_entero_en(v->'barometro'->'x', 10, 90)
     and ((v->'barometro') - 'ancho' - 'alto' - 'y' - 'x') = '{}'::jsonb
     and (v - 'version' - 'centro' - 'texto' - 'imagen' - 'porcentajes' - 'efecto' - 'zoom'
            - 'fondo' - 'logoPos' - 'panelIzq' - 'panelDer' - 'barometro') = '{}'::jsonb,
         false);
$$;

alter table public.admin_ui_config
  drop constraint if exists admin_ui_config_duelo_pantalla_valido;

update public.admin_ui_config
   set value = jsonb_set(value, '{barometro}', jsonb_build_object('x', 50) || (value->'barometro'))
 where key = 'duelo_pantalla';

alter table public.admin_ui_config
  add constraint admin_ui_config_duelo_pantalla_valido
  check (key <> 'duelo_pantalla' or public.admin_ui_duelo_pantalla_valido(value));
