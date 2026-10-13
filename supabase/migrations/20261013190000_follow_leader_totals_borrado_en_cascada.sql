-- ─── Follow the Leader: totales y borrado en cascada ─────────────────────────
--
-- Al borrar una cuenta (admin_delete_user / delete_my_account) se borra en
-- cascada su turno en escenario_queue y, con él, los votos de ese turno. El
-- trigger de totales, en cada DELETE de voto, hacía un upsert en
-- follow_leader_vote_totals con un turn_id que ya no existe → violación de FK
-- y el borrado entero se cancelaba.
--
-- Única diferencia con la versión anterior: en un DELETE cuyo turno ya no
-- existe, no hay totales que actualizar (se borran con el turno).

CREATE OR REPLACE FUNCTION public._follow_leader_vote_totals_apply()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_turn    uuid;
  v_session uuid;
  v_du      int := 0;
  v_dd      int := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_turn := NEW.turn_id; v_session := NEW.session_id;
    IF NEW.vote = 'up' THEN v_du := 1; ELSE v_dd := 1; END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    v_turn := NEW.turn_id; v_session := NEW.session_id;
    IF OLD.vote = NEW.vote THEN RETURN NEW; END IF;
    IF OLD.vote = 'up' AND NEW.vote = 'down' THEN v_du := -1; v_dd := 1;
    ELSIF OLD.vote = 'down' AND NEW.vote = 'up' THEN v_du := 1; v_dd := -1;
    END IF;
  ELSE -- DELETE
    v_turn := OLD.turn_id; v_session := OLD.session_id;
    IF NOT EXISTS (SELECT 1 FROM public.escenario_queue WHERE id = v_turn) THEN
      RETURN OLD;   -- el turno se está borrando en cascada
    END IF;
    IF OLD.vote = 'up' THEN v_du := -1; ELSE v_dd := -1; END IF;
  END IF;

  INSERT INTO public.follow_leader_vote_totals (turn_id, session_id, up, down, updated_at)
  VALUES (v_turn, v_session, GREATEST(v_du,0), GREATEST(v_dd,0), now())
  ON CONFLICT (turn_id) DO UPDATE SET
    up         = GREATEST(0, public.follow_leader_vote_totals.up   + v_du),
    down       = GREATEST(0, public.follow_leader_vote_totals.down + v_dd),
    updated_at = now();

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $function$;
