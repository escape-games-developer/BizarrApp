-- ─── Duelo: los que subieron al escenario dejan la lista de postulantes ─────
--
-- Ciclo de una postulación:
--   waiting  → en la lista de postulantes
--   selected → duelo_launch_round la elige: está en el escenario (no se lista)
--   ronda finished  → la postulación se BORRA: para volver a participar hay
--                     que postularse de nuevo (UNIQUE session_id, user_id)
--   ronda cancelled → vuelve a 'waiting': no llegó a competir
--
-- Lo hace un trigger sobre applause_sessions, así vale para cualquier camino
-- de cierre (Finalizar, reloj, cancelación, ronda nueva que cancela la vieja).
--
-- REPLICA IDENTITY FULL: un DELETE sólo trae la PK por Realtime y las
-- suscripciones filtran por session_id; sin esto los celulares y el Admin no
-- se enterarían del borrado.

ALTER TABLE public.duelo_postulaciones REPLICA IDENTITY FULL;

CREATE FUNCTION public.duelo_ronda_cierre_postulaciones()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.game_type <> 'duelo' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'finished' THEN
    DELETE FROM public.duelo_postulaciones
     WHERE session_id = NEW.session_id
       AND user_id IN (NEW.p1_user_id, NEW.p2_user_id);
  ELSIF NEW.status = 'cancelled' THEN
    UPDATE public.duelo_postulaciones SET status = 'waiting'
     WHERE session_id = NEW.session_id
       AND user_id IN (NEW.p1_user_id, NEW.p2_user_id)
       AND status = 'selected';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.duelo_ronda_cierre_postulaciones() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER duelo_ronda_cierre_postulaciones
  AFTER UPDATE OF status ON public.applause_sessions
  FOR EACH ROW EXECUTE FUNCTION public.duelo_ronda_cierre_postulaciones();

-- Limpieza: los 'selected' de rondas ya cerradas (antes quedaban en la lista).
DELETE FROM public.duelo_postulaciones d
 WHERE d.status = 'selected'
   AND NOT EXISTS (
     SELECT 1 FROM public.applause_sessions a
      WHERE a.game_type = 'duelo' AND a.session_id = d.session_id
        AND a.status IN ('idle', 'countdown', 'voting')
        AND d.user_id IN (a.p1_user_id, a.p2_user_id));
