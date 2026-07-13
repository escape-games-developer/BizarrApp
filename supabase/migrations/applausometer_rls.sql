-- ===== APLAUSÓMETRO · RLS =====
-- Correr DESPUÉS de applausometer.sql (necesita las tablas y los RPC ya creados).
--
-- Convención del proyecto: admin = EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
--
-- Modelo de seguridad:
--   * applause_sessions     -> lectura pública (app + pantalla); escritura SOLO admin.
--   * applause_counts       -> lectura pública; SIN escritura directa de clientes.
--                              Los totales solo se tocan vía RPC applause_add / applause_finish,
--                              que son SECURITY DEFINER y saltean RLS. Así nadie puede
--                              inflar el contador con un UPDATE directo.
--   * applause_user_contrib -> ledger interno anti-abuso; SIN acceso de clientes.
--                              Solo lo escribe el RPC. Admin puede leerlo para auditar.
--
-- Idempotente: DROP POLICY IF EXISTS antes de cada CREATE, para poder re-correr.

-- ---------- applause_sessions ----------
ALTER TABLE applause_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applause_sessions: todos pueden leer" ON applause_sessions;
CREATE POLICY "applause_sessions: todos pueden leer"
  ON applause_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "applause_sessions: admin gestiona" ON applause_sessions;
CREATE POLICY "applause_sessions: admin gestiona"
  ON applause_sessions FOR ALL
  USING      (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- ---------- applause_counts ----------
ALTER TABLE applause_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applause_counts: todos pueden leer" ON applause_counts;
CREATE POLICY "applause_counts: todos pueden leer"
  ON applause_counts FOR SELECT USING (true);
-- (sin policy de escritura: INSERT/UPDATE de totales SOLO vía RPC SECURITY DEFINER)

-- ---------- applause_user_contrib ----------
ALTER TABLE applause_user_contrib ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applause_user_contrib: admin lee" ON applause_user_contrib;
CREATE POLICY "applause_user_contrib: admin lee"
  ON applause_user_contrib FOR SELECT
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));
-- (sin policy de escritura ni de lectura para clientes: el ledger lo maneja SOLO el RPC)

-- ===== GRANTS de ejecución de los RPC =====
-- Con RLS activo las tablas quedan cerradas a escritura directa; los RPC (SECURITY DEFINER)
-- son el ÚNICO camino para sumar aplausos y cerrar la ronda. Aseguramos que el rol
-- autenticado pueda ejecutarlos y le sacamos el acceso a anon (los RPC ya cortan si
-- auth.uid() IS NULL, pero mejor cerrarlo de entrada).
REVOKE ALL ON FUNCTION applause_add(uuid, int, int) FROM public;
GRANT EXECUTE ON FUNCTION applause_add(uuid, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION applause_finish(uuid, boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION applause_finish(uuid, boolean) FROM public;
