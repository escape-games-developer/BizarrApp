-- Rey del Orto V1 · Reglas configurables + historial con múltiples victorias por jornada

-- A) rey_ganadores: número de victoria por jornada (tabla vacía al momento de la migración)
ALTER TABLE public.rey_ganadores
  ADD COLUMN victoria_n smallint NOT NULL DEFAULT 1,
  ADD CONSTRAINT rey_ganadores_victoria_n_check CHECK (victoria_n >= 1);

ALTER TABLE public.rey_ganadores DROP CONSTRAINT rey_ganadores_jornada_user_key;

ALTER TABLE public.rey_ganadores
  ADD CONSTRAINT rey_ganadores_jornada_user_victoria_key UNIQUE (jornada, user_id, victoria_n);

COMMENT ON TABLE public.rey_ganadores IS
  'Rey del Orto: historial inmutable (vía API) de TODAS las victorias. jornada = hora BA - 6h. victoria_n = n° de victoria del usuario en la jornada. Regla bloquear_ganadores_repetidos ON ⇒ backend inserta victoria_n=1 (UNIQUE rechaza repetidos). OFF ⇒ backend inserta max+1. prize_snapshot es texto copiado, sin FK.';

-- B) rey_reglas_config
CREATE TABLE public.rey_reglas_config (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text        NOT NULL,
  enabled     boolean     NOT NULL DEFAULT true,
  value       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_by  uuid        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rey_reglas_config_key_key UNIQUE (key),
  CONSTRAINT rey_reglas_config_key_formato CHECK (key ~ '^[a-z][a-z0-9_]{2,63}$'),
  CONSTRAINT rey_reglas_config_value_objeto CHECK (jsonb_typeof(value) = 'object'),
  CONSTRAINT rey_reglas_config_participantes_minimos_valido CHECK (
    key <> 'participantes_minimos' OR (
      CASE WHEN jsonb_typeof(value->'min') = 'number'
                AND (value - 'min') = '{}'::jsonb
                AND (value->>'min') ~ '^[1-9][0-9]*$'
           THEN (value->>'min')::int BETWEEN 1 AND 100
           ELSE false
      END)),
  CONSTRAINT rey_reglas_config_bloquear_repetidos_valido CHECK (
    key <> 'bloquear_ganadores_repetidos' OR value = '{}'::jsonb)
);

COMMENT ON TABLE public.rey_reglas_config IS
  'Rey del Orto: reglas operativas globales (una fila por regla). Keys definidas por producto vía migración; Admin sólo SELECT/UPDATE de enabled/value/updated_by.';

CREATE TRIGGER rey_reglas_config_updated_at
  BEFORE UPDATE ON public.rey_reglas_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.rey_reglas_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rey_reglas_config: admin lee"
  ON public.rey_reglas_config FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "rey_reglas_config: admin actualiza"
  ON public.rey_reglas_config FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.rey_reglas_config FROM PUBLIC;
REVOKE ALL ON TABLE public.rey_reglas_config FROM anon;
REVOKE ALL ON TABLE public.rey_reglas_config FROM authenticated;
GRANT SELECT ON TABLE public.rey_reglas_config TO authenticated;
GRANT UPDATE (enabled, value, updated_by) ON TABLE public.rey_reglas_config TO authenticated;

INSERT INTO public.rey_reglas_config (key, enabled, value) VALUES
  ('participantes_minimos',        true, '{"min": 5}'::jsonb),
  ('bloquear_ganadores_repetidos', true, '{}'::jsonb);
