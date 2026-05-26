-- ============================================================================
-- BizarrApp — Schema Supabase
-- Ejecutar en el SQL Editor de Supabase en este orden
-- ============================================================================

-- ── Extensiones necesarias ───────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================================
-- TABLA: profiles
-- Un perfil por usuario registrado. Se crea automáticamente al hacer signUp.
-- ============================================================================
CREATE TABLE profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  team         text        CHECK (team IN ('batata', 'membrillo')),
  phone        text,
  avatar_id    text,
  avatar_emoji text,
  photo_url    text,
  geo_ok       boolean     DEFAULT false,
  registered   boolean     DEFAULT false,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: cada usuario solo lee/escribe su propio perfil
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: leer propio"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: escribir propio"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: actualizar propio"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- El admin puede leer todos los perfiles (para el sorteo)
CREATE POLICY "profiles: admin lee todos"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );


-- ============================================================================
-- TABLA: admin_users
-- Usuarios con acceso al Admin Panel
-- ============================================================================
CREATE TABLE admin_users (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Solo los admins pueden leer esta tabla
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_users: solo admins"
  ON admin_users FOR SELECT
  USING (auth.uid() = user_id);


-- ============================================================================
-- TABLA: sessions
-- Una sesión = una noche en el bar.
-- El admin crea una sesión al inicio de la noche y la cierra al final.
-- ============================================================================
CREATE TABLE sessions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date       date        NOT NULL DEFAULT CURRENT_DATE,
  label      text,                          -- ej: "Viernes 23/05"
  is_active  boolean     NOT NULL DEFAULT true,
  created_by uuid        REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  closed_at  timestamptz
);

-- Solo hay una sesión activa a la vez
CREATE UNIQUE INDEX sessions_one_active
  ON sessions (is_active)
  WHERE is_active = true;

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions: todos pueden leer activa"
  ON sessions FOR SELECT
  USING (is_active = true);

CREATE POLICY "sessions: admin puede crear"
  ON sessions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

CREATE POLICY "sessions: admin puede actualizar"
  ON sessions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));


-- ============================================================================
-- TABLA: connected_users
-- Usuarios presentes en la sesión activa (verificados con geo).
-- Se inserta al hacer check-in y se actualiza con heartbeat.
-- ============================================================================
CREATE TABLE connected_users (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  team         text        CHECK (team IN ('batata', 'membrillo')),
  avatar_id    text,
  avatar_emoji text,
  photo_url    text,
  excluded_raffle boolean  DEFAULT false,  -- ganadores excluidos de sorteos
  last_seen    timestamptz DEFAULT now(),
  joined_at    timestamptz DEFAULT now(),
  UNIQUE (session_id, user_id)
);

-- Index para el random() del sorteo
CREATE INDEX connected_users_session ON connected_users(session_id);
CREATE INDEX connected_users_raffle  ON connected_users(session_id, excluded_raffle);

ALTER TABLE connected_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "connected_users: todos pueden leer"
  ON connected_users FOR SELECT
  USING (true);

CREATE POLICY "connected_users: usuario inserta propio"
  ON connected_users FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "connected_users: usuario actualiza propio"
  ON connected_users FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "connected_users: admin actualiza todos"
  ON connected_users FOR UPDATE
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));


-- ============================================================================
-- TABLA: game_state
-- Estado global de la noche. Una sola fila por sesión.
-- Todos los dispositivos escuchan cambios en esta tabla via Realtime.
-- ============================================================================
CREATE TABLE game_state (
  session_id        uuid        PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,

  -- Módulo 3: Juegos
  active_game       text        CHECK (active_game IN (
                                  'rey del orto','suma','palabra','trivia', NULL
                                )),

  -- Módulo 4: Escenario
  active_escenario  text        CHECK (active_escenario IN (
                                  'duelo','ftl','pt','karaoke', NULL
                                )),

  -- Placas y zócalo
  active_placa      text,       -- placa activa en pantalla gigante
  placa_custom      jsonb,      -- datos de placa personalizada {emoji,title,subtitle}
  zocalo_active     boolean     DEFAULT false,  -- zócalo de mensajes on/off

  -- Rey del Orto
  raffle_state      text        NOT NULL DEFAULT 'idle'
                                CHECK (raffle_state IN ('idle','launched','winner')),
  raffle_winner_id  uuid        REFERENCES auth.users(id),
  raffle_winner_name text,
  raffle_prize      text        DEFAULT 'Consumición libre para dos',

  -- Desafío Demente
  trivia_state      text        NOT NULL DEFAULT 'idle'
                                CHECK (trivia_state IN ('idle','active','revealed','finished')),
  trivia_question   integer     DEFAULT 0,  -- índice de la pregunta actual (0-9)
  trivia_coupon     text        DEFAULT 'BEER50',
  trivia_winner_team text       CHECK (trivia_winner_team IN ('batata','membrillo', NULL)),

  -- Duelo de Talentos
  duelo_state       text        NOT NULL DEFAULT 'idle'
                                CHECK (duelo_state IN ('idle','voting','revealed')),
  duelo_votes_a     integer     DEFAULT 0,
  duelo_votes_b     integer     DEFAULT 0,

  updated_at        timestamptz DEFAULT now()
);

CREATE TRIGGER game_state_updated_at
  BEFORE UPDATE ON game_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_state: todos pueden leer"
  ON game_state FOR SELECT USING (true);

CREATE POLICY "game_state: solo admin escribe"
  ON game_state FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));


-- ============================================================================
-- TABLA: trivia_votes
-- Un voto por usuario por pregunta. El UNIQUE previene doble voto.
-- ============================================================================
CREATE TABLE trivia_votes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_idx integer     NOT NULL CHECK (question_idx BETWEEN 0 AND 9),
  user_id      uuid        NOT NULL REFERENCES auth.users(id),
  team         text        NOT NULL CHECK (team IN ('batata','membrillo')),
  option_idx   integer     NOT NULL CHECK (option_idx BETWEEN 0 AND 3),
  created_at   timestamptz DEFAULT now(),
  UNIQUE (session_id, question_idx, user_id)  -- un voto por pregunta por usuario
);

CREATE INDEX trivia_votes_session_q ON trivia_votes(session_id, question_idx);

ALTER TABLE trivia_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trivia_votes: usuario inserta propio"
  ON trivia_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "trivia_votes: todos pueden leer totales"
  ON trivia_votes FOR SELECT USING (true);


-- ============================================================================
-- VISTA: trivia_totals
-- Totales agregados por pregunta. El admin y la pantalla gigante la consultan.
-- NO hace falta calcular porcentajes en el cliente.
-- ============================================================================
CREATE VIEW trivia_totals AS
SELECT
  session_id,
  question_idx,
  COUNT(*) FILTER (WHERE team = 'batata')     AS batata_votes,
  COUNT(*) FILTER (WHERE team = 'membrillo')  AS membrillo_votes,
  COUNT(*) FILTER (WHERE option_idx = 0)      AS opt_0,
  COUNT(*) FILTER (WHERE option_idx = 1)      AS opt_1,
  COUNT(*) FILTER (WHERE option_idx = 2)      AS opt_2,
  COUNT(*) FILTER (WHERE option_idx = 3)      AS opt_3,
  COUNT(*)                                    AS total_votes
FROM trivia_votes
GROUP BY session_id, question_idx;


-- ============================================================================
-- TABLA: messages
-- Mensajes del público a la pantalla gigante.
-- ============================================================================
CREATE TABLE messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id),
  user_name    text        NOT NULL,
  avatar_id    text,
  avatar_emoji text,
  photo_url    text,
  text         text        NOT NULL CHECK (char_length(text) <= 100),
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','approved','rejected')),
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX messages_session_status ON messages(session_id, status);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages: usuario inserta propio"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "messages: usuario lee propios"
  ON messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "messages: admin lee y actualiza todos"
  ON messages FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

CREATE POLICY "messages: pantalla lee aprobados"
  ON messages FOR SELECT
  USING (status = 'approved');


-- ============================================================================
-- TABLA: video_requests
-- Pedidos de videoclips del público.
-- ============================================================================
CREATE TABLE video_requests (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id),
  user_name    text        NOT NULL,
  avatar_id    text,
  yt_id        text        NOT NULL,
  title        text        NOT NULL,
  artist       text,
  type         text        NOT NULL DEFAULT 'video'
                           CHECK (type IN ('video','karaoke')),
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','launched','dismissed')),
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE video_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_requests: usuario inserta"
  ON video_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "video_requests: usuario lee propio"
  ON video_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "video_requests: admin gestiona todos"
  ON video_requests FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));


-- ============================================================================
-- TABLA: banners
-- Novedades y promos del admin.
-- ============================================================================
CREATE TABLE banners (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid        REFERENCES sessions(id) ON DELETE CASCADE,
  emoji      text,
  title      text        NOT NULL,
  body       text,
  tag        text        DEFAULT 'NOVEDAD',
  color      text        DEFAULT '#FFD700',
  bg         text        DEFAULT 'rgba(255,215,0,.07)',
  border     text        DEFAULT 'rgba(255,215,0,.18)',
  visible    boolean     DEFAULT true,
  sort_order integer     DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "banners: todos leen visibles"
  ON banners FOR SELECT
  USING (visible = true);

CREATE POLICY "banners: admin gestiona todos"
  ON banners FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));


-- ============================================================================
-- TABLA: escenario_queue
-- Cola de inscriptos para todos los juegos de escenario.
-- Flujo: invited → accepted → selected → active | done
-- Para Duelo: dos participantes con selected a la vez.
-- Para FTL/PT/Karaoke: un participante active a la vez.
-- ============================================================================
CREATE TABLE escenario_queue (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type         text        NOT NULL CHECK (type IN (
                             'duelo','ftl','pt','karaoke'
                           )),
  user_id      uuid        NOT NULL REFERENCES auth.users(id),
  user_name    text        NOT NULL,
  user_avatar  text,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN (
                             'pending',    -- aceptó la invitación, espera al admin
                             'selected',   -- admin lo eligió (duelo: dos a la vez)
                             'active',     -- está en el escenario ahora
                             'done',       -- terminó su turno
                             'dismissed'   -- admin lo descartó
                           )),
  -- Para duelo: posición 1 o 2
  duelo_slot   int         CHECK (duelo_slot IN (1, 2)),
  -- Video elegido (FTL, PT, karaoke)
  selected_ytid text,
  selected_title text,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  started_at   timestamptz,
  finished_at  timestamptz,
  UNIQUE (session_id, user_id, type)  -- un usuario por tipo por sesión
);

ALTER TABLE escenario_queue ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede ver la cola de su sesión
CREATE POLICY "escenario_queue: lectura autenticados"
  ON escenario_queue FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- El usuario se inscribe a sí mismo
CREATE POLICY "escenario_queue: usuario se inscribe"
  ON escenario_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- El admin actualiza el status (selected, active, done, dismissed)
CREATE POLICY "escenario_queue: admin actualiza"
  ON escenario_queue FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
    OR auth.uid() = user_id
  );

ALTER PUBLICATION supabase_realtime ADD TABLE escenario_queue;

-- ============================================================================
-- TABLA: menu_items
-- Menú del bar editable desde el Admin Panel.
-- Control total: categorías, items, precios, fotos, disponibilidad.
-- ============================================================================
CREATE TABLE menu_items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     text        NOT NULL DEFAULT 'bizarren',
  category     text        NOT NULL,        -- 'Tragos' | 'Cervezas' | 'Shots' | etc.
  category_order int       NOT NULL DEFAULT 0,
  name         text        NOT NULL,
  description  text,
  price        numeric(10,2) NOT NULL,
  photo_url    text,
  available    boolean     NOT NULL DEFAULT true,
  item_order   int         NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Todos pueden leer el menú
CREATE POLICY "menu_items: lectura pública"
  ON menu_items FOR SELECT USING (true);

-- Solo admin puede modificar
CREATE POLICY "menu_items: admin escribe"
  ON menu_items FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER menu_items_updated_at
  BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Datos iniciales de ejemplo (reemplazar con el menú real del bar)
INSERT INTO menu_items (category, category_order, name, description, price, item_order) VALUES
  ('Tragos',   1, 'Campari Spritz',    'Campari, soda, rodaja de naranja',         1800, 1),
  ('Tragos',   1, 'Aperol Spritz',     'Aperol, prosecco, soda',                   1900, 2),
  ('Tragos',   1, 'Gin Tonic',         'Gin artesanal, tónica, pepino',            2000, 3),
  ('Tragos',   1, 'Negroni',           'Gin, Campari, vermut rojo',                2100, 4),
  ('Cervezas', 2, 'Pinta artesanal',   'Selección del barman',                     1600, 1),
  ('Cervezas', 2, 'Media pinta',       'Selección del barman',                     1000, 2),
  ('Shots',    3, 'Shot de Fernet',    'Fernet con cola',                           800, 1),
  ('Shots',    3, 'Shot de tequila',   'Con sal y limón',                           900, 2),
  ('Sin alcohol',4,'Agua mineral',     '500ml',                                     600, 1),
  ('Sin alcohol',4,'Gaseosa',          'Coca Cola, 7UP, Sprite',                    700, 2),
  ('Para comer',5,'Tabla de quesos',   'Quesos seleccionados, frutos secos, miel', 3200, 1),
  ('Para comer',5,'Bruschetas',        'Con tomate cherry y albahaca',             2200, 2);

-- ============================================================================
-- ENABLE REALTIME
-- Habilitar Realtime en las tablas que los clientes escuchan.
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE trivia_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE connected_users;
ALTER PUBLICATION supabase_realtime ADD TABLE banners;
ALTER PUBLICATION supabase_realtime ADD TABLE escenario_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE video_requests;


-- ============================================================================
-- FUNCIÓN HELPER: is_admin()
-- Usada en policies para verificar si el usuario es admin.
-- ============================================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;


-- ============================================================================
-- SEED: crear sesión activa de ejemplo
-- Ejecutar manualmente al inicio de cada noche (o hacerlo desde el admin panel)
-- ============================================================================
-- INSERT INTO sessions (label) VALUES ('Viernes 23/05 — Noche de apertura');
-- INSERT INTO game_state (session_id) VALUES ('<id de la sesión creada>');

-- ============================================================================
-- CUPONES
-- Se crean al terminar un juego (Rey del Orto, Trivia).
-- Válidos 30 minutos. PIN de canje: 851 (hardcodeado en el cliente).
-- ============================================================================
CREATE TABLE coupons (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id),
  user_name     text        NOT NULL,
  game_type     text        NOT NULL,  -- 'rey_del_orto' | 'trivia' | futuro
  prize_text    text        NOT NULL,  -- texto libre definido por el admin
  status        text        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','redeemed','expired')),
  issued_at     timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,  -- issued_at + 30 minutos
  redeemed_at   timestamptz,
  redeemed_by   text,
  UNIQUE (session_id, user_id, game_type)
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coupons: usuario lee propio"
  ON coupons FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "coupons: usuario actualiza propio"
  ON coupons FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "coupons: sistema inserta"
  ON coupons FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE coupons;

