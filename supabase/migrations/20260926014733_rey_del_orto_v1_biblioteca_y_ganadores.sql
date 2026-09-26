-- Rey del Orto V1 · Infraestructura base: biblioteca de premios + historial de ganadores
-- No conecta con launch-raffle, coupons, game_state, sessions ni connected_users.

-- ─────────────────────────────────────────────────────────────
-- A) Biblioteca global de premios (vacía, carga manual por admins)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.rey_premios_biblioteca (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text        NOT NULL,
  detalle     text        NULL,
  created_by  uuid        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rey_premios_biblioteca_nombre_trim   CHECK (nombre = btrim(nombre)),
  CONSTRAINT rey_premios_biblioteca_nombre_length CHECK (length(nombre) BETWEEN 2 AND 80)
);

-- Unicidad normalizada (case-insensitive + espacios internos colapsados).
-- El valor almacenado en "nombre" NO se transforma.
CREATE UNIQUE INDEX rey_premios_biblioteca_nombre_norm_key
  ON public.rey_premios_biblioteca (lower(regexp_replace(nombre, '\s+', ' ', 'g')));

COMMENT ON TABLE public.rey_premios_biblioteca IS
  'Rey del Orto: biblioteca global de premios cargados manualmente por admins. Sin session_id ni jornada. Unicidad normalizada vía rey_premios_biblioteca_nombre_norm_key.';

CREATE TRIGGER rey_premios_biblioteca_updated_at
  BEFORE UPDATE ON public.rey_premios_biblioteca
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.rey_premios_biblioteca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rey_premios_biblioteca: admin gestiona"
  ON public.rey_premios_biblioteca
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.rey_premios_biblioteca FROM PUBLIC;
REVOKE ALL ON TABLE public.rey_premios_biblioteca FROM anon;
REVOKE ALL ON TABLE public.rey_premios_biblioteca FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rey_premios_biblioteca TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- B) Historial de ganadores (escritura sólo backend / service_role)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.rey_ganadores (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  winner_name     text        NOT NULL,
  prize_snapshot  text        NOT NULL,
  round_key       timestamptz NOT NULL,
  jornada         date        NOT NULL
                  DEFAULT ((now() AT TIME ZONE 'America/Argentina/Buenos_Aires' - interval '6 hours')::date),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rey_ganadores_jornada_user_key UNIQUE (jornada, user_id)
);

COMMENT ON TABLE public.rey_ganadores IS
  'Rey del Orto: historial inmutable (vía API) de ganadores. Un usuario gana una sola vez por jornada (jornada = hora BA - 6h). prize_snapshot es texto copiado, sin FK a la biblioteca.';

ALTER TABLE public.rey_ganadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rey_ganadores: admin lee"
  ON public.rey_ganadores
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

REVOKE ALL ON TABLE public.rey_ganadores FROM PUBLIC;
REVOKE ALL ON TABLE public.rey_ganadores FROM anon;
REVOKE ALL ON TABLE public.rey_ganadores FROM authenticated;
GRANT SELECT ON TABLE public.rey_ganadores TO authenticated;
