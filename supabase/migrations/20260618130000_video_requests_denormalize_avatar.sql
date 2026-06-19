-- ============================================================================
-- video_requests: denormalizar avatar (snapshot al crear el pedido)
-- Igual que messages, para que PantallaGigante muestre el avatar real del
-- solicitante sin depender de avatar_id (que puede ser null o de otro catálogo).
-- No se hace backfill: los pedidos existentes quedan en null → fallback 🎵.
-- ============================================================================
ALTER TABLE video_requests
  ADD COLUMN IF NOT EXISTS avatar_emoji TEXT,
  ADD COLUMN IF NOT EXISTS photo_url    TEXT;
