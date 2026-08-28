-- ============================================================================
-- Registro con confirmación de email: el perfil se crea del lado del servidor
-- ============================================================================
--
-- Problema que resuelve:
--
-- Con "Confirm email" activado, signUp() no devuelve sesión. Sin sesión el
-- INSERT en public.profiles cae por RLS (auth.uid() es null), así que el
-- cliente escribía el perfil solo cuando la confirmación estaba desactivada.
--
-- Solución: el cliente manda el perfil en `options.data` del signUp (queda en
-- auth.users.raw_user_meta_data) y este trigger, que corre como SECURITY
-- DEFINER y por lo tanto ignora RLS, crea la fila de profiles en el mismo
-- momento en que nace el usuario.
--
-- El perfil nace con registered = false: la cuenta existe pero todavía no está
-- validada. El segundo trigger (on_auth_user_confirmed) lo pasa a true cuando
-- el cliente toca el link del mail. Ver la nota al final.
--
-- photo_url no viaja en la metadata a propósito: es un data-URI en base64 y la
-- metadata se embebe en el JWT de cada request. La app la completa después
-- desde el localStorage del dispositivo donde se registró (hydrateProfile).

-- ── Trigger 1: crear el perfil al nacer el usuario ───────────────────────────
-- Reemplaza el trigger existente. NO rompe el alta si algo falla.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, name, team, phone, avatar_id, avatar_emoji,
    registered, geo_ok, created_at, updated_at
  ) values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1)),
    nullif(new.raw_user_meta_data->>'team',''),
    nullif(new.raw_user_meta_data->>'phone',''),
    nullif(new.raw_user_meta_data->>'avatar_id',''),
    nullif(new.raw_user_meta_data->>'avatar_emoji',''),
    false, false, now(), now()
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  raise warning 'handle_new_user fallo para %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── Trigger 2: validar el perfil cuando confirma el mail ─────────────────────
--
-- Sin esto el circuito queda cortado a la mitad: el trigger de alta crea el
-- perfil con registered = false, y la app usa ese campo como "está registrado"
-- (isLoggedIn = !!user.registered). El cliente confirmaba el mail y la app lo
-- seguía tratando como no registrado — le mostraba la pantalla de login otra
-- vez, en un loop del que no se sale.
--
-- Va en la base y no solo en el cliente porque el cliente puede no pasar nunca
-- por el callback: confirmar el mail en la compu y volver a la app desde el
-- celular es el caso normal en el bar.

create or replace function public.handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set registered = true,
         updated_at = now()
   where id = new.id
     and registered is distinct from true;
  return new;
exception when others then
  raise warning 'handle_user_confirmed fallo para %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_user_confirmed();


-- ── Backfill: usuarios sin fila en profiles ──────────────────────────────────
-- Idempotente. Hoy no toca nada (no hay huérfanos); queda como red por si un
-- alta futura falla dentro del bloque `exception` del trigger.

insert into public.profiles (id, name, team, phone, avatar_id, avatar_emoji, geo_ok, registered)
select
  u.id,
  coalesce(
    nullif(btrim(coalesce(u.raw_user_meta_data->>'name', '')), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Invitado'
  ),
  case
    when u.raw_user_meta_data->>'team' in ('batata', 'membrillo')
      then u.raw_user_meta_data->>'team'
    else null
  end,
  nullif(btrim(coalesce(u.raw_user_meta_data->>'phone', '')),        ''),
  nullif(btrim(coalesce(u.raw_user_meta_data->>'avatar_id', '')),    ''),
  nullif(btrim(coalesce(u.raw_user_meta_data->>'avatar_emoji', '')), ''),
  false,
  u.email_confirmed_at is not null
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;


-- ── Higiene de RLS: policies duplicadas + WITH CHECK explícito ───────────────
-- No es un agujero (Postgres reusa USING como check cuando falta WITH CHECK),
-- pero dejarlo escrito evita que se lea como un descuido en la próxima revisión.

drop policy if exists "users_insert_own_profile" on public.profiles;
drop policy if exists "users_select_own_profile" on public.profiles;

drop policy if exists "profiles: actualizar propio" on public.profiles;
create policy "profiles: actualizar propio" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
