-- ===== APLAUSÓMETRO · RLS + GRANTS =====

-- applause_sessions: lectura pública, escritura solo admin
ALTER TABLE applause_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applause_sessions_read" ON applause_sessions;
CREATE POLICY "applause_sessions_read"
  ON applause_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "applause_sessions_admin_all" ON applause_sessions;
CREATE POLICY "applause_sessions_admin_all"
  ON applause_sessions FOR ALL
  USING      (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- applause_counts: lectura pública, sin escritura directa (solo vía RPC)
ALTER TABLE applause_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applause_counts_read" ON applause_counts;
CREATE POLICY "applause_counts_read"
  ON applause_counts FOR SELECT USING (true);

-- applause_user_contrib: ledger interno, solo admin puede leer para auditar
ALTER TABLE applause_user_contrib ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applause_user_contrib_admin_read" ON applause_user_contrib;
CREATE POLICY "applause_user_contrib_admin_read"
  ON applause_user_contrib FOR SELECT
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- Grants de ejecución de los RPC
REVOKE ALL ON FUNCTION applause_add(uuid, int, int) FROM public;
GRANT EXECUTE ON FUNCTION applause_add(uuid, int, int) TO authenticated;

REVOKE EXECUTE ON FUNCTION applause_finish(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION applause_finish(uuid, boolean) TO authenticated;
