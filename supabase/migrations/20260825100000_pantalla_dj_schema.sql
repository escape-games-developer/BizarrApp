-- ============================================================================
-- MÓDULO PANTALLA/ESCENARIO — Votación musical en vivo
--
-- Réplica funcional del sistema DJ Democracy dentro de BizarrApp, sobre
-- nuestro propio Supabase, nuestro Auth y nuestro código.
--
-- Namespace `pantalla_*`: BizarrApp YA TIENE una tabla `playlist_items`
-- (playlists internas del bar), así que los nombres del sistema original
-- colisionarían. Todo el módulo vive bajo el prefijo.
--
-- Cuatro superficies sobre el mismo event_id:
--   CLIENTE (tab en Pantalla) · ADMIN · DJ · TV (motor de reproducción)
--
-- Modelo: curaduría + votación sobre ventana de candidatos.
--   PLAYLIST COMPLETA → N CANDIDATOS → VOTACIÓN → GANADOR → ACTUAL → REFILL
-- El cliente NO pide ni busca canciones: sólo vota lo que el admin curó.
-- ============================================================================


-- ── EVENTO ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pantalla_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Opcional: cuelga el evento de la noche activa de BizarrApp.
  session_id   uuid REFERENCES sessions(id) ON DELETE SET NULL,
  owner_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  name         text NOT NULL,
  code         text NOT NULL UNIQUE,      -- 6 chars, para el QR del cliente
  status       text NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','live','ended')),

  -- Reproducción (la escribe el DJ/advance; la TV la ejecuta)
  current_item_id    uuid,                -- FK añadida abajo (referencia circular)
  current_started_at timestamptz,
  is_playing         boolean NOT NULL DEFAULT false,

  -- Votación
  voting_mode     text    NOT NULL DEFAULT 'best'
                    CHECK (voting_mode IN ('best','rank')),
  voting_frozen   boolean NOT NULL DEFAULT false,
  voting_disabled boolean NOT NULL DEFAULT false,
  frozen_ranking  jsonb,                  -- snapshot de ids al congelar

  -- Ventana de candidatos
  active_candidates_count     integer NOT NULL DEFAULT 10
                                CHECK (active_candidates_count BETWEEN 3 AND 15),
  relegation_rounds_threshold integer NOT NULL DEFAULT 3
                                CHECK (relegation_rounds_threshold BETWEEN 1 AND 10),
  reject_score_threshold      integer NOT NULL DEFAULT -5,

  super_votes_per_user integer NOT NULL DEFAULT 1 CHECK (super_votes_per_user >= 0),

  -- Kick colectivo ("Voltear este tema")
  kick_enabled          boolean NOT NULL DEFAULT true,
  kick_threshold_pct    integer NOT NULL DEFAULT 51 CHECK (kick_threshold_pct BETWEEN 1 AND 100),
  kick_activity_minutes integer NOT NULL DEFAULT 45 CHECK (kick_activity_minutes > 0),
  kick_button_text      text    NOT NULL DEFAULT 'Voltear este tema',

  content_mode text NOT NULL DEFAULT 'video' CHECK (content_mode IN ('video','audio')),

  -- Telemetría que reporta la TV (única salida de audio)
  tv_current_time numeric,
  tv_duration     numeric,
  tv_connected_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at   timestamptz
);

COMMENT ON TABLE pantalla_events IS 'Evento de Pantalla/Escenario. Hilo compartido por Cliente, Admin, DJ y TV.';

-- Un solo evento en vivo por vez: las cuatro superficies deben coincidir sin
-- ambigüedad sobre cuál es "el evento".
CREATE UNIQUE INDEX IF NOT EXISTS pantalla_events_single_live_idx
  ON pantalla_events ((status)) WHERE status = 'live';

CREATE INDEX IF NOT EXISTS pantalla_events_session_idx ON pantalla_events (session_id);


-- ── SECRETOS DEL EVENTO ─────────────────────────────────────────────────────
-- Tabla aparte a propósito. En DJ Democracy el `tv_access_token` vive en
-- `events` y CUALQUIER anónimo lo lee por REST (hallazgo C de la auditoría).
-- Acá el token nunca sale por PostgREST: sólo por RPC validada.
CREATE TABLE IF NOT EXISTS pantalla_event_secrets (
  event_id        uuid PRIMARY KEY REFERENCES pantalla_events(id) ON DELETE CASCADE,
  tv_access_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  rotated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE pantalla_event_secrets IS 'Token de acceso de la TV. Sólo accesible por RPC/admin, nunca por REST público.';


-- ── PLAYLIST / CANDIDATOS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pantalla_playlist_items (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES pantalla_events(id) ON DELETE CASCADE,

  title      text NOT NULL,
  artist     text,
  album      text,
  cover_url  text,

  source_type      text DEFAULT 'youtube' CHECK (source_type IN ('youtube','audio')),
  youtube_id       text,
  audio_path       text,
  duration_seconds integer,

  position integer NOT NULL DEFAULT 0,

  enabled  boolean NOT NULL DEFAULT true,
  locked   boolean NOT NULL DEFAULT false,   -- no se relega ni se saca
  pinned   boolean NOT NULL DEFAULT false,   -- entra siempre a la ventana

  is_active_candidate boolean NOT NULL DEFAULT false,

  -- Agregados denormalizados: los mantiene el servidor, nunca el cliente.
  pos_votes integer NOT NULL DEFAULT 0,
  neg_votes integer NOT NULL DEFAULT 0,
  score     integer NOT NULL DEFAULT 0,

  times_played integer NOT NULL DEFAULT 0,

  last_status            text DEFAULT 'idle'
                           CHECK (last_status IN ('idle','active','played_recently','rejected')),
  last_status_changed_at timestamptz NOT NULL DEFAULT now(),
  consecutive_last_place_rounds integer NOT NULL DEFAULT 0,

  hot_until timestamptz,                     -- boost temporal tras un super voto

  trim_start_seconds integer DEFAULT 0,
  trim_end_seconds   integer,
  youtube_volume     integer DEFAULT 100 CHECK (youtube_volume BETWEEN 0 AND 100),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pantalla_items_event_idx      ON pantalla_playlist_items (event_id, position);
CREATE INDEX IF NOT EXISTS pantalla_items_candidates_idx ON pantalla_playlist_items (event_id, is_active_candidate, score DESC);
CREATE INDEX IF NOT EXISTS pantalla_items_youtube_idx    ON pantalla_playlist_items (event_id, youtube_id);

-- Referencia circular: el evento apunta a la canción actual.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pantalla_events_current_item_fkey') THEN
    ALTER TABLE pantalla_events
      ADD CONSTRAINT pantalla_events_current_item_fkey
      FOREIGN KEY (current_item_id) REFERENCES pantalla_playlist_items(id) ON DELETE SET NULL;
  END IF;
END $$;


-- ── PARTICIPANTES ───────────────────────────────────────────────────────────
-- No duplica email/teléfono: eso ya vive en `profiles`. Sólo lo específico
-- del evento. La identidad es el usuario REAL de BizarrApp (auth.users).
CREATE TABLE IF NOT EXISTS pantalla_participants (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES pantalla_events(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Los roles especiales SÓLO los asigna un admin/DJ. No hay auto-asignación
  -- (hallazgo A de la auditoría: en DJ Democracy un invitado se hace VIP solo).
  role text NOT NULL DEFAULT 'guest' CHECK (role IN ('guest','vip','birthday','staff')),

  super_votes_used  integer NOT NULL DEFAULT 0,
  extra_super_votes integer NOT NULL DEFAULT 0,

  joined_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS pantalla_participants_active_idx
  ON pantalla_participants (event_id, last_seen_at DESC);


-- ── VOTOS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pantalla_votes (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES pantalla_events(id) ON DELETE CASCADE,
  item_id  uuid NOT NULL REFERENCES pantalla_playlist_items(id) ON DELETE CASCADE,
  -- Identidad = usuario autenticado de BizarrApp, no una sesión anónima
  -- descartable. Limpiar localStorage no genera una identidad nueva.
  user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  vote_type text NOT NULL CHECK (vote_type IN ('up','down','super_up','super_down')),
  weight    integer NOT NULL DEFAULT 1,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- El servidor no puede duplicar aunque el frontend insista.
  UNIQUE (event_id, item_id, user_id, vote_type)
);

CREATE INDEX IF NOT EXISTS pantalla_votes_item_idx ON pantalla_votes (item_id, vote_type);
CREATE INDEX IF NOT EXISTS pantalla_votes_user_idx ON pantalla_votes (event_id, user_id);


-- ── PODERES DE VOTO POR ROL ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pantalla_vote_powers (
  event_id   uuid NOT NULL REFERENCES pantalla_events(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('guest','vip','birthday','staff')),
  vote_type  text NOT NULL CHECK (vote_type IN ('up','down','super_up','super_down')),
  enabled    boolean NOT NULL DEFAULT false,
  value      integer NOT NULL DEFAULT 1 CHECK (value >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, role, vote_type)
);

COMMENT ON TABLE pantalla_vote_powers IS 'Matriz rol × tipo de voto: habilitación y peso. Si está apagado, el servidor rechaza el voto.';


-- ── KICK COLECTIVO ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pantalla_kick_votes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES pantalla_events(id) ON DELETE CASCADE,
  item_id    uuid NOT NULL REFERENCES pantalla_playlist_items(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, item_id, user_id)
);


-- ── REACCIONES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pantalla_reactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES pantalla_events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      text NOT NULL,
  is_giant   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pantalla_reactions_event_idx ON pantalla_reactions (event_id, created_at DESC);


-- ── HISTORIAL ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pantalla_play_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES pantalla_events(id) ON DELETE CASCADE,
  item_id     uuid REFERENCES pantalla_playlist_items(id) ON DELETE SET NULL,
  title       text,
  artist      text,
  cover_url   text,
  final_score integer,
  pos_votes   integer,
  neg_votes   integer,
  ended_reason text CHECK (ended_reason IN ('advance','kick','manual','skip')),
  played_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pantalla_history_event_idx ON pantalla_play_history (event_id, played_at DESC);


-- ── updated_at ──────────────────────────────────────────────────────────────
-- `update_updated_at()` ya existe en el proyecto; se reutiliza.
DROP TRIGGER IF EXISTS pantalla_events_touch ON pantalla_events;
CREATE TRIGGER pantalla_events_touch BEFORE UPDATE ON pantalla_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS pantalla_items_touch ON pantalla_playlist_items;
CREATE TRIGGER pantalla_items_touch BEFORE UPDATE ON pantalla_playlist_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
