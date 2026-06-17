-- Fix RLS: acceso al propio perfil para usuarios autenticados
--
-- SELECT e INSERT del propio row en public.profiles (auth.uid() = id).
-- Complementa las policies existentes ("profiles: leer/escribir propio").
--
-- Aplicado originalmente vía dashboard de Supabase. Idempotente.

alter table public.profiles enable row level security;

drop policy if exists "users_select_own_profile" on public.profiles;
create policy "users_select_own_profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "users_insert_own_profile" on public.profiles;
create policy "users_insert_own_profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);
