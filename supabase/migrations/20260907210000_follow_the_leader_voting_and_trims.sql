-- ============================================================
-- Follow The Leader — backend de votación + recortes
-- ============================================================

-- 1) Recortes en playlist_items
ALTER TABLE public.playlist_items
  ADD COLUMN IF NOT EXISTS trim_start_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trim_end_seconds   integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'playlist_items_trim_start_nonneg'
  ) THEN
    ALTER TABLE public.playlist_items
      ADD CONSTRAINT playlist_items_trim_start_nonneg
      CHECK (trim_start_seconds >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'playlist_items_trim_end_after_start'
  ) THEN
    ALTER TABLE public.playlist_items
      ADD CONSTRAINT playlist_items_trim_end_after_start
      CHECK (trim_end_seconds IS NULL OR trim_end_seconds > trim_start_seconds);
  END IF;
END $$;

-- 2) Votos individuales (privada — no publicada en Realtime)
CREATE TABLE IF NOT EXISTS public.follow_leader_votes (
  turn_id     uuid NOT NULL REFERENCES public.escenario_queue(id) ON DELETE CASCADE,
  session_id  uuid NOT NULL REFERENCES public.sessions(id)        ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id)             ON DELETE CASCADE,
  vote        text NOT NULL CHECK (vote IN ('up','down')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (turn_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_follow_leader_votes_session
  ON public.follow_leader_votes (session_id, turn_id);

-- 3) Agregados públicos (fuente única, publicada en Realtime)
CREATE TABLE IF NOT EXISTS public.follow_leader_vote_totals (
  turn_id     uuid PRIMARY KEY REFERENCES public.escenario_queue(id) ON DELETE CASCADE,
  session_id  uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  up          integer NOT NULL DEFAULT 0 CHECK (up   >= 0),
  down        integer NOT NULL DEFAULT 0 CHECK (down >= 0),
  total       integer GENERATED ALWAYS AS (up + down) STORED,
  up_pct      integer GENERATED ALWAYS AS (
                CASE WHEN (up + down) = 0 THEN 0
                     ELSE round(up * 100.0 / (up + down))::int END) STORED,
  down_pct    integer GENERATED ALWAYS AS (
                CASE WHEN (up + down) = 0 THEN 0
                     ELSE 100 - round(up * 100.0 / (up + down))::int END) STORED,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_follow_leader_totals_session
  ON public.follow_leader_vote_totals (session_id);

-- 4) Trigger de agregación atómica
CREATE OR REPLACE FUNCTION public._follow_leader_vote_totals_apply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_turn uuid; v_session uuid;
  v_du int := 0; v_dd int := 0;
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
  ELSE
    v_turn := OLD.turn_id; v_session := OLD.session_id;
    IF OLD.vote = 'up' THEN v_du := -1; ELSE v_dd := -1; END IF;
  END IF;

  INSERT INTO public.follow_leader_vote_totals (turn_id, session_id, up, down, updated_at)
  VALUES (v_turn, v_session, GREATEST(v_du,0), GREATEST(v_dd,0), now())
  ON CONFLICT (turn_id) DO UPDATE SET
    up         = GREATEST(0, public.follow_leader_vote_totals.up   + v_du),
    down       = GREATEST(0, public.follow_leader_vote_totals.down + v_dd),
    updated_at = now();

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

DROP TRIGGER IF EXISTS trg_follow_leader_vote_totals ON public.follow_leader_votes;
CREATE TRIGGER trg_follow_leader_vote_totals
AFTER INSERT OR UPDATE OR DELETE ON public.follow_leader_votes
FOR EACH ROW EXECUTE FUNCTION public._follow_leader_vote_totals_apply();

-- 5) RLS
ALTER TABLE public.follow_leader_votes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_leader_vote_totals  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fl_votes_select_self_or_admin" ON public.follow_leader_votes;
CREATE POLICY "fl_votes_select_self_or_admin" ON public.follow_leader_votes
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "fl_totals_select_public" ON public.follow_leader_vote_totals;
CREATE POLICY "fl_totals_select_public" ON public.follow_leader_vote_totals
  FOR SELECT TO anon, authenticated
  USING (true);

-- 6) RPC público
CREATE OR REPLACE FUNCTION public.cast_follow_leader_vote(p_turn_id uuid, p_vote text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_turn public.escenario_queue%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_vote NOT IN ('up','down') THEN RAISE EXCEPTION 'invalid vote'; END IF;

  SELECT * INTO v_turn FROM public.escenario_queue WHERE id = p_turn_id;
  IF NOT FOUND                    THEN RAISE EXCEPTION 'turn not found'; END IF;
  IF v_turn.type   <> 'ftl'       THEN RAISE EXCEPTION 'not a follow the leader turn'; END IF;
  IF v_turn.status <> 'called'    THEN RAISE EXCEPTION 'turn not open for voting'; END IF;
  IF v_turn.user_id = v_user      THEN RAISE EXCEPTION 'protagonist cannot vote on their own turn'; END IF;

  INSERT INTO public.follow_leader_votes (turn_id, session_id, user_id, vote)
  VALUES (p_turn_id, v_turn.session_id, v_user, p_vote)
  ON CONFLICT (turn_id, user_id) DO UPDATE
    SET vote = EXCLUDED.vote,
        updated_at = now()
    WHERE public.follow_leader_votes.vote IS DISTINCT FROM EXCLUDED.vote;
END $$;

REVOKE ALL ON FUNCTION public.cast_follow_leader_vote(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cast_follow_leader_vote(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.cast_follow_leader_vote(uuid, text) TO authenticated;

-- 7) Realtime — sólo agregados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public'
      AND tablename='follow_leader_vote_totals'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.follow_leader_vote_totals';
  END IF;
END $$;
