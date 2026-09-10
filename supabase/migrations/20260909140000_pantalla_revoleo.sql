-- DJ Democracy — Revoleo a Pantalla
-- Local only. Auditar contra producción antes de aplicar.
--
-- Agrega:
--   1) prize_key `throw_screen` al catálogo y a premios otorgados.
--   2) galería `pantalla_throw_objects` con imagen volando + imagen caída.
--
-- Las imágenes se suben al bucket/biblioteca existente `bizarren-media`;
-- esta tabla guarda únicamente las URLs públicas seleccionadas.

BEGIN;

-- ── 1. Catálogo: permitir `throw_screen` ────────────────────────────────────
-- Producción tiene estas tablas pero sus CHECK históricos no están
-- reconstruidos en migrations. En vez de asumir nombres de constraint,
-- reemplazamos únicamente CHECKs cuya definición menciona `prize_key`.

DO $$
DECLARE
  c record;
BEGIN
  IF to_regclass('public.pantalla_prizes') IS NOT NULL THEN
    FOR c IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.pantalla_prizes'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%prize_key%'
    LOOP
      EXECUTE format('ALTER TABLE public.pantalla_prizes DROP CONSTRAINT %I', c.conname);
    END LOOP;

    ALTER TABLE public.pantalla_prizes
      ADD CONSTRAINT pantalla_prizes_prize_key_check
      CHECK (prize_key IN (
        'extra_super_vote',
        'giant_reaction',
        'highlighted_nickname',
        'physical_prize',
        'vip_upgrade',
        'throw_screen',
        'gif_screen',
        'screen_message',
        'vip_badge'
      ));
  END IF;
END $$;

DO $$
DECLARE
  c record;
BEGIN
  IF to_regclass('public.pantalla_granted_rewards') IS NOT NULL THEN
    FOR c IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.pantalla_granted_rewards'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%prize_key%'
    LOOP
      EXECUTE format('ALTER TABLE public.pantalla_granted_rewards DROP CONSTRAINT %I', c.conname);
    END LOOP;

    ALTER TABLE public.pantalla_granted_rewards
      ADD CONSTRAINT pantalla_granted_rewards_prize_key_check
      CHECK (prize_key IN (
        'extra_super_vote',
        'giant_reaction',
        'highlighted_nickname',
        'physical_prize',
        'vip_upgrade',
        'throw_screen',
        'gif_screen',
        'screen_message',
        'vip_badge'
      ));
  END IF;
END $$;

-- ── 2. Galería de objetos ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pantalla_throw_objects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES public.pantalla_events(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  flying_url  text NOT NULL,
  fallen_url  text NOT NULL,
  position    integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  enabled     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pantalla_throw_objects_event_position_idx
  ON public.pantalla_throw_objects(event_id, position, created_at);

ALTER TABLE public.pantalla_throw_objects ENABLE ROW LEVEL SECURITY;

-- El nombre y las dos imágenes son configuración pública del evento: el
-- invitado necesita leerlas cuando gana `throw_screen`.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pantalla_throw_objects'
      AND policyname = 'pantalla_throw_objects_select'
  ) THEN
    CREATE POLICY pantalla_throw_objects_select
      ON public.pantalla_throw_objects
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- Sólo quienes ya pueden administrar el evento pueden crear/editar/borrar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pantalla_throw_objects'
      AND policyname = 'pantalla_throw_objects_manage'
  ) THEN
    CREATE POLICY pantalla_throw_objects_manage
      ON public.pantalla_throw_objects
      FOR ALL
      TO authenticated
      USING (public.pantalla_can_manage(event_id))
      WITH CHECK (public.pantalla_can_manage(event_id));
  END IF;
END $$;

GRANT SELECT ON public.pantalla_throw_objects TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pantalla_throw_objects TO authenticated;

COMMIT;
