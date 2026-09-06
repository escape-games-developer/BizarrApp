-- applause_finish: cierre forzado real + empate = NULL
-- Mantiene semántica original para p_force=false (PT / Follow Leader / Duelo sin forzado).
-- Cambios:
--   * p_force=true: cierra aunque voting_ends_at sea NULL o el deadline no haya vencido (requiere admin).
--   * empate (v_t1 = v_t2): winner_slot = NULL (compatible con winner_slot check IN (1,2) por reglas de NULL en CHECK).
CREATE OR REPLACE FUNCTION public.applause_finish(p_round uuid, p_force boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_t1 bigint;
  v_t2 bigint;
  v_winner int;
  v_ends timestamptz;
BEGIN
  SELECT voting_ends_at INTO v_ends FROM applause_sessions WHERE id = p_round;

  IF p_force THEN
    IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
      RETURN;
    END IF;
    -- forzado permite v_ends NULL o now() < v_ends
  ELSE
    IF v_ends IS NULL THEN RETURN; END IF;
    IF now() < v_ends THEN RETURN; END IF;
  END IF;

  UPDATE applause_sessions SET status = 'finished'
    WHERE id = p_round AND status = 'voting';
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE((SELECT total FROM applause_counts WHERE round_id = p_round AND slot = 1), 0),
         COALESCE((SELECT total FROM applause_counts WHERE round_id = p_round AND slot = 2), 0)
    INTO v_t1, v_t2;

  v_winner := CASE
                WHEN v_t1 > v_t2 THEN 1
                WHEN v_t2 > v_t1 THEN 2
                ELSE NULL
              END;

  UPDATE applause_sessions SET winner_slot = v_winner WHERE id = p_round;
END $function$;
