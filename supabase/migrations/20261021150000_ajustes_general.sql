-- ─── Ajustes → General ──────────────────────────────────────────────────────
--
-- Fila admin_ui_config key='general':
--   { version: 1, geoObligatoria: bool, modoInvitado: bool }
--
--   geoObligatoria → Juegos / Escenario / Pantalla exigen la ubicación
--                    verificada en el bar. Apagada, alcanza con estar logueado.
--   modoInvitado   → el login ofrece «Entrar como invitado». Apagado, el botón
--                    desaparece (reemplaza a la variable de build
--                    VITE_GUEST_LOGIN).
--
-- Mismo contrato que key='registro': escritura con is_admin() por la política
-- de admin_ui_config, lectura pública sólo de esta fila con general_config().
-- Los valores iniciales son el comportamiento que ya había.

create or replace function public.admin_ui_general_valido(v jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_typeof(v) is not distinct from 'object'
     and jsonb_typeof(v->'version') is not distinct from 'number'
     and (v->>'version') ~ '^[1-9][0-9]*$'
     and jsonb_typeof(v->'geoObligatoria') is not distinct from 'boolean'
     and jsonb_typeof(v->'modoInvitado') is not distinct from 'boolean'
     and (v - 'version' - 'geoObligatoria' - 'modoInvitado') = '{}'::jsonb;
$$;

alter table public.admin_ui_config
  drop constraint if exists admin_ui_config_general_valido;
alter table public.admin_ui_config
  add constraint admin_ui_config_general_valido
  check (key <> 'general' or public.admin_ui_general_valido(value));

insert into public.admin_ui_config (key, value)
values ('general', '{"version":1,"geoObligatoria":true,"modoInvitado":true}'::jsonb)
on conflict (key) do nothing;

create or replace function public.general_config()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select value from public.admin_ui_config where key = 'general';
$$;

revoke all on function public.general_config() from public;
grant execute on function public.general_config() to anon, authenticated;
