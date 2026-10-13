-- ─── Ajustes → Carta: qué menú se embebe en la app del cliente ───────────────
--
-- Fila admin_ui_config key='menu':  { version: 1, fuente: 'wordpress' | 'pedidos' }
--
--   wordpress → https://bizarrenbar.com.ar/chupi-morfi/   (la carta de siempre)
--   pedidos   → https://pedidos-bizarren.lovable.app/
--
-- Un solo campo `fuente`: no hay forma de tener las dos activas a la vez. Las
-- URLs viven en el front (MenuFrame.jsx); la base sólo guarda cuál se usa.
--
-- Escritura: la de admin_ui_config (UPDATE de `value` con is_admin()).
-- Lectura pública con menu_config(): la carta se ve sin sesión.

create or replace function public.admin_ui_menu_valido(v jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_typeof(v) is not distinct from 'object'
     and jsonb_typeof(v->'version') is not distinct from 'number'
     and (v->>'version') ~ '^[1-9][0-9]*$'
     and (v->>'fuente') in ('wordpress', 'pedidos')
     and (v - 'version' - 'fuente') = '{}'::jsonb;
$$;

alter table public.admin_ui_config
  add constraint admin_ui_config_menu_valido
  check (key <> 'menu' or public.admin_ui_menu_valido(value));

insert into public.admin_ui_config (key, value)
values ('menu', '{"version":1,"fuente":"wordpress"}'::jsonb)
on conflict (key) do nothing;

create or replace function public.menu_config()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select value from public.admin_ui_config where key = 'menu';
$$;

revoke all on function public.menu_config() from public;
grant execute on function public.menu_config() to anon, authenticated;
