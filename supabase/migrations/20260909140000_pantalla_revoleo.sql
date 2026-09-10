-- ============================================================================
-- DJ Democracy — Revoleo a Pantalla
--
-- NO APLICADA. Local only, auditada contra producción antes de escribirse.
--
-- Agrega:
--   1) el prize_key `throw_screen` al catálogo de premios.
--   2) la galería `pantalla_throw_objects`: imagen volando + imagen caída.
--
-- Las imágenes se suben al bucket/biblioteca existente `bizarren-media`; esta
-- tabla guarda únicamente las URLs públicas seleccionadas.
--
-- Idempotente: correrlo dos veces no cambia nada.
-- ============================================================================

BEGIN;

-- ── 1. Catálogo: permitir `throw_screen` ────────────────────────────────────
--
-- El CHECK real de producción se llama `pantalla_prizes_key_chk` y hoy admite
-- ocho claves. Se lo reemplaza por el mismo con la novena. Se nombra la
-- constraint a mano en vez de recorrer los CHECK de la tabla buscando cuál
-- menciona `prize_key`: ese barrido puede pisar constraints que no son ésta.
--
-- `pantalla_granted_rewards` NO se toca. Producción NO tiene CHECK sobre su
-- `prize_key` — es el registro de lo que ya se otorgó, no el catálogo — y
-- crearle uno acá sería inventar una restricción que nadie pidió.
ALTER TABLE public.pantalla_prizes
  DROP CONSTRAINT IF EXISTS pantalla_prizes_key_chk;

ALTER TABLE public.pantalla_prizes
  ADD CONSTRAINT pantalla_prizes_key_chk
  CHECK (prize_key IN (
    'extra_super_vote',
    'giant_reaction',
    'highlighted_nickname',
    'physical_prize',
    'vip_upgrade',
    'gif_screen',
    'screen_message',
    'vip_badge',
    'throw_screen'
  ));


-- ── 2. Galería de objetos ────────────────────────────────────────────────────
--
-- Dos imágenes por objeto porque el revoleo tiene dos momentos: el objeto
-- cruzando la pantalla y el objeto ya caído, que queda un rato en el piso del
-- cuadro. Son dibujos distintos, no el mismo rotado.
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

-- Un solo índice: la única consulta es «los objetos de este evento, en orden».
-- Un índice suelto por `event_id` sería un prefijo de éste y no agregaría nada.
CREATE INDEX IF NOT EXISTS pantalla_throw_objects_event_position_idx
  ON public.pantalla_throw_objects(event_id, position, created_at);

-- `updated_at` la escribe el frontend en `updateThrowObject`, igual que el
-- resto de las tablas de configuración de Pantalla. No se inventa un trigger:
-- no hay en estas migraciones un helper común de touch confirmado que reusar.

ALTER TABLE public.pantalla_throw_objects ENABLE ROW LEVEL SECURITY;

-- Mismo patrón que `pantalla_gifs`: policies TO public, y quién puede hacer
-- qué lo deciden los GRANT de abajo más `pantalla_can_manage`.
--
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
      TO public
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
      TO public
      USING (public.pantalla_can_manage(event_id))
      WITH CHECK (public.pantalla_can_manage(event_id));
  END IF;
END $$;

GRANT SELECT ON public.pantalla_throw_objects TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pantalla_throw_objects TO authenticated;

-- La tabla NO se agrega a `supabase_realtime`: es configuración, se lee al
-- entrar. El revoleo en vivo viajará por el canal del evento cuando exista el
-- motor; sumarla a la publicación ahora sería tráfico sin consumidor.

COMMIT;
