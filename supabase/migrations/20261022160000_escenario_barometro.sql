-- ─── Escenario (FTL / PT): barómetro de la TV editable ──────────────────────
--
-- Suma `barometro` a cada juego de admin_ui_config key='escenario_listo':
--   { ancho: 50..200  (% del tamaño base),
--     alto:  20..90   (% del alto de la pantalla),
--     x:     3..97    (% del ancho de la pantalla — dónde queda su centro),
--     y:     10..90   (% del alto de la pantalla — dónde queda su centro) }
-- Mismos controles que el barómetro del Duelo; acá no hay paneles laterales,
-- así que todo se mide sobre la pantalla entera. Valores iniciales = la
-- ubicación de hoy (margen izquierdo, debajo del avatar).

create or replace function public.admin_ui_listo_juego_valido(j jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(
         jsonb_typeof(j) is not distinct from 'object'
     and jsonb_typeof(j->'previa') is not distinct from 'boolean'
     and (j->>'centro') in ('texto', 'imagen')
     and jsonb_typeof(j->'texto') is not distinct from 'string'
     and char_length(btrim(j->>'texto')) between 1 and 40
     and (jsonb_typeof(j->'imagen') is not distinct from 'null'
          or (jsonb_typeof(j->'imagen') is not distinct from 'string' and (j->>'imagen') ~ '^https://'))
     and (j->>'centro' <> 'imagen' or jsonb_typeof(j->'imagen') is not distinct from 'string')
     and (j->>'efecto') in ('ninguno', 'latido', 'campana', 'flotar', 'neon', 'glitch', 'giro', 'rebote')
     and public.admin_ui_entero_en(j->'zoom', -100, 100)
     and (j->>'posicion') in ('arriba', 'abajo')
     and (j->>'fuente') in ('syne', 'grotesk', 'sans')
     and (j->>'color') ~ '^#[0-9A-Fa-f]{6}$'
     and jsonb_typeof(j->'barometro') is not distinct from 'object'
     and public.admin_ui_entero_en(j->'barometro'->'ancho', 50, 200)
     and public.admin_ui_entero_en(j->'barometro'->'alto', 20, 90)
     and public.admin_ui_entero_en(j->'barometro'->'x', 3, 97)
     and public.admin_ui_entero_en(j->'barometro'->'y', 10, 90)
     and ((j->'barometro') - 'ancho' - 'alto' - 'x' - 'y') = '{}'::jsonb
     and (j - 'previa' - 'centro' - 'texto' - 'imagen' - 'efecto' - 'zoom'
            - 'posicion' - 'fuente' - 'color' - 'barometro') = '{}'::jsonb,
         false);
$$;

alter table public.admin_ui_config
  drop constraint if exists admin_ui_config_escenario_listo_valido;

update public.admin_ui_config
   set value = jsonb_set(jsonb_set(value,
         '{ftl,barometro}', '{"ancho":100,"alto":70,"x":8,"y":61}'::jsonb),
         '{pt,barometro}',  '{"ancho":100,"alto":70,"x":8,"y":61}'::jsonb)
 where key = 'escenario_listo';

alter table public.admin_ui_config
  add constraint admin_ui_config_escenario_listo_valido
  check (key <> 'escenario_listo' or public.admin_ui_escenario_listo_valido(value));
