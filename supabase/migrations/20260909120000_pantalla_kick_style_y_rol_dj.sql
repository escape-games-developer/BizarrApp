-- ============================================================================
-- PANTALLA/ESCENARIO — Paridad con DJ Democracy original, Fase A
--
-- NO APLICADA. Se entrega para correr después desde Claude Desktop contra el
-- Supabase remoto. El frontend de esta tanda NO depende de ella: los controles
-- que necesitan estas columnas están avisados en el panel, no puestos.
--
-- Dos diferencias de la auditoría visual del evento de referencia 7F2B0C que no
-- se pueden cerrar sin tocar el esquema:
--
--   1. «Sacar Tema» tiene un selector de estilo: 👎 Clásico / 🍅 Tomatazo.
--   2. Los poderes de voto tienen CINCO roles; nos falta DJ.
--
-- Y una tercera que es sólo de datos: los pesos por defecto observados no
-- coinciden con los que sembramos hoy (ver bloque 3).
--
-- Todo el archivo es idempotente: correrlo dos veces no cambia nada.
-- ============================================================================


-- ── 1. Estilo de Sacar Tema ─────────────────────────────────────────────────
-- Sólo cambia la presentación del botón en el cliente y del cartel en la TV.
-- La mecánica del kick (umbral, ventana de actividad, avance) no se toca.
ALTER TABLE public.pantalla_events
  ADD COLUMN IF NOT EXISTS kick_style text NOT NULL DEFAULT 'classic';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pantalla_events_kick_style_check') THEN
    ALTER TABLE public.pantalla_events
      ADD CONSTRAINT pantalla_events_kick_style_check
      CHECK (kick_style IN ('classic','tomato'));
  END IF;
END $$;

COMMENT ON COLUMN public.pantalla_events.kick_style IS
  'Presentación de Sacar Tema: classic (👎) o tomato (🍅 Tomatazo). No altera la mecánica del kick.';


-- ── 2. Rol DJ ───────────────────────────────────────────────────────────────
-- Los dos CHECK se amplían por separado: `pantalla_participants.role` es quién
-- puede SER dj, `pantalla_vote_powers.role` es qué pesa un dj. Los dos tienen
-- que aceptarlo o la matriz falla al guardar.
ALTER TABLE public.pantalla_participants
  DROP CONSTRAINT IF EXISTS pantalla_participants_role_check;
ALTER TABLE public.pantalla_participants
  ADD CONSTRAINT pantalla_participants_role_check
  CHECK (role IN ('guest','vip','birthday','staff','dj'));

ALTER TABLE public.pantalla_vote_powers
  DROP CONSTRAINT IF EXISTS pantalla_vote_powers_role_check;
ALTER TABLE public.pantalla_vote_powers
  ADD CONSTRAINT pantalla_vote_powers_role_check
  CHECK (role IN ('guest','vip','birthday','staff','dj'));

-- `pantalla_set_participant_role` valida la lista a mano, además del CHECK.
CREATE OR REPLACE FUNCTION public.pantalla_set_participant_role(_event_id uuid, _user_id uuid, _role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT public.pantalla_can_manage(_event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _role NOT IN ('guest','vip','birthday','staff','dj') THEN RAISE EXCEPTION 'invalid role'; END IF;
  UPDATE pantalla_participants SET role = _role
   WHERE event_id = _event_id AND user_id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'participant not found'; END IF;
  RETURN jsonb_build_object('ok', true, 'role', _role);
END $fn$;


-- ── 3. Pesos por defecto observados en la original ──────────────────────────
-- Cambios respecto de lo que sembrábamos:
--
--   · staff pasa de 1/1/5 a 1/1/5 CON PESO REAL. Antes iba en 0/0/0 («vota pero
--     no mueve el ranking»); la captura del panel original muestra +1 / -1 /
--     súper 5, así que el staff sí pesa. Su súper hate queda en 0.
--   · el VALOR de super_down baja de 5 a 2 en guest/vip/birthday (sigue
--     deshabilitado: el valor es el que tomaría si alguien lo prende).
--   · se suma el rol dj: +10 / -10 / súper 20 / súper hate 20, este último
--     HABILITADO — es el único rol que lo trae encendido.
--
-- Recordatorio de signo: `weight` es siempre positivo y el signo lo pone el
-- `vote_type` (`pantalla__recalc` suma up/super_up y resta down/super_down).
-- Por eso el «Súper Hate -20» de la captura se guarda como value = 20.
CREATE OR REPLACE FUNCTION public.pantalla_reset_vote_powers(_event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT public.pantalla_can_manage(_event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;

  DELETE FROM pantalla_vote_powers WHERE event_id = _event_id;
  INSERT INTO pantalla_vote_powers (event_id, role, vote_type, enabled, value) VALUES
    (_event_id,'guest','up',           true,  1),
    (_event_id,'guest','down',         true,  1),
    (_event_id,'guest','super_up',     true,  5),
    (_event_id,'guest','super_down',   false, 2),
    (_event_id,'vip','up',             true,  2),
    (_event_id,'vip','down',           true,  2),
    (_event_id,'vip','super_up',       true,  5),
    (_event_id,'vip','super_down',     false, 2),
    (_event_id,'birthday','up',        true,  3),
    (_event_id,'birthday','down',      true,  2),
    (_event_id,'birthday','super_up',  true,  5),
    (_event_id,'birthday','super_down',false, 2),
    (_event_id,'staff','up',           true,  1),
    (_event_id,'staff','down',         true,  1),
    (_event_id,'staff','super_up',     true,  5),
    (_event_id,'staff','super_down',   false, 0),
    (_event_id,'dj','up',              true, 10),
    (_event_id,'dj','down',            true, 10),
    (_event_id,'dj','super_up',        true, 20),
    (_event_id,'dj','super_down',      true, 20);
END $fn$;

-- Los eventos que YA existen conservan su matriz: esta función sólo corre al
-- crear un evento o al tocar «Restablecer a valores por defecto» en el panel.
-- Para que un evento viejo tome los pesos nuevos hay que apretar ese botón.


-- ── 4. Decisión pendiente, a propósito fuera de esta migración ──────────────
-- `pantalla__active_count` excluye a 'staff' del padrón que calcula el umbral
-- del kick. ¿El 'dj' también debería quedar afuera?
--
-- Argumento a favor: es operador, no público, y contarlo sube el umbral que el
-- público real tiene que alcanzar para voltear un tema.
-- Argumento en contra: cambia la matemática del kick de todos los eventos.
--
-- No se toca acá porque es una decisión de producto, no de paridad de esquema.
-- Si se decide excluirlo, es agregar `AND p.role <> 'dj'` a esa función.
-- ============================================================================


-- ── 5. Imágenes del Tomatazo ────────────────────────────────────────────────
-- Se buscaron nombres ya existentes antes de crear estos: en `pantalla_events`
-- no hay ninguna columna de assets del kick (las únicas de imagen son
-- `logo_url` y `background_image_url`, que son del branding del evento y no se
-- pueden reutilizar sin pisar la personalización visual). Tampoco hay filas de
-- `pantalla_gifs` con un `kind` que sirva: su CHECK sólo admite 'prize' y
-- 'transition'. Así que son columnas nuevas, y son sólo tres.
--
-- Van en NULL a propósito: NULL significa «usá el dibujo por defecto de la TV»,
-- que es distinto de una cadena vacía. El panel guarda NULL cuando se quita.
ALTER TABLE public.pantalla_events
  ADD COLUMN IF NOT EXISTS kick_tomato_flying_url   text,
  ADD COLUMN IF NOT EXISTS kick_tomato_exploded_url text,
  ADD COLUMN IF NOT EXISTS kick_tomato_splat_url    text;

COMMENT ON COLUMN public.pantalla_events.kick_tomato_flying_url IS
  'Tomate cruzando la pantalla en cada voto de Sacar Tema. NULL = dibujo por defecto de la TV.';
COMMENT ON COLUMN public.pantalla_events.kick_tomato_exploded_url IS
  'Tomate en el instante del impacto. NULL = dibujo por defecto de la TV.';
COMMENT ON COLUMN public.pantalla_events.kick_tomato_splat_url IS
  'Mancha que queda pegada tras el impacto. NULL = dibujo por defecto de la TV.';


-- ── 6. Contrato del impacto — qué necesita la TV para dibujar el Tomatazo ───
--
-- El Tomatazo NO es una imagen fija: cada voto nuevo tiene que disparar UN
-- impacto, y cuanto más cerca está la votación del umbral, más al centro pega.
-- La física la resuelve la TV; lo que el servidor tiene que garantizar es que
-- cada voto sea un evento discreto y ordenado, porque `pantalla_kick_votes` es
-- un conjunto: mirar su tamaño no dice CUÁNDO entró cada voto ni permite
-- distinguir un voto nuevo de una recarga de página.
--
-- `pantalla_get_kick_status` ya devuelve `votes` y `needed`. Lo que falta es el
-- número de orden del voto dentro de la votación de ESTE tema, que es lo que
-- convierte «hay 7 votos» en «este es el 7.º impacto».
--
--   progreso = votes / needed          → 0 … 1
--   radio    = (1 - progreso) * R_max   → lejos del centro al principio,
--                                          encima del centro al final
--
-- Con `vote_index` la TV puede sembrar el ángulo de forma determinista, así que
-- dos pantallas del mismo evento dibujan el mismo tomate en el mismo lugar.
--
-- Esta versión es un SUPERCONJUNTO ESTRICTO de la que hoy está en la base: se
-- copió su cuerpo tal cual —incluidos `threshold_pct` y el `RETURN {enabled:
-- false}` cuando el evento no existe, que NO es una excepción— y se le
-- agregaron cuatro claves al final. Ningún consumidor actual se entera.
CREATE OR REPLACE FUNCTION public.pantalla_get_kick_status(_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_ev     pantalla_events%ROWTYPE;
  v_votes  integer;
  v_active integer;
  v_needed integer;
  v_voted  boolean;
  v_idx    integer;
  v_mine   timestamptz;
BEGIN
  SELECT * INTO v_ev FROM pantalla_events WHERE id = _event_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('enabled', false); END IF;

  SELECT COUNT(*)::int INTO v_votes FROM pantalla_kick_votes
   WHERE event_id = _event_id AND item_id = v_ev.current_item_id;

  v_active := public.pantalla__active_count(_event_id);
  v_needed := GREATEST(1, CEIL(v_active * v_ev.kick_threshold_pct / 100.0)::int);

  SELECT created_at INTO v_mine FROM pantalla_kick_votes
   WHERE event_id = _event_id AND item_id = v_ev.current_item_id
     AND user_id = auth.uid();
  v_voted := v_mine IS NOT NULL;

  -- Orden del voto PROPIO dentro de esta votación (1 = fue el primero): es lo
  -- que convierte «hay 7 votos» en «este es el 7.º impacto». NULL si todavía no
  -- votó, porque en ese caso no hay ningún impacto suyo que dibujar.
  IF v_voted THEN
    SELECT COUNT(*)::int INTO v_idx FROM pantalla_kick_votes
     WHERE event_id = _event_id AND item_id = v_ev.current_item_id
       AND created_at <= v_mine;
  END IF;

  RETURN jsonb_build_object(
    -- ── Claves existentes, sin cambios ──────────────────────────────────
    'enabled',       v_ev.kick_enabled,
    'item_id',       v_ev.current_item_id,
    'votes',         v_votes,
    'active',        v_active,
    'needed',        v_needed,
    'threshold_pct', v_ev.kick_threshold_pct,
    'voted',         COALESCE(v_voted, false),
    'button_text',   v_ev.kick_button_text,
    -- ── Contrato visual nuevo. El cliente clásico las ignora ────────────
    'style',         COALESCE(v_ev.kick_style, 'classic'),
    'vote_index',    v_idx,
    'progress',      LEAST(1.0, v_votes::numeric / GREATEST(v_needed, 1)),
    'assets',        jsonb_build_object(
                       'flying',   v_ev.kick_tomato_flying_url,
                       'exploded', v_ev.kick_tomato_exploded_url,
                       'splat',    v_ev.kick_tomato_splat_url)
  );
END $fn$;

-- OJO al aplicar: este CREATE OR REPLACE reescribe `pantalla_get_kick_status`.
-- El cuerpo se copió de la función viva el 2026-09-09; si alguien la tocó desde
-- entonces, comparar antes de correr.
