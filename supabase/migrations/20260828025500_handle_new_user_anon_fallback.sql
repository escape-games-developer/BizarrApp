-- ============================================================================
-- handle_new_user — fallback de `name` para usuarios anonimos
--
-- Un usuario creado con signInAnonymously() no tiene email: NULL. El fallback
-- anterior era split_part(new.email,'@',1), que con email NULL devuelve NULL, y
-- profiles.name es NOT NULL. Si alguna vez se crea un anonimo sin metadata, el
-- INSERT falla, el handler de excepcion lo repite con el mismo NULL y falla de
-- nuevo: el usuario queda sin fila en profiles, en silencio.
--
-- Se agrega un ultimo escalon literal para que el nombre nunca pueda ser NULL.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_name text := coalesce(
    nullif(new.raw_user_meta_data->>'name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Invitado'
  );
BEGIN
  INSERT INTO public.profiles (
    id, name, team, phone, avatar_id, avatar_emoji,
    registered, geo_ok, created_at, updated_at
  ) VALUES (
    new.id, v_name,
    CASE WHEN new.raw_user_meta_data->>'team' IN ('batata','membrillo')
         THEN new.raw_user_meta_data->>'team' ELSE NULL END,
    nullif(new.raw_user_meta_data->>'phone', ''),
    nullif(new.raw_user_meta_data->>'avatar_id', ''),
    nullif(new.raw_user_meta_data->>'avatar_emoji', ''),
    new.email_confirmed_at IS NOT NULL,
    false, now(), now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user: insert completo fallo para % (%). Fila minima.',
                new.id, sqlerrm;
  BEGIN
    INSERT INTO public.profiles (id, name, registered, geo_ok)
    VALUES (new.id, v_name, new.email_confirmed_at IS NOT NULL, false)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: fila minima tambien fallo para %: %',
                  new.id, sqlerrm;
  END;
  RETURN new;
END $fn$;
