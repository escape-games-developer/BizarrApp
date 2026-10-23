-- DJ Democracy → Editor → «Reglas de votación».
--
-- 1. Sacar Tema / Tomatazo:
--    · kick_min_votes      → «Mínimo de votos reales»: nunca se corta un tema
--                            con menos votos que este número, aunque el
--                            porcentaje diera menos.
--    · kick_min_connected  → «Mínimo de conectados para mostrar la opción»:
--                            con menos invitados activos, el botón no aparece en
--                            el celular y no se aceptan votos.
-- 2. vote_sound_enabled    → «Sonido al votar/reaccionar»: el «pop» del celular.
--
-- `pantalla_get_kick_status` y `pantalla_toggle_kick_vote` se reescriben con el
-- mismo cuerpo de antes más las dos reglas nuevas (`needed` incluye el mínimo de
-- votos; `visible` dice si alcanza el mínimo de conectados).

alter table public.pantalla_events
  add column if not exists kick_min_votes integer not null default 1,
  add column if not exists kick_min_connected integer not null default 0,
  add column if not exists vote_sound_enabled boolean not null default true;

alter table public.pantalla_events drop constraint if exists pantalla_events_kick_min_votes_chk;
alter table public.pantalla_events
  add constraint pantalla_events_kick_min_votes_chk check (kick_min_votes between 1 and 1000);
alter table public.pantalla_events drop constraint if exists pantalla_events_kick_min_connected_chk;
alter table public.pantalla_events
  add constraint pantalla_events_kick_min_connected_chk check (kick_min_connected between 0 and 1000);

