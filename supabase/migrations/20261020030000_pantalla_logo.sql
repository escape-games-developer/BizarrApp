-- ─── Ajustes → QR y logo en pantalla: visibilidad del logo de BizarrApp ──────
--
-- Fila admin_ui_config key='pantalla_logo', misma forma que 'pantalla_qr':
--   { version: 1, ftl, pt, duelo, rey, trivia, suma, palabra }  (todos bool)
-- Controla el logo de BizarrApp en las pantallas de cada juego: su placa de
-- anuncio, su convocatoria y el juego en pantalla. Por defecto, visible.
--
-- Se valida con la misma función que 'pantalla_qr' (mismo formato).
-- Escritura: la de admin_ui_config (UPDATE de `value` con is_admin()).
-- Lectura pública con pantalla_logo_config(): la TV entra sin sesión.

alter table public.admin_ui_config
  add constraint admin_ui_config_pantalla_logo_valido
  check (key <> 'pantalla_logo' or public.admin_ui_pantalla_qr_valido(value));

insert into public.admin_ui_config (key, value)
values ('pantalla_logo', '{"version":1,"ftl":true,"pt":true,"duelo":true,"rey":true,"trivia":true,"suma":true,"palabra":true}'::jsonb)
on conflict (key) do nothing;

create or replace function public.pantalla_logo_config()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select value from public.admin_ui_config where key = 'pantalla_logo';
$$;

revoke all on function public.pantalla_logo_config() from public;
grant execute on function public.pantalla_logo_config() to anon, authenticated;
