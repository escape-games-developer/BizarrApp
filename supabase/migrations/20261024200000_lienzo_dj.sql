-- ─── Editor libre de pantallas: la pantalla gigante del DJ Democracy ─────────
--
-- Mismo contrato que el resto de los lienzos (migración 20261024010000):
-- { version: 1, pantallas: {} } = la TV sigue con el diseño del evento
-- (pantalla_events.tv_canvas_config) hasta que se guarde la pantalla «dj».

insert into public.admin_ui_config (key, value)
values ('lienzo_dj', '{"version":1,"pantallas":{}}'::jsonb)
on conflict (key) do nothing;
