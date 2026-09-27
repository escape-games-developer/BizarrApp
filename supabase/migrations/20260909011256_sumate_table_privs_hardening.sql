
-- Sumate — endurecer privilegios de tabla:
-- anon y authenticated NO deben tener TRUNCATE/REFERENCES/TRIGGER,
-- sólo SELECT donde corresponde.
-- No se tocan postgres, service_role, ni los RPC SECURITY DEFINER.

REVOKE ALL PRIVILEGES ON TABLE public.sumate_rounds
  FROM anon, authenticated;
GRANT  SELECT ON TABLE public.sumate_rounds
  TO anon, authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.sumate_assignments
  FROM anon, authenticated;
GRANT  SELECT ON TABLE public.sumate_assignments
  TO authenticated;
