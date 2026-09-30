-- ============================================================================
-- applause_add: en el Duelo, los dos que están en el escenario no votan.
--
-- Base: definición vigente en producción (idéntica a supabase/migrations/
-- applausometer.sql). Único cambio: el guard de duelistas, después de validar
-- usuario / slot / ronda en 'voting' y ANTES de tocar applause_user_contrib y
-- applause_counts. Sólo aplica a game_type='duelo': personal_trainer y
-- follow_leader quedan exactamente igual.
--
-- Se conserva SECURITY DEFINER y la respuesta silenciosa (RETURN, no RAISE):
-- el cliente llama este RPC cada ~500 ms fire-and-forget.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.applause_add(p_round uuid, p_slot integer, p_delta integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  MAX_PER_USER constant int := 300;
  v_user   uuid := auth.uid();
  v_current int;
  v_allowed int;
BEGIN
  IF v_user IS NULL THEN RETURN; END IF;
  IF p_slot NOT IN (1,2) THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM applause_sessions
                 WHERE id = p_round AND status = 'voting') THEN
    RETURN;
  END IF;

  -- Duelo de Talentos: el duelista no se vota a sí mismo ni vota al rival.
  IF EXISTS (SELECT 1 FROM public.applause_sessions
             WHERE id = p_round
               AND game_type = 'duelo'
               AND (p1_user_id = v_user OR p2_user_id = v_user)) THEN
    RETURN;
  END IF;

  INSERT INTO applause_user_contrib(round_id, user_id, slot, count)
  VALUES (p_round, v_user, p_slot, 0)
  ON CONFLICT (round_id, user_id, slot) DO NOTHING;

  SELECT count INTO v_current FROM applause_user_contrib
    WHERE round_id = p_round AND user_id = v_user AND slot = p_slot;

  v_allowed := GREATEST(0, LEAST(p_delta, MAX_PER_USER - v_current));
  IF v_allowed = 0 THEN RETURN; END IF;

  UPDATE applause_user_contrib SET count = count + v_allowed
    WHERE round_id = p_round AND user_id = v_user AND slot = p_slot;

  INSERT INTO applause_counts(round_id, slot, total)
  VALUES (p_round, p_slot, v_allowed)
  ON CONFLICT (round_id, slot) DO UPDATE SET total = applause_counts.total + v_allowed;
END $function$;