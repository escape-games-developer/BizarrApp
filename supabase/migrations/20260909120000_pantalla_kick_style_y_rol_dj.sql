-- ============================================================================
-- PANTALLA/ESCENARIO — Paridad con DJ Democracy original, Fase A
--
-- NO APLICADA. Se entrega para correr después contra el Supabase remoto.
--
-- Los cuerpos de `pantalla__active_count`, `pantalla_toggle_kick_vote`,
-- `pantalla__advance`, `pantalla_set_participant_role` y
-- `pantalla_get_kick_status` que hay acá abajo se extrajeron con
-- `pg_get_functiondef()` de la base viva y se modificaron SÓLO en lo que esta
-- migración necesita. Cada bloque aclara cuál es el cambio. Si alguien tocó
-- esas funciones desde entonces, comparar antes de correr.
--
-- Qué cierra esta migración:
--
--   1. «Sacar Tema» tiene un selector de estilo: 👎 Clásico / 🍅 Tomatazo.
--   2. El Tomatazo necesita sus tres imágenes y un contador de impactos que la
--      TV pueda seguir sin estar suscrita a `pantalla_kick_votes`.
--   3. Los poderes de voto tienen CINCO roles; nos falta DJ.
--   4. El DJ es operador, no público: no cuenta para el umbral del kick.
--
-- Todo el archivo es idempotente: correrlo dos veces no cambia nada.
-- ============================================================================


-- ── A. Estilo de Sacar Tema ─────────────────────────────────────────────────
-- Sólo cambia la presentación del botón en el cliente y del cartel en la TV.
-- La mecánica del kick (umbral, ventana de actividad, avance) no se toca.
--
-- El default es 'classic': los eventos que ya existen siguen viéndose igual
-- después de aplicar. El Tomatazo se prende a mano, por evento.
ALTER TABLE public.pantalla_events
  ADD COLUMN IF NOT EXISTS kick_style text NOT NULL DEFAULT 'classic';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pantalla_events_kick_style_check') THEN
    ALTER TABLE public.pantalla_events
      ADD CONSTRAINT pantalla_events_kick_style_check
      CHECK (kick_style IN ('classic','tomato'));
  END IF;
END $$;

COMMENT ON COLUMN public.pantalla_events.kick_style IS
  'Presentación de Sacar Tema: classic (👎) o tomato (🍅 Tomatazo). No altera la mecánica del kick.';


-- ── B. Imágenes del Tomatazo ────────────────────────────────────────────────
-- Se buscaron nombres ya existentes antes de crear estos: en `pantalla_events`
-- no hay ninguna columna de assets del kick (las únicas de imagen son
-- `logo_url` y `background_image_url`, que son del branding del evento y no se
-- pueden reutilizar sin pisar la personalización visual). Tampoco hay filas de
-- `pantalla_gifs` con un `kind` que sirva: su CHECK sólo admite 'prize' y
-- 'transition'. Así que son columnas nuevas, y son sólo tres.
--
-- Van en NULL a propósito: NULL significa «usá el dibujo por defecto de la TV»,
-- que es distinto de una cadena vacía. El panel guarda NULL cuando se quita.
ALTER TABLE public.pantalla_events
  ADD COLUMN IF NOT EXISTS kick_tomato_flying_url   text,
  ADD COLUMN IF NOT EXISTS kick_tomato_exploded_url text,
  ADD COLUMN IF NOT EXISTS kick_tomato_splat_url    text;

COMMENT ON COLUMN public.pantalla_events.kick_tomato_flying_url IS
  'Tomate cruzando la pantalla en cada voto de Sacar Tema. NULL = dibujo por defecto de la TV.';
COMMENT ON COLUMN public.pantalla_events.kick_tomato_exploded_url IS
  'Tomate en el instante del impacto. NULL = dibujo por defecto de la TV.';
COMMENT ON COLUMN public.pantalla_events.kick_tomato_splat_url IS
  'Mancha que queda pegada tras el impacto. NULL = dibujo por defecto de la TV.';


-- ── C. Contadores de runtime del Tomatazo ───────────────────────────────────
--
-- El Tomatazo NO es una imagen fija: cada voto nuevo tiene que disparar UN
-- impacto, y cuanto más cerca está la votación del umbral, más al centro pega.
-- La física la resuelve la TV; el servidor sólo garantiza que cada voto sea un
-- evento discreto y ordenado.
--
-- Por qué hacen falta columnas y no alcanza `pantalla_kick_votes`: la TV está
-- suscrita a `pantalla_events`, no a la tabla de votos. Y `pantalla_kick_votes`
-- es un conjunto — su tamaño no distingue un voto nuevo de una recarga de
-- página. El contrato con la TV es entonces:
--
--   kick_votes_current → cuántos votos lleva el tema actual
--   kick_impact_seq    → MONOTÓNICO durante toda la jornada. Cada vez que
--                        cambia, la TV dibuja un impacto. No se resetea al
--                        cambiar de canción: si se reseteara, el número podría
--                        repetirse y la TV no vería cambio donde sí hubo voto.
--   kick_last_vote_at  → para las animaciones con decaimiento temporal
--
--   progreso = kick_votes_current / needed   → 0 … 1
--   radio    = (1 - progreso) * R_max        → lejos del centro al principio,
--                                              encima del centro al final
ALTER TABLE public.pantalla_events
  ADD COLUMN IF NOT EXISTS kick_votes_current integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kick_impact_seq    bigint      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kick_last_vote_at  timestamptz;

COMMENT ON COLUMN public.pantalla_events.kick_votes_current IS
  'Votos de Sacar Tema acumulados sobre la canción actual. Vuelve a 0 al cambiar de canción.';
COMMENT ON COLUMN public.pantalla_events.kick_impact_seq IS
  'Secuencia monotónica de impactos del Tomatazo. Sube sólo al entrar un voto nuevo; no baja '
  'al retirarse un voto ni al cambiar de canción. Sólo el reset del evento la vuelve a 0.';
COMMENT ON COLUMN public.pantalla_events.kick_last_vote_at IS
  'Momento del último voto de Sacar Tema sobre la canción actual. NULL al cambiar de canción.';


-- ── D. Rol DJ ───────────────────────────────────────────────────────────────
-- Los dos CHECK se amplían por separado: `pantalla_participants.role` es quién
-- puede SER dj, `pantalla_vote_powers.role` es qué pesa un dj. Los dos tienen
-- que aceptarlo o la matriz falla al guardar.
ALTER TABLE public.pantalla_participants
  DROP CONSTRAINT IF EXISTS pantalla_participants_role_check;
ALTER TABLE public.pantalla_participants
  ADD CONSTRAINT pantalla_participants_role_check
  CHECK (role IN ('guest','vip','birthday','staff','dj'));

ALTER TABLE public.pantalla_vote_powers
  DROP CONSTRAINT IF EXISTS pantalla_vote_powers_role_check;
ALTER TABLE public.pantalla_vote_powers
  ADD CONSTRAINT pantalla_vote_powers_role_check
  CHECK (role IN ('guest','vip','birthday','staff','dj'));

-- Cuerpo vivo, con un único cambio de comportamiento: la lista que valida a
-- mano suma 'dj'. Misma firma, misma seguridad.
CREATE OR REPLACE FUNCTION public.pantalla_set_participant_role(_event_id uuid, _user_id uuid, _role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT public.pantalla_can_manage(_event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _role NOT IN ('guest','vip','birthday','staff','dj') THEN RAISE EXCEPTION 'invalid role'; END IF;
  UPDATE pantalla_participants SET role = _role
   WHERE event_id = _event_id AND user_id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'participant not found'; END IF;
  RETURN jsonb_build_object('ok', true, 'role', _role);
END $fn$;


-- ── E. Pesos por defecto observados en la original ──────────────────────────
-- Cambios respecto de lo que sembrábamos:
--
--   · staff queda en 1/1/5 CON PESO REAL. Antes iba en 0/0/0 («vota pero no
--     mueve el ranking»); la captura del panel original muestra +1 / -1 / súper
--     5, así que el staff sí pesa. Su súper hate queda en 0.
--   · el VALOR de super_down es 2 en guest/vip/birthday (sigue deshabilitado:
--     el valor es el que tomaría si alguien lo prende).
--   · se suma el rol dj: +10 / -10 / súper 20 / súper hate 20, este último
--     HABILITADO — es el único rol que lo trae encendido.
--
-- Recordatorio de signo: `value` es siempre POSITIVO y el signo lo pone el
-- `vote_type` (`pantalla__recalc` suma up/super_up y resta down/super_down).
-- Por eso el «Súper Hate -20» de la captura se guarda como value = 20.
CREATE OR REPLACE FUNCTION public.pantalla_reset_vote_powers(_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT public.pantalla_can_manage(_event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;

  DELETE FROM pantalla_vote_powers WHERE event_id = _event_id;
  INSERT INTO pantalla_vote_powers (event_id, role, vote_type, enabled, value) VALUES
    (_event_id,'guest','up',           true,  1),
    (_event_id,'guest','down',         true,  1),
    (_event_id,'guest','super_up',     true,  5),
    (_event_id,'guest','super_down',   false, 2),
    (_event_id,'vip','up',             true,  2),
    (_event_id,'vip','down',           true,  2),
    (_event_id,'vip','super_up',       true,  5),
    (_event_id,'vip','super_down',     false, 2),
    (_event_id,'birthday','up',        true,  3),
    (_event_id,'birthday','down',      true,  2),
    (_event_id,'birthday','super_up',  true,  5),
    (_event_id,'birthday','super_down',false, 2),
    (_event_id,'staff','up',           true,  1),
    (_event_id,'staff','down',         true,  1),
    (_event_id,'staff','super_up',     true,  5),
    (_event_id,'staff','super_down',   false, 0),
    (_event_id,'dj','up',              true, 10),
    (_event_id,'dj','down',            true, 10),
    (_event_id,'dj','super_up',        true, 20),
    (_event_id,'dj','super_down',      true, 20);
END $fn$;

-- Los eventos que YA existen conservan su matriz: esta función sólo corre al
-- crear un evento o al tocar «Restablecer a valores por defecto» en el panel.
-- Para que un evento viejo tome los pesos nuevos hay que apretar ese botón.


-- ── F. El DJ no cuenta para el umbral del kick ──────────────────────────────
-- Cuerpo vivo, con un único cambio: `p.role <> 'staff'` pasa a
-- `p.role NOT IN ('staff','dj')`. El DJ es operador, no público: contarlo subía
-- el umbral que el público real tiene que alcanzar para voltear un tema.
CREATE OR REPLACE FUNCTION public.pantalla__active_count(_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT COUNT(*)::int FROM pantalla_participants p
  JOIN pantalla_events e ON e.id = p.event_id
  WHERE p.event_id = _event_id AND p.role NOT IN ('staff','dj')
    AND p.last_seen_at > now() - make_interval(mins => e.kick_activity_minutes);
$fn$;


-- ── G. Cada voto de Sacar Tema avisa a la TV ────────────────────────────────
-- Cuerpo vivo, con un único agregado: después de contar los votos y ANTES de
-- evaluar el umbral, los contadores de `pantalla_events` se ponen al día.
--
--   voto NUEVO (INSERT)    → sube kick_impact_seq: hay un impacto que dibujar
--   voto RETIRADO (DELETE) → NO sube kick_impact_seq: el tomate ya voló; lo
--                            único que cambia es el contador
--
-- Las reglas del kick no se tocan: sigue haciendo falta llegar al umbral.
--
-- Recordatorio de que son tres conceptos distintos y ninguno se mezcla:
--   pantalla_reactions  → emoji flotante, no toca el ranking ni la canción
--   pantalla_votes      → 👍/👎 sobre los CANDIDATOS (nunca sobre la actual)
--   pantalla_kick_votes → única vía para sacar la canción actual, y sólo al
--                         alcanzar `kick_threshold_pct` de los activos
CREATE OR REPLACE FUNCTION public.pantalla_toggle_kick_vote(_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
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

  DELETE FROM pantalla_kick_votes
   WHERE event_id = _event_id AND item_id = v_ev.current_item_id AND user_id = v_user;

  IF NOT FOUND THEN
    INSERT INTO pantalla_kick_votes (event_id, item_id, user_id)
    VALUES (_event_id, v_ev.current_item_id, v_user);
    v_voted := true;
  END IF;

  SELECT COUNT(*)::int INTO v_votes FROM pantalla_kick_votes
   WHERE event_id = _event_id AND item_id = v_ev.current_item_id;

  -- El impacto se publica acá, antes del umbral: si este voto dispara el
  -- avance, `pantalla__advance` deja el contador en 0 y la TV recibe el impacto
  -- y el cambio de canción en la misma notificación de realtime.
  IF v_voted THEN
    UPDATE pantalla_events
       SET kick_votes_current = v_votes,
           kick_impact_seq    = kick_impact_seq + 1,
           kick_last_vote_at  = now()
     WHERE id = _event_id;
  ELSE
    UPDATE pantalla_events
       SET kick_votes_current = v_votes
     WHERE id = _event_id;
  END IF;

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


-- ── H. Al cambiar de canción la votación arranca de cero ────────────────────
-- Cuerpo vivo, con un único cambio: el UPDATE final de `pantalla_events` suma
-- `kick_votes_current = 0` y `kick_last_vote_at = NULL`. La selección del
-- próximo tema, el historial, los votos, el worst, los candidatos, el score, el
-- refill, el reason y la firma quedan idénticos.
--
-- `kick_impact_seq` NO se toca: es monotónico durante toda la jornada. Si
-- volviera a 0 acá, el próximo voto de la canción nueva podría repetir un número
-- que la TV ya vio y el impacto no se dibujaría.
CREATE OR REPLACE FUNCTION public.pantalla__advance(
  _event_id uuid, _force_item_id uuid DEFAULT NULL,
  _expected_current_id uuid DEFAULT NULL, _reason text DEFAULT 'advance'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_ev pantalla_events%ROWTYPE; v_cur pantalla_playlist_items%ROWTYPE;
  v_next uuid; v_worst uuid;
BEGIN
  -- Lock de fila: dos avances simultáneos (el DJ y el fin de video en la TV)
  -- se serializan acá en vez de pisarse.
  SELECT * INTO v_ev FROM pantalla_events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event not found'; END IF;

  -- Optimistic locking, equivalente al `_expected_current_id` del original.
  IF _expected_current_id IS NOT NULL AND v_ev.current_item_id IS DISTINCT FROM _expected_current_id THEN
    RAISE EXCEPTION 'stale advance: current song already changed';
  END IF;

  -- 1. Archivar la que estaba sonando, con el score que la hizo ganar.
  IF v_ev.current_item_id IS NOT NULL THEN
    SELECT * INTO v_cur FROM pantalla_playlist_items WHERE id = v_ev.current_item_id;
    IF FOUND THEN
      INSERT INTO pantalla_play_history
        (event_id, item_id, title, artist, cover_url, final_score, pos_votes, neg_votes, ended_reason)
      VALUES (_event_id, v_cur.id, v_cur.title, v_cur.artist, v_cur.cover_url,
              COALESCE(v_cur.won_with_score, v_cur.score),
              COALESCE(v_cur.won_with_pos,   v_cur.pos_votes),
              COALESCE(v_cur.won_with_neg,   v_cur.neg_votes),
              _reason);
      DELETE FROM pantalla_votes      WHERE item_id = v_cur.id;
      DELETE FROM pantalla_kick_votes WHERE item_id = v_cur.id;
      UPDATE pantalla_playlist_items SET
        times_played = times_played + 1, is_active_candidate = false,
        last_status = 'played_recently', last_status_changed_at = now(),
        consecutive_last_place_rounds = 0, pos_votes = 0, neg_votes = 0, score = 0,
        hot_until = NULL, won_with_score = NULL, won_with_pos = NULL, won_with_neg = NULL
      WHERE id = v_cur.id;
    END IF;
  END IF;

  -- 2. Elegir la próxima: la forzada por el DJ, o la #1 del ranking.
  IF _force_item_id IS NOT NULL THEN
    SELECT id INTO v_next FROM pantalla_playlist_items
     WHERE id = _force_item_id AND event_id = _event_id AND enabled;
    IF v_next IS NULL THEN RAISE EXCEPTION 'forced song not available'; END IF;
  ELSE
    SELECT id INTO v_next FROM pantalla_playlist_items
     WHERE event_id = _event_id AND is_active_candidate AND enabled
       AND id IS DISTINCT FROM v_ev.current_item_id
     ORDER BY score DESC, pos_votes DESC, position ASC, created_at ASC LIMIT 1;
  END IF;

  -- 3. Penalizar al último de la ronda (relegación por rondas consecutivas).
  SELECT id INTO v_worst FROM pantalla_playlist_items
   WHERE event_id = _event_id AND is_active_candidate AND enabled
     AND NOT locked AND NOT pinned AND id IS DISTINCT FROM v_next
   ORDER BY score ASC, position DESC LIMIT 1;
  IF v_worst IS NOT NULL THEN
    UPDATE pantalla_playlist_items SET consecutive_last_place_rounds = consecutive_last_place_rounds + 1
     WHERE id = v_worst;
  END IF;

  -- 4. Promover: congela el score ganador y arranca limpia.
  IF v_next IS NOT NULL THEN
    DELETE FROM pantalla_votes WHERE item_id = v_next;
    UPDATE pantalla_playlist_items SET
      is_active_candidate = false, last_status = 'active', last_status_changed_at = now(),
      won_with_score = score, won_with_pos = pos_votes, won_with_neg = neg_votes,
      pos_votes = 0, neg_votes = 0, score = 0
    WHERE id = v_next;
  END IF;

  UPDATE pantalla_events SET
    current_item_id = v_next,
    current_started_at = CASE WHEN v_next IS NOT NULL THEN now() ELSE NULL END,
    is_playing = v_next IS NOT NULL,
    frozen_ranking = NULL, voting_frozen = false, tv_current_time = 0,
    -- La votación de Sacar Tema es POR TEMA: el contador arranca de cero.
    -- `kick_impact_seq` queda como está, es monotónico de toda la jornada.
    kick_votes_current = 0, kick_last_vote_at = NULL
  WHERE id = _event_id;

  PERFORM public.pantalla_refill_candidates(_event_id);
  RETURN v_next;
END $fn$;


-- ── I. El estado del kick que leen el cliente y la TV ───────────────────────
-- Cuerpo vivo —incluidos `threshold_pct` y el `RETURN {enabled: false}` cuando
-- el evento no existe, que NO es una excepción— con dos cambios:
--
--   · se agregan `style`, `impact_seq`, `kick_votes_current`, `progress` y
--     `assets`. Ningún consumidor actual se entera.
--   · se va `vote_index` (y con él `v_idx` y `v_mine`): era el orden del voto
--     PROPIO, y /tv no tiene sesión, así que ahí siempre valía NULL. El impacto
--     lo marca `impact_seq`, que es del evento y no del votante.
--
-- `voted` se conserva: lo usa el cliente autenticado para pintar su botón.
CREATE OR REPLACE FUNCTION public.pantalla_get_kick_status(_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_ev     pantalla_events%ROWTYPE;
  v_votes  integer;
  v_active integer;
  v_needed integer;
  v_voted  boolean;
BEGIN
  SELECT * INTO v_ev FROM pantalla_events WHERE id = _event_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('enabled', false); END IF;

  SELECT COUNT(*)::int INTO v_votes FROM pantalla_kick_votes
   WHERE event_id = _event_id AND item_id = v_ev.current_item_id;

  v_active := public.pantalla__active_count(_event_id);
  v_needed := GREATEST(1, CEIL(v_active * v_ev.kick_threshold_pct / 100.0)::int);

  SELECT EXISTS (
    SELECT 1 FROM pantalla_kick_votes
     WHERE event_id = _event_id AND item_id = v_ev.current_item_id
       AND user_id = auth.uid()
  ) INTO v_voted;

  RETURN jsonb_build_object(
    -- ── Claves existentes, sin cambios ──────────────────────────────────
    'enabled',            v_ev.kick_enabled,
    'item_id',            v_ev.current_item_id,
    'votes',              v_votes,
    'active',             v_active,
    'needed',             v_needed,
    'threshold_pct',      v_ev.kick_threshold_pct,
    'voted',              COALESCE(v_voted, false),
    'button_text',        v_ev.kick_button_text,
    -- ── Contrato visual nuevo. El cliente clásico las ignora ────────────
    'style',              COALESCE(v_ev.kick_style, 'classic'),
    'impact_seq',         v_ev.kick_impact_seq,
    'kick_votes_current', v_ev.kick_votes_current,
    'progress',           LEAST(1.0, v_votes::numeric / GREATEST(v_needed, 1)),
    'assets',             jsonb_build_object(
                            'flying',   v_ev.kick_tomato_flying_url,
                            'exploded', v_ev.kick_tomato_exploded_url,
                            'splat',    v_ev.kick_tomato_splat_url)
  );
END $fn$;
-- ============================================================================
