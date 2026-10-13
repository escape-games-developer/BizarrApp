-- ─── Usuarios: verificación de mail, última conexión y baja ──────────────────
--
-- Completa 20261013150000_admin_roles_y_secciones:
--   - admin_list_staff / admin_list_clients suman `email_confirmed` (el usuario
--     validó el mail: confirmó el registro o aceptó la invitación) y
--     `last_seen` (última conexión: el último login o el último heartbeat de
--     presencia en connected_users, lo que sea más reciente).
--   - admin_delete_user borra una cuenta (auth.users → cascada al perfil y a
--     todo lo que cuelga del usuario).
--   - admin_find_user_by_email: sólo service_role, para la Edge Function
--     admin-create-user (detectar cuentas existentes al dar de alta staff).
--
-- Las altas (con mail de invitación) las hace la Edge Function
-- supabase/functions/admin-create-user: necesitan la API de administración
-- de Auth, que no se puede llamar desde SQL.

-- Cambia el tipo de retorno: hay que borrarlas antes de recrearlas.
drop function if exists public.admin_list_staff();
drop function if exists public.admin_list_clients();

create or replace function public.admin_list_staff()
returns table (
  user_id         uuid,
  name            text,
  email           text,
  role            text,
  sections        text[],
  created_at      timestamptz,
  email_confirmed boolean,
  last_seen       timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if not public.is_full_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select a.user_id, p.name, u.email::text, a.role, a.sections, a.created_at,
           u.email_confirmed_at is not null,
           greatest(u.last_sign_in_at,
                    (select max(c.last_seen) from public.connected_users c where c.user_id = a.user_id))
    from public.admin_users a
    join auth.users u on u.id = a.user_id
    left join public.profiles p on p.id = a.user_id
    order by a.created_at;
end;
$$;

create or replace function public.admin_list_clients()
returns table (
  id              uuid,
  name            text,
  email           text,
  team            text,
  phone           text,
  created_at      timestamptz,
  email_confirmed boolean,
  last_seen       timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if not public.admin_can_section('clientes') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select p.id, p.name, u.email::text, p.team, p.phone, p.created_at,
           u.email_confirmed_at is not null,
           greatest(u.last_sign_in_at,
                    (select max(c.last_seen) from public.connected_users c where c.user_id = p.id))
    from public.profiles p
    join auth.users u on u.id = p.id
    where not u.is_anonymous   -- invitados sin cuenta: no son clientes
      and not exists (select 1 from public.admin_users a where a.user_id = p.id)
    order by p.created_at desc;
end;
$$;

-- ── Baja de un usuario ───────────────────────────────────────────────────────
--
-- Usuario del sistema: sólo un administrador. Cliente: administrador u
-- operador con la sección «clientes». Nadie se borra a sí mismo desde acá (el
-- panel nunca se queda sin el admin que lo está usando).
--
-- Igual que delete_my_account, antes de borrar se sueltan las referencias que
-- no son cascade y frenarían el borrado.

create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_es_staff boolean;
begin
  if p_user_id is null or p_user_id = auth.uid() then
    raise exception 'self_delete' using errcode = '42501',
      hint = 'No podés eliminar tu propio usuario desde el panel.';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  v_es_staff := exists (select 1 from public.admin_users where user_id = p_user_id);
  if v_es_staff and not public.is_full_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not v_es_staff and not public.admin_can_section('clientes') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.sessions          set created_by = null where created_by = p_user_id;
  update public.applause_sessions set p1_user_id = null where p1_user_id = p_user_id;
  update public.applause_sessions set p2_user_id = null where p2_user_id = p_user_id;
  delete from public.applause_user_contrib where user_id = p_user_id;

  delete from auth.users where id = p_user_id;
end;
$$;

-- ── Búsqueda por mail (sólo Edge Function) ───────────────────────────────────

create or replace function public.admin_find_user_by_email(p_email text)
returns table (id uuid, email_confirmed boolean, is_staff boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id, u.email_confirmed_at is not null,
         exists (select 1 from public.admin_users a where a.user_id = u.id)
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.admin_list_staff()               from public, anon;
revoke all on function public.admin_list_clients()             from public, anon;
revoke all on function public.admin_delete_user(uuid)          from public, anon;
revoke all on function public.admin_find_user_by_email(text)   from public, anon, authenticated;

grant execute on function public.admin_list_staff()             to authenticated;
grant execute on function public.admin_list_clients()           to authenticated;
grant execute on function public.admin_delete_user(uuid)        to authenticated;
grant execute on function public.admin_find_user_by_email(text) to service_role;
