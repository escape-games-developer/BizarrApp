-- ─── QR en pantalla: suma los juegos de la sección Juegos ────────────────────
--
-- admin_ui_config key='pantalla_qr' pasa a:
--   { version: 1, ftl, pt, duelo, rey, trivia, suma, palabra }  (todos bool)
-- Rey del Orto, Desafío Demente, Sumate y Arma la palabra estrenan un QR en
-- la TV (esquina inferior izquierda, lleva a ?view=games). Arrancan visibles.

alter table public.admin_ui_config drop constraint if exists admin_ui_config_pantalla_qr_valido;

-- La fila existente suma las claves nuevas (visibles) antes de la constraint.
update public.admin_ui_config
   set value = '{"rey":true,"trivia":true,"suma":true,"palabra":true}'::jsonb || value
 where key = 'pantalla_qr';

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
     and (v - 'version' - 'ftl' - 'pt' - 'duelo' - 'rey' - 'trivia' - 'suma' - 'palabra') = '{}'::jsonb;
$$;

alter table public.admin_ui_config
  add constraint admin_ui_config_pantalla_qr_valido
  check (key <> 'pantalla_qr' or public.admin_ui_pantalla_qr_valido(value));

insert into public.admin_ui_config (key, value)
values ('pantalla_qr', '{"version":1,"ftl":true,"pt":true,"duelo":true,"rey":true,"trivia":true,"suma":true,"palabra":true}'::jsonb)
on conflict (key) do nothing;
