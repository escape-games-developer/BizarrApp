-- ============================================================================
-- messages.status: agregar 'archived'
-- "Último mensaje gana": al aprobar un mensaje, los approved anteriores pasan
-- a 'archived' (quedan fuera de la pantalla y de la lista del admin, pero no
-- se mezclan con 'rejected' de moderación).
-- ============================================================================
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_status_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'archived'));
