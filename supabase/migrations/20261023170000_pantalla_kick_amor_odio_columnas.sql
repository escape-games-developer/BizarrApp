-- Sacar Tema: los modos «Amor y Odio» 🌹🍅 y «Guns & Roses» 🔫🌹.
--
-- Mismo mecanismo para los dos: cada invitado vota UNA vez, a favor (flor, +1)
-- o en contra (tomate / bala, −1). El medidor es positivos − negativos: al
-- llegar al umbral positivo la canción queda a salvo (no se vota más); al
-- llegar al negativo se corta, como en Sacar Tema. Cambian sólo las imágenes.
--
--   pantalla_kick_votes.value      → +1 / −1 (los votos de siempre son −1)
--   kick_positive_threshold        → «Umbral positivo (flores para salvar)»
--   kick_negative_threshold        → «Umbral negativo (tomates / balas para cortar)»
--   kick_meter_title               → título del medidor en la TV
--   kick_flower_*_url              → flor volando / pegada / ícono del botón
--   kick_bullet_flying_url         → bala volando (Guns & Roses)
--   kick_shoot_icon_url            → ícono del botón de tiro (Guns & Roses)
--   kick_shoot_text / flower_text  → textos de los botones (Guns & Roses)
--   kick_bullet_holes              → galería de agujeros de bala (urls); uno al azar por impacto
--   kick_flower_seq                → secuencia de flores (la TV anima cada una;
--                                    los tomates / balas usan kick_impact_seq)
--   kick_meter                     → { item_id, value, pos, neg, saved } del tema en curso

alter table public.pantalla_kick_votes
  add column if not exists value smallint not null default -1;
alter table public.pantalla_kick_votes drop constraint if exists pantalla_kick_votes_value_chk;
alter table public.pantalla_kick_votes
  add constraint pantalla_kick_votes_value_chk check (value in (-1, 1));

alter table public.pantalla_events
  add column if not exists kick_positive_threshold integer not null default 10,
  add column if not exists kick_negative_threshold integer not null default -10,
  add column if not exists kick_meter_title text,
  add column if not exists kick_flower_flying_url text,
  add column if not exists kick_flower_stuck_url text,
  add column if not exists kick_flower_icon_url text,
  add column if not exists kick_bullet_flying_url text,
  add column if not exists kick_shoot_icon_url text,
  add column if not exists kick_shoot_text text not null default 'Matar el Tema',
  add column if not exists kick_flower_text text not null default 'Salvar el Tema',
  add column if not exists kick_bullet_holes jsonb not null default '[]'::jsonb,
  add column if not exists kick_flower_seq bigint not null default 0,
  add column if not exists kick_meter jsonb;

alter table public.pantalla_events drop constraint if exists pantalla_events_kick_umbrales_chk;
alter table public.pantalla_events
  add constraint pantalla_events_kick_umbrales_chk
  check (kick_positive_threshold between 1 and 1000 and kick_negative_threshold between -1000 and -1);

alter table public.pantalla_events drop constraint if exists pantalla_events_kick_style_check;
alter table public.pantalla_events
  add constraint pantalla_events_kick_style_check
  check (kick_style = any (array['classic', 'tomato', 'love_hate', 'guns_roses']));
