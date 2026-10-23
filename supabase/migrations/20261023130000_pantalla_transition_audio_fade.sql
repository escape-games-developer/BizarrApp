-- Transición entre canciones del DJ: «Fundido de audio».
--
-- Con la transición con GIF activa, el tema actual baja a silencio mientras
-- aparece el GIF (fade in) y el tema nuevo sube cuando se revela (fade out).
-- Apagado (por defecto), el audio no se toca: el tema suena entero hasta el
-- cambio. Lo leen /tv (PantallaTV → useContinuousTvPlayers) y DJ Democracy →
-- Editor → «Transición entre canciones».

alter table public.pantalla_events
  add column if not exists transition_audio_fade boolean not null default false;
