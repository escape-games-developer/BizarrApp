-- Control remoto del audio de la Pantalla Gigante desde la cabecera del admin.
ALTER TABLE public.game_state
  ADD COLUMN IF NOT EXISTS screen_audio_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.game_state.screen_audio_enabled IS
  'Activa o silencia el audio de la Pantalla Gigante; se sincroniza por Realtime.';
