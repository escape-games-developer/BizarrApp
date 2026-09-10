-- ============================================================================
-- PANTALLA/ESCENARIO — Limpieza automática de invitados y corrección del reset
--
-- NO APLICADA. Se entrega para correr después contra el Supabase remoto. Dos
-- cosas que la auditoría encontró comprobando contra la base viva, no leyendo
-- el código:
--
--   1. «Limpieza automática de invitados» guarda `guest_cleanup_enabled` y
--      `guest_max_connection_hours` desde hace tiempo, pero NO EXISTE ninguna
--      función que las lea. El control estaba mintiendo.
--
--   2. `pantalla_reset_event` NO borra `pantalla_granted_rewards` ni pone los
--      puntajes de equipo en cero. La sección «Reiniciar evento» promete borrar
--      los premios y el progreso, y hoy los deja: reiniciar y volver a jugar
--      arrastra la corrida anterior.
--
-- Idempotente: correrlo dos veces no cambia nada.
-- ============================================================================


-- ── 1. Limpieza automática de invitados ─────────────────────────────────────
--
-- Qué se borra: el participante cuyo `joined_at` es más viejo que las horas
-- configuradas. Es «hace cuánto que entró», NO «hace cuánto que no se lo ve»
-- (eso es `last_seen_at`, que gobierna la ventana de actividad de Sacar Tema).
-- Son dos relojes distintos y el panel lo aclara.
--
-- Qué NUNCA se borra: vip, staff y dj. El invitado se va, el equipo del bar no.
--
-- `birthday` SÍ se borra: es un invitado con una etiqueta de la noche, no
-- personal del local. Si se quiere protegerlo, agregarlo a la lista de abajo.
--
-- La función es SECURITY DEFINER porque la corre un scheduler, sin sesión, y
-- por lo tanto sin pasar por `pantalla_can_manage`. Sólo toca eventos en vivo:
-- un evento terminado conserva sus participantes para las estadísticas.
CREATE OR REPLACE FUNCTION public.pantalla_cleanup_guests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE _borrados integer;
BEGIN
  WITH fuera AS (
    DELETE FROM pantalla_participants p
     USING pantalla_events e
     WHERE e.id = p.event_id
       AND e.status = 'live'
       AND e.guest_cleanup_enabled
       AND p.role NOT IN ('vip','staff','dj')
       AND p.joined_at < now() - make_interval(hours => e.guest_max_connection_hours)
    RETURNING p.id
  )
  SELECT COUNT(*)::int INTO _borrados FROM fuera;
  RETURN _borrados;
END $fn$;

COMMENT ON FUNCTION public.pantalla_cleanup_guests() IS
  'Saca del evento en vivo a los invitados que superaron guest_max_connection_hours. Nunca toca vip/staff/dj.';

-- Nadie la llama por REST: es del scheduler. Sin GRANT a anon/authenticated.
REVOKE ALL ON FUNCTION public.pantalla_cleanup_guests() FROM PUBLIC, anon, authenticated;

-- El scheduler NO se configura acá. `pg_cron` es un cambio de infraestructura,
-- no de esquema: instalar una extensión desde una migración de aplicación mezcla
-- dos cosas que se revierten distinto. La función queda lista y disponible; el
-- job se habilita después desde el Dashboard de Supabase (o llamándola desde una
-- Edge Function, o desde el propio panel al iniciar la jornada). Cada 15 minutos
-- alcanza: la unidad de configuración son horas, así que el peor caso es que
-- alguien sobreviva 15 minutos de más.


-- ── 2. `pantalla_reset_event` — que borre lo que el cartel promete ──────────
--
-- Cuerpo vivo, con lo que faltaba agregado al final de cada bloque:
--
--   · DELETE de `pantalla_granted_rewards` — los premios otorgados son progreso
--     de la corrida, no configuración.
--   · `pantalla_teams.points` a cero, y `team_round_started_at` a NULL.
--   · los contadores del Tomatazo a cero. Este es el ÚNICO lugar donde
--     `kick_impact_seq` vuelve a 0: durante la jornada es monotónico, y sólo
--     tiene sentido reiniciarlo cuando se reinicia el evento entero.
--
-- Lo que sigue SIN tocarse, que es lo que el panel promete conservar: el orden
-- y los recortes de la playlist, los presets, los equipos COMO CONFIGURACIÓN
-- (se les borran los puntos, no las filas), el branding, los diseños de las
-- pantallas, la config de logros, la de premios y premios físicos, los GIFs,
-- los packs de emoji, las publicidades, los regalos VIP, los short links y los
-- secretos del evento. `pantalla_contacts` tampoco se toca: es la base
-- permanente y sobrevivir al reset es todo su sentido.
CREATE OR REPLACE FUNCTION public.pantalla_reset_event(_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT public.pantalla_can_manage(_event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE pantalla_events SET current_item_id = NULL, is_playing = false,
    voting_frozen = false, voting_disabled = false, frozen_ranking = NULL,
    current_started_at = NULL, tv_current_time = NULL, tv_duration = NULL,
    team_round_started_at = NULL,
    kick_votes_current = 0, kick_impact_seq = 0, kick_last_vote_at = NULL
   WHERE id = _event_id;
  DELETE FROM pantalla_votes           WHERE event_id = _event_id;
  DELETE FROM pantalla_kick_votes      WHERE event_id = _event_id;
  DELETE FROM pantalla_reactions       WHERE event_id = _event_id;
  DELETE FROM pantalla_play_history    WHERE event_id = _event_id;
  DELETE FROM pantalla_granted_rewards WHERE event_id = _event_id;  -- ← lo que faltaba
  DELETE FROM pantalla_participants    WHERE event_id = _event_id;
  UPDATE pantalla_playlist_items SET
    is_active_candidate = false, pos_votes = 0, neg_votes = 0, score = 0,
    times_played = 0, last_status = 'idle', last_status_changed_at = now(),
    consecutive_last_place_rounds = 0, hot_until = NULL
   WHERE event_id = _event_id;
  -- Los puntajes de equipo también son progreso de la corrida: vuelven a cero.
  -- Los equipos en sí (nombre, color, integrantes) son configuración y quedan.
  UPDATE pantalla_teams SET points = 0 WHERE event_id = _event_id;
  PERFORM public.pantalla_refill_candidates(_event_id);
  RETURN jsonb_build_object('ok', true);
END $fn$;
-- ============================================================================
