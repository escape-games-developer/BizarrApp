-- ─── Editor libre de pantallas: el resto de los juegos ──────────────────────
--
-- Mismo contrato que lienzo_palabra (migración 20261024010000): una fila
-- admin_ui_config por juego, { version: 1, pantallas: {} } = todo de fábrica.
-- El check admin_ui_config_lienzo_valido y la RPC pública
-- pantalla_lienzo_config(juego) ya cubren cualquier key 'lienzo_<juego>'.
--
-- Juegos: rey, suma, trivia (Diseñador → Juegos), duelo, ftl, pt
-- (Diseñador → Escenario) y placas (Diseñador → Placas: break, cierre,
-- mensaje, promo). DJ Democracy queda afuera por ahora.

insert into public.admin_ui_config (key, value)
select 'lienzo_' || j, '{"version":1,"pantallas":{}}'::jsonb
  from unnest(array['rey', 'suma', 'trivia', 'duelo', 'ftl', 'pt', 'placas']) as j
on conflict (key) do nothing;
