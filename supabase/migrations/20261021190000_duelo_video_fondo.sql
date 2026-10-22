-- ─── Duelo de Talentos: video de fondo activable ────────────────────────────
--
-- Regla nueva en duelo_reglas_config, key='video_fondo', value {}:
--   enabled ON  → el Admin elige un video (YouTube o MP4) y se ve detrás del
--                 duelo en la pantalla.
--   enabled OFF → la ronda se lanza sin video y la pantalla muestra la palabra
--                 DUELO en el centro.
-- Rige desde el próximo lanzamiento: el video viaja con la ronda.

ALTER TABLE public.duelo_reglas_config DROP CONSTRAINT duelo_reglas_config_key_valida;
ALTER TABLE public.duelo_reglas_config
  ADD CONSTRAINT duelo_reglas_config_key_valida
    CHECK (key IN ('duracion_votacion', 'max_aplausos_usuario', 'modo_votacion', 'video_fondo')),
  ADD CONSTRAINT duelo_reglas_config_video_fondo_valido
    CHECK (key <> 'video_fondo' OR value = '{}'::jsonb);

INSERT INTO public.duelo_reglas_config (key, enabled, value)
VALUES ('video_fondo', true, '{}')
ON CONFLICT (key) DO NOTHING;
