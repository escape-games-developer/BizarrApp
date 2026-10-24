-- ─── Diseñador → Placas: efecto también para la Promo ───────────────────────
--
-- La fila admin_ui_config 'pantalla_mensaje' suma `efecto_promo` (opcional,
-- mismos valores que `efecto`). Sin la clave, la Promo va en 'fijo'.

create or replace function public.admin_ui_pantalla_mensaje_valido(v jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_typeof(v) is not distinct from 'object'
     and jsonb_typeof(v->'version') is not distinct from 'number'
     and (v->>'version') ~ '^[1-9][0-9]*$'
     and (v->>'efecto') in ('fijo', 'banda', 'latido', 'neon')
     and (v->'efecto_promo' is null or (v->>'efecto_promo') in ('fijo', 'banda', 'latido', 'neon'))
     and (v - 'version' - 'efecto' - 'efecto_promo') = '{}'::jsonb;
$$;
