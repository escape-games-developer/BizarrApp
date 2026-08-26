-- ============================================================================
-- PANTALLA/ESCENARIO — RLS y Realtime
--
-- Regla general: el cliente NUNCA escribe directo. Todas sus mutaciones pasan
-- por RPCs SECURITY DEFINER que validan estado, rol, duplicados y peso.
-- Lo único que el cliente inserta por REST es su propia reacción, y sólo si
-- user_id = auth.uid().
--
-- Reutiliza `public.is_admin()`, que ya existe en BizarrApp.
-- ============================================================================

ALTER TABLE pantalla_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pantalla_event_secrets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pantalla_playlist_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pantalla_participants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pantalla_votes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pantalla_vote_powers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pantalla_kick_votes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pantalla_reactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pantalla_play_history    ENABLE ROW LEVEL SECURITY;

-- Dueño del evento o admin del bar.
CREATE OR REPLACE FUNCTION public.pantalla_can_manage(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
      OR EXISTS (SELECT 1 FROM pantalla_events e
                 WHERE e.id = _event_id AND e.owner_id = auth.uid());
$$;


-- ── EVENTOS ─────────────────────────────────────────────────────────────────
-- Lectura pública: la TV entra sin sesión y el cliente necesita el estado.
-- Ya no hay secretos en esta tabla (viven en pantalla_event_secrets).
DROP POLICY IF EXISTS "pantalla_events: lectura publica" ON pantalla_events;
CREATE POLICY "pantalla_events: lectura publica"
  ON pantalla_events FOR SELECT USING (true);

DROP POLICY IF EXISTS "pantalla_events: admin gestiona" ON pantalla_events;
CREATE POLICY "pantalla_events: admin gestiona"
  ON pantalla_events FOR ALL
  USING (public.is_admin() OR owner_id = auth.uid())
  WITH CHECK (public.is_admin() OR owner_id = auth.uid());


-- ── SECRETOS ────────────────────────────────────────────────────────────────
-- Sin política de lectura pública: el token de TV no sale por REST jamás.
DROP POLICY IF EXISTS "pantalla_secrets: solo admin" ON pantalla_event_secrets;
CREATE POLICY "pantalla_secrets: solo admin"
  ON pantalla_event_secrets FOR ALL
  USING (public.pantalla_can_manage(event_id))
  WITH CHECK (public.pantalla_can_manage(event_id));


-- ── PLAYLIST ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "pantalla_items: lectura publica" ON pantalla_playlist_items;
CREATE POLICY "pantalla_items: lectura publica"
  ON pantalla_playlist_items FOR SELECT USING (true);

-- El cliente no puede tocar score/pos_votes/is_active_candidate: sólo el admin
-- por REST y las RPCs por SECURITY DEFINER.
DROP POLICY IF EXISTS "pantalla_items: admin gestiona" ON pantalla_playlist_items;
CREATE POLICY "pantalla_items: admin gestiona"
  ON pantalla_playlist_items FOR ALL
  USING (public.pantalla_can_manage(event_id))
  WITH CHECK (public.pantalla_can_manage(event_id));


-- ── PARTICIPANTES ───────────────────────────────────────────────────────────
-- Cada usuario ve su propia fila; el admin/DJ ve todas. El alta y el heartbeat
-- pasan por RPC, así nadie se auto-asigna un rol especial.
DROP POLICY IF EXISTS "pantalla_participants: propia o admin" ON pantalla_participants;
CREATE POLICY "pantalla_participants: propia o admin"
  ON pantalla_participants FOR SELECT
  USING (user_id = auth.uid() OR public.pantalla_can_manage(event_id));

DROP POLICY IF EXISTS "pantalla_participants: admin gestiona" ON pantalla_participants;
CREATE POLICY "pantalla_participants: admin gestiona"
  ON pantalla_participants FOR ALL
  USING (public.pantalla_can_manage(event_id))
  WITH CHECK (public.pantalla_can_manage(event_id));


-- ── VOTOS ───────────────────────────────────────────────────────────────────
-- El ranking público sale de los agregados de pantalla_playlist_items, así que
-- nadie necesita leer los votos ajenos. El DJ sí, para las estadísticas.
DROP POLICY IF EXISTS "pantalla_votes: propios o admin" ON pantalla_votes;
CREATE POLICY "pantalla_votes: propios o admin"
  ON pantalla_votes FOR SELECT
  USING (user_id = auth.uid() OR public.pantalla_can_manage(event_id));

DROP POLICY IF EXISTS "pantalla_votes: admin gestiona" ON pantalla_votes;
CREATE POLICY "pantalla_votes: admin gestiona"
  ON pantalla_votes FOR ALL
  USING (public.pantalla_can_manage(event_id))
  WITH CHECK (public.pantalla_can_manage(event_id));


-- ── PODERES DE VOTO ─────────────────────────────────────────────────────────
-- Lectura pública: el cliente necesita saber qué botones mostrar. La decisión
-- real igual la toma el servidor en cada voto.
DROP POLICY IF EXISTS "pantalla_powers: lectura publica" ON pantalla_vote_powers;
CREATE POLICY "pantalla_powers: lectura publica"
  ON pantalla_vote_powers FOR SELECT USING (true);

DROP POLICY IF EXISTS "pantalla_powers: admin gestiona" ON pantalla_vote_powers;
CREATE POLICY "pantalla_powers: admin gestiona"
  ON pantalla_vote_powers FOR ALL
  USING (public.pantalla_can_manage(event_id))
  WITH CHECK (public.pantalla_can_manage(event_id));


-- ── KICK ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "pantalla_kick: propios o admin" ON pantalla_kick_votes;
CREATE POLICY "pantalla_kick: propios o admin"
  ON pantalla_kick_votes FOR SELECT
  USING (user_id = auth.uid() OR public.pantalla_can_manage(event_id));

DROP POLICY IF EXISTS "pantalla_kick: admin gestiona" ON pantalla_kick_votes;
CREATE POLICY "pantalla_kick: admin gestiona"
  ON pantalla_kick_votes FOR ALL
  USING (public.pantalla_can_manage(event_id))
  WITH CHECK (public.pantalla_can_manage(event_id));


-- ── REACCIONES ──────────────────────────────────────────────────────────────
-- Lectura pública: la TV entra sin sesión y tiene que verlas flotar.
DROP POLICY IF EXISTS "pantalla_reactions: lectura publica" ON pantalla_reactions;
CREATE POLICY "pantalla_reactions: lectura publica"
  ON pantalla_reactions FOR SELECT USING (true);

-- Única escritura directa del cliente, y sólo con su propia identidad.
DROP POLICY IF EXISTS "pantalla_reactions: propia insercion" ON pantalla_reactions;
CREATE POLICY "pantalla_reactions: propia insercion"
  ON pantalla_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "pantalla_reactions: admin gestiona" ON pantalla_reactions;
CREATE POLICY "pantalla_reactions: admin gestiona"
  ON pantalla_reactions FOR ALL
  USING (public.pantalla_can_manage(event_id))
  WITH CHECK (public.pantalla_can_manage(event_id));


-- ── HISTORIAL ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "pantalla_history: lectura publica" ON pantalla_play_history;
CREATE POLICY "pantalla_history: lectura publica"
  ON pantalla_play_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "pantalla_history: admin gestiona" ON pantalla_play_history;
CREATE POLICY "pantalla_history: admin gestiona"
  ON pantalla_play_history FOR ALL
  USING (public.pantalla_can_manage(event_id))
  WITH CHECK (public.pantalla_can_manage(event_id));


-- ── REALTIME ────────────────────────────────────────────────────────────────
-- REPLICA IDENTITY FULL: sin esto, un DELETE sólo publica la PK y el filtro
-- `event_id=eq.<id>` del cliente descarta el evento. Hace falta para que
-- "quitar voto" y "sacar una canción" se propaguen.
ALTER TABLE pantalla_votes          REPLICA IDENTITY FULL;
ALTER TABLE pantalla_kick_votes     REPLICA IDENTITY FULL;
ALTER TABLE pantalla_playlist_items REPLICA IDENTITY FULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pantalla_events','pantalla_playlist_items','pantalla_votes',
    'pantalla_reactions','pantalla_participants'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
