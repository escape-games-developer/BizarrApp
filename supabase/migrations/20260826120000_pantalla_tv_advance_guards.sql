-- ============================================================================
-- PANTALLA/ESCENARIO — Guards del avance de canción
--
-- Bug: la TV pasaba de canción sola a los pocos segundos de empezar. La causa
-- principal estaba en el frontend (un error del player standby terminaba la
-- canción del player activo), pero el servidor tenía dos huecos que dejaban
-- pasar avances que nunca debieron ejecutarse:
--
--   1. `pantalla_tv_song_ended` aceptaba `_item_id = NULL`. Con NULL, el
--      `_expected_current_id` de `pantalla__advance` queda en NULL y el guard
--      de concurrencia se desactiva: avance a ciegas.
--
--   2. Un aviso atrasado (`ended(A)` duplicado por reconexión, doble pestaña de
--      /tv o reintento del cliente) llegaba cuando la base ya estaba en B.
--      El guard lo rechazaba con una EXCEPCIÓN, no con un no-op: el cliente
--      veía un error y podía reintentar. Ahora es idempotente y silencioso.
--
-- Además la TV informa POR QUÉ terminó el tema, para que el historial distinga
-- un final normal de un salto por video no reproducible.
-- ============================================================================

-- El historial ahora también registra el salto por error de reproducción.
ALTER TABLE pantalla_play_history DROP CONSTRAINT IF EXISTS pantalla_play_history_ended_reason_check;
ALTER TABLE pantalla_play_history
  ADD CONSTRAINT pantalla_play_history_ended_reason_check
  CHECK (ended_reason IN ('advance','kick','manual','skip','error-skip'));


-- ── La TV avisa que terminó la canción ──────────────────────────────────────
-- Firma nueva (suma `_reason`): se borra la anterior para no dejar dos
-- sobrecargas y que PostgREST no tenga que desambiguar.
DROP FUNCTION IF EXISTS public.pantalla_tv_song_ended(uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.pantalla_tv_song_ended(
  _event_id uuid, _token text, _item_id uuid, _reason text DEFAULT 'advance'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_current uuid; v_status text; v_reason text;
BEGIN
  IF NOT public.pantalla__tv_authorized(_event_id, _token) THEN
    RAISE EXCEPTION 'invalid tv access';
  END IF;

  -- Sin item no hay guard posible: se rechaza en vez de avanzar a ciegas.
  IF _item_id IS NULL THEN
    RAISE EXCEPTION 'tv song ended requires the item id';
  END IF;

  v_reason := CASE WHEN _reason = 'error-skip' THEN 'error-skip' ELSE 'advance' END;

  -- Lock de la fila del evento ANTES de comparar. Dos avisos simultáneos se
  -- serializan acá: el segundo ya encuentra otro `current_item_id` y no avanza.
  SELECT current_item_id, status INTO v_current, v_status
    FROM pantalla_events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event not found'; END IF;

  -- Aviso atrasado o evento no en vivo: no-op idempotente.
  --   A suena → ended(A) → la base pasa a B
  --   vuelve a llegar ended(A) → acá v_current = B ≠ A → NO avanza a C.
  IF v_status <> 'live' OR v_current IS DISTINCT FROM _item_id THEN
    RETURN v_current;
  END IF;

  RETURN public.pantalla__advance(_event_id, NULL, _item_id, v_reason);
END $fn$;

COMMENT ON FUNCTION public.pantalla_tv_song_ended(uuid, text, uuid, text) IS
  'Fin de canción reportado por la TV. `_item_id` viaja como expected_current_id: '
  'un aviso de una canción que ya no es la actual es un no-op, nunca un avance.';


-- ── Kick colectivo ──────────────────────────────────────────────────────────
-- Sin cambios de reglas: sigue haciendo falta llegar al umbral configurado.
-- Lo único que se agrega es el lock de la fila del evento, para que dos kicks
-- simultáneos cuenten sobre el mismo estado y no disparen dos avances.
--
-- Recordatorio de que son tres conceptos distintos y ninguno se mezcla:
--   pantalla_reactions  → emoji flotante, no toca el ranking ni la canción
--   pantalla_votes      → 👍/👎 sobre los CANDIDATOS (nunca sobre la actual)
--   pantalla_kick_votes → única vía para sacar la canción actual, y sólo al
--                         alcanzar `kick_threshold_pct` de los activos
CREATE OR REPLACE FUNCTION public.pantalla_toggle_kick_vote(_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_ev   pantalla_events%ROWTYPE;
  v_votes integer; v_active integer; v_needed integer;
  v_voted boolean := false; v_fired boolean := false;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO v_ev FROM pantalla_events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND                    THEN RAISE EXCEPTION 'event not found'; END IF;
  IF v_ev.status <> 'live'        THEN RAISE EXCEPTION 'event not live'; END IF;
  IF NOT v_ev.kick_enabled        THEN RAISE EXCEPTION 'kick disabled'; END IF;
  IF v_ev.current_item_id IS NULL THEN RAISE EXCEPTION 'no current song'; END IF;

  PERFORM public.pantalla__ensure_participant(_event_id, v_user);

  -- El servidor lleva la cuenta; el contador del cliente es sólo decorativo.
  DELETE FROM pantalla_kick_votes
   WHERE event_id = _event_id AND item_id = v_ev.current_item_id AND user_id = v_user;

  IF NOT FOUND THEN
    INSERT INTO pantalla_kick_votes (event_id, item_id, user_id)
    VALUES (_event_id, v_ev.current_item_id, v_user);
    v_voted := true;
  END IF;

  SELECT COUNT(*)::int INTO v_votes FROM pantalla_kick_votes
   WHERE event_id = _event_id AND item_id = v_ev.current_item_id;

  v_active := public.pantalla__active_count(_event_id);
  v_needed := GREATEST(1, CEIL(GREATEST(v_active, 1) * v_ev.kick_threshold_pct / 100.0)::int);

  -- Sólo acá, y sólo alcanzando el umbral, un voto negativo cambia la canción.
  IF v_voted AND v_votes >= v_needed THEN
    PERFORM public.pantalla__advance(_event_id, NULL, v_ev.current_item_id, 'kick');
    v_fired := true;
  END IF;

  RETURN jsonb_build_object('ok', true, 'voted', v_voted, 'fired', v_fired,
                            'votes', v_votes, 'active', v_active, 'needed', v_needed);
END $fn$;
