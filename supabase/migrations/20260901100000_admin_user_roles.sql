-- Roles internos del panel de administración.
-- Los administradores existentes conservan acceso completo.
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'general_admin';

ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('general_admin', 'operator'));

COMMENT ON COLUMN public.admin_users.role IS
  'general_admin ve y administra Usuarios; operator opera el panel sin acceso a esa sección.';
