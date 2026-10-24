-- ─── QR y logo de BizarrApp en las placas de Lanzar ─────────────────────────
--
-- Las filas admin_ui_config 'pantalla_qr' y 'pantalla_logo' suman cuatro
-- claves para las placas que se mandan desde Admin → Lanzar:
--   break, cierre, mensaje, promo   (bool)
-- Se editan en el Diseñador de pantalla TV.
--
-- Son OPCIONALES en el validador: las filas actuales (sólo juegos) siguen
-- siendo válidas, y el cliente toma `true` por defecto si falta la clave.
-- Las de los juegos siguen siendo obligatorias, como antes.

create or replace function public.admin_ui_pantalla_qr_valido(v jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_typeof(v) is not distinct from 'object'
     and jsonb_typeof(v->'version') is not distinct from 'number'
     and (v->>'version') ~ '^[1-9][0-9]*$'
     and jsonb_typeof(v->'ftl')     is not distinct from 'boolean'
     and jsonb_typeof(v->'pt')      is not distinct from 'boolean'
     and jsonb_typeof(v->'duelo')   is not distinct from 'boolean'
     and jsonb_typeof(v->'rey')     is not distinct from 'boolean'
     and jsonb_typeof(v->'trivia')  is not distinct from 'boolean'
     and jsonb_typeof(v->'suma')    is not distinct from 'boolean'
     and jsonb_typeof(v->'palabra') is not distinct from 'boolean'
     and coalesce(jsonb_typeof(v->'break'),   'boolean') = 'boolean'
     and coalesce(jsonb_typeof(v->'cierre'),  'boolean') = 'boolean'
     and coalesce(jsonb_typeof(v->'mensaje'), 'boolean') = 'boolean'
     and coalesce(jsonb_typeof(v->'promo'),   'boolean') = 'boolean'
     and (v - 'version' - 'ftl' - 'pt' - 'duelo' - 'rey' - 'trivia' - 'suma' - 'palabra'
            - 'break' - 'cierre' - 'mensaje' - 'promo') = '{}'::jsonb;
$$;
