-- ─── Escenario (FTL / PT): pantalla «participante listo» editable ───────────
--
-- Es la pantalla de la TV cuando el operador llama al participante y todavía
-- no arrancó el video: avatar + nombre + «LISTO PARA …».
--
-- Fila admin_ui_config key='escenario_listo':
--   { version: 1, ftl: <juego>, pt: <juego> }   con <juego> =
--   { previa:   bool,                         -- mostrar o no esta pantalla
--     centro:   'texto' | 'imagen',
--     texto:    string 1..40,
--     imagen:   url https | null,             -- PNG/WEBP de la Biblioteca
--     efecto:   'ninguno' | 'latido' | 'campana' | 'flotar' | 'neon' | 'glitch' | 'giro' | 'rebote',
--     zoom:     -100..100,                    -- tamaño
--     posicion: 'arriba' | 'abajo',           -- arriba del avatar / debajo del nombre
--     fuente:   'syne' | 'grotesk' | 'sans',  -- tipografía del texto
--     color:    '#RRGGBB' }                   -- color del texto
--
-- previa = false: al llamar al participante la TV sigue en la convocatoria
-- hasta que arranca el video (el presentador lo llama en vivo).
-- Escritura: la de admin_ui_config (is_admin()). Lectura pública con
-- escenario_listo_config(): la TV entra sin sesión.

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
     and (j - 'previa' - 'centro' - 'texto' - 'imagen' - 'efecto' - 'zoom'
            - 'posicion' - 'fuente' - 'color') = '{}'::jsonb,
         false);
$$;

create or replace function public.admin_ui_escenario_listo_valido(v jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(
         jsonb_typeof(v) is not distinct from 'object'
     and jsonb_typeof(v->'version') is not distinct from 'number'
     and (v->>'version') ~ '^[1-9][0-9]*$'
     and public.admin_ui_listo_juego_valido(v->'ftl')
     and public.admin_ui_listo_juego_valido(v->'pt')
     and (v - 'version' - 'ftl' - 'pt') = '{}'::jsonb,
         false);
$$;

alter table public.admin_ui_config
  drop constraint if exists admin_ui_config_escenario_listo_valido;
alter table public.admin_ui_config
  add constraint admin_ui_config_escenario_listo_valido
  check (key <> 'escenario_listo' or public.admin_ui_escenario_listo_valido(value));

-- Valores iniciales = la pantalla de hoy.
insert into public.admin_ui_config (key, value)
values ('escenario_listo', jsonb_build_object('version', 1,
  'ftl', jsonb_build_object('previa', true, 'centro', 'texto', 'texto', 'LISTO PARA FOLLOW THE LEADER',
    'imagen', null, 'efecto', 'ninguno', 'zoom', 0, 'posicion', 'abajo', 'fuente', 'syne', 'color', '#FFD600'),
  'pt',  jsonb_build_object('previa', true, 'centro', 'texto', 'texto', 'LISTO PARA PERSONAL TRAINER',
    'imagen', null, 'efecto', 'ninguno', 'zoom', 0, 'posicion', 'abajo', 'fuente', 'syne', 'color', '#FFD600')))
on conflict (key) do nothing;

create or replace function public.escenario_listo_config()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select value from public.admin_ui_config where key = 'escenario_listo';
$$;

revoke all on function public.escenario_listo_config() from public;
grant execute on function public.escenario_listo_config() to anon, authenticated;
