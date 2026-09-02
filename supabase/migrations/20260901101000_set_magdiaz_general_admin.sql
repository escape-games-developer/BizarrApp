-- Cuenta principal de administración de BizarrApp.
-- Es idempotente: puede ejecutarse más de una vez sin duplicar la fila.
INSERT INTO public.admin_users (user_id, role)
SELECT id, 'general_admin'
FROM auth.users
WHERE lower(email) = 'magdiaz42@gmail.com'
ON CONFLICT (user_id) DO UPDATE
SET role = EXCLUDED.role;

