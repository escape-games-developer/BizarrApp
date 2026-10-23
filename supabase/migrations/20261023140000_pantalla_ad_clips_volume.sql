-- Tandas publicitarias del DJ: volumen de cada clip de la cola (0..100).
-- Lo edita DJ Democracy → Editor → «Tandas publicitarias».

alter table public.pantalla_ad_clips
  add column if not exists volume integer not null default 100;

alter table public.pantalla_ad_clips drop constraint if exists pantalla_ad_clips_volume_chk;
alter table public.pantalla_ad_clips
  add constraint pantalla_ad_clips_volume_chk check (volume between 0 and 100);
