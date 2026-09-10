-- ============================================================================
-- PANTALLA/ESCENARIO — Limpieza automática de invitados y corrección del reset
--
-- NO APLICADA. Se entrega para correr desde Claude Desktop contra el Supabase
-- remoto. Dos cosas que la auditoría encontró comprobando contra la base viva,
-- no leyendo el código:
--
--   1. «Limpieza automática de invitados» guarda `guest_cleanup_enabled` y
--      `guest_max_connection_hours` desde hace tiempo, pero NO EXISTE ninguna
--      función que las lea ni ningún job que las corra: `pg_cron` no está ni
--      instalado en el proyecto. El control estaba mintiendo.
--
--   2. `pantalla_reset_event` NO borra `pantalla_granted_rewards`. La sección
--      «Reiniciar evento» promete borrar los premios y el progreso de logros, y
--      hoy los deja. Reiniciar y volver a jugar arrastra los premios de la
--      corrida anterior.
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
-- La función es SECURITY DEFINER porque la corre el scheduler, sin sesión, y
-- por lo tanto sin pasar por `pantalla_can_manage`. Sólo toca eventos en vivo:
-- un evento terminado conserva sus participantes para las estadísticas.
CREATE OR REPLACE FUNCTION public.pantalla_cleanup_guests()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
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
  'Saca del evento en vivo a los invitados que superaron guest_max_connection_hours. Nunca toca vip/staff/dj. La corre el job pantalla-cleanup-guests.';

-- Nadie la llama por REST: es del scheduler. Sin GRANT a anon/authenticated.
REVOKE ALL ON FUNCTION public.pantalla_cleanup_guests() FROM PUBLIC, anon, authenticated;


-- ── 2. El job ───────────────────────────────────────────────────────────────
--
-- `pg_cron` NO está instalado en este proyecto (se verificó contra pg_extension
-- el 2026-09-09). Esta es la parte que hay que mirar con atención al aplicar:
-- instalar una extensión es un cambio de infraestructura, no de esquema.
--
-- Si se prefiere no instalarla, la alternativa es llamar a la función desde
-- afuera —una Edge Function con un cron de Supabase, o el propio panel al
-- iniciar la jornada— y en ese caso hay que saltear este bloque entero.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Cada 15 minutos alcanza: la unidad de configuración son horas, así que el
-- peor caso es que alguien sobreviva 15 minutos de más.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('pantalla-cleanup-guests')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pantalla-cleanup-guests');
    PERFORM cron.schedule('pantalla-cleanup-guests', '*/15 * * * *',
                          'SELECT public.pantalla_cleanup_guests();');
  END IF;
END $$;


-- ── 3. `pantalla_reset_event` — que borre lo que el cartel promete ──────────
--
-- Se copió el cuerpo de la función viva y se le agregó UNA línea: el DELETE de
-- `pantalla_granted_rewards`. Todo lo demás queda igual, incluido el
-- `pantalla_refill_candidates` del final.
--
-- Lo que sigue SIN tocarse, que es lo que el panel promete conservar: el orden
-- y los recortes de la playlist, los presets, el branding, los diseños de las
-- pantallas y toda la configuración del evento. `pantalla_contacts` tampoco se
-- toca: es la base permanente y sobrevivir al reset es todo su sentido.
CREATE OR REPLACE FUNCTION public.pantalla_reset_event(_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT public.pantalla_can_manage(_event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE pantalla_events SET current_item_id = NULL, is_playing = false,
    voting_frozen = false, voting_disabled = false, frozen_ranking = NULL,
    current_started_at = NULL, tv_current_time = NULL, tv_duration = NULL
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
  UPDATE pantalla_teams SET points = 0 WHERE event_id = _event_id;
  UPDATE pantalla_events SET team_round_started_at = NULL WHERE id = _event_id;
  PERFORM public.pantalla_refill_candidates(_event_id);
  RETURN jsonb_build_object('ok', true);
END $fn$;
-- ============================================================================
