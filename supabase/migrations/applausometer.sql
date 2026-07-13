-- ===== APLAUSÓMETRO =====

-- 1. Ronda de competencia (una por juego PT/FTL). Patrón "una fila que todos escuchan".
CREATE TABLE IF NOT EXISTS applause_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  game_type     text NOT NULL CHECK (game_type IN ('personal_trainer','follow_leader')),
  status        text NOT NULL DEFAULT 'idle'
                CHECK (status IN ('idle','countdown','voting','finished')),
  -- 2 participantes (snapshot denormalizado: avatar+nombre al momento, patrón del proyecto)
  p1_user_id    uuid REFERENCES auth.users(id),
  p1_name       text,
  p1_avatar     text,
  p2_user_id    uuid REFERENCES auth.users(id),
  p2_name       text,
  p2_avatar     text,
  voting_ends_at timestamptz,        -- timestamp ABSOLUTO, fuente de verdad del countdown
  winner_slot   int CHECK (winner_slot IN (1,2)),  -- se setea al finalizar
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 2. Contador AGREGADO. Una fila por (ronda, slot). NO una fila por tap.
CREATE TABLE IF NOT EXISTS applause_counts (
  round_id  uuid NOT NULL REFERENCES applause_sessions(id) ON DELETE CASCADE,
  slot      int  NOT NULL CHECK (slot IN (1,2)),
  total     bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (round_id, slot)
);

-- 3. Aporte por cliente (para aplicar el cap anti-abuso por usuario por ronda).
CREATE TABLE IF NOT EXISTS applause_user_contrib (
  round_id  uuid NOT NULL REFERENCES applause_sessions(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id),
  slot      int  NOT NULL CHECK (slot IN (1,2)),
  count     int  NOT NULL DEFAULT 0,
  PRIMARY KEY (round_id, user_id, slot)
);

-- ===== RPC: increment atómico con cap =====
-- El cliente llama esto cada ~500ms con el delta acumulado local.
-- MAX_PER_USER = tope de seguridad anti-bot (no lo nota un humano real).
CREATE OR REPLACE FUNCTION applause_add(
  p_round uuid, p_slot int, p_delta int
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  MAX_PER_USER constant int := 300;
  v_user uuid := auth.uid();
  v_current int;
  v_allowed int;
BEGIN
  IF v_user IS NULL THEN RETURN; END IF;
  IF p_slot NOT IN (1,2) THEN RETURN; END IF;
  -- solo si la ronda está en voting
  IF NOT EXISTS (SELECT 1 FROM applause_sessions
                 WHERE id = p_round AND status = 'voting') THEN
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
END $$;

-- ===== RPC: cerrar ronda idempotente =====
CREATE OR REPLACE FUNCTION applause_finish(p_round uuid, p_force boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_t1 bigint; v_t2 bigint; v_winner int; v_ends timestamptz;
BEGIN
  SELECT voting_ends_at INTO v_ends FROM applause_sessions WHERE id = p_round;
  IF v_ends IS NULL THEN RETURN; END IF;

  IF p_force THEN
    IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
      RETURN;
    END IF;
  ELSE
    IF now() < v_ends THEN RETURN; END IF;
  END IF;

  -- guard idempotente: solo cierra si sigue en voting
  UPDATE applause_sessions SET status = 'finished'
    WHERE id = p_round AND status = 'voting';
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE((SELECT total FROM applause_counts WHERE round_id=p_round AND slot=1),0),
         COALESCE((SELECT total FROM applause_counts WHERE round_id=p_round AND slot=2),0)
    INTO v_t1, v_t2;
  v_winner := CASE WHEN v_t2 > v_t1 THEN 2 ELSE 1 END;
  UPDATE applause_sessions SET winner_slot = v_winner WHERE id = p_round;
END $$;

-- ===== Realtime =====
ALTER PUBLICATION supabase_realtime ADD TABLE applause_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE applause_counts;
