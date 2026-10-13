-- ─── Usuarios del sistema: roles y secciones por operador ────────────────────
--
-- Perfiles de la plataforma:
--   - Cliente        → tiene fila en profiles y NO está en admin_users.
--   - Operador       → admin_users.role = 'operator'; ve sólo las secciones del
--                      panel listadas en admin_users.sections.
--   - Administrador  → admin_users.role = 'admin'; ve todo, incluidas Usuarios
--                      del sistema y Clientes.
--
-- Reemplaza a 20260901100000_admin_user_roles.sql (general_admin | operator),
-- que nunca se aplicó en remoto. Si alguien la hubiera aplicado, esta la
-- normaliza: general_admin pasa a admin.
--
-- Los administradores que ya existen quedan como 'admin' (acceso completo).
--
-- Alcance: las secciones filtran el PANEL (qué ve y usa el operador). Las
-- tablas de cada módulo siguen autorizando con is_admin(), que es verdadero
-- para operadores y administradores.

alter table public.admin_users add column if not exists role text;
alter table public.admin_users drop constraint if exists admin_users_role_check;
update public.admin_users set role = 'admin' where role is null or role = 'general_admin';
alter table public.admin_users alter column role set default 'admin';
alter table public.admin_users alter column role set not null;
alter table public.admin_users
  add constraint admin_users_role_check check (role in ('admin', 'operator'));

alter table public.admin_users
  add column if not exists sections text[] not null default '{}';

comment on column public.admin_users.role is
  'admin: acceso completo al panel. operator: sólo las secciones de `sections`.';
comment on column public.admin_users.sections is
  'Ids de sección del panel (SECS del AdminPanel) que ve un operador. Vacío para admin.';

-- La RLS existente (SELECT de la fila propia) alcanza para que cada usuario del
-- sistema lea su rol y sus secciones al abrir el panel.

-- ── Helpers ──────────────────────────────────────────────────────────────────

create or replace function public.is_full_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.admin_can_section(p_section text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and (role = 'admin' or p_section = any(sections))
  );
$$;

-- ── Listado de usuarios del sistema (sólo admin) ─────────────────────────────

create or replace function public.admin_list_staff()
returns table (
  user_id    uuid,
  name       text,
  email      text,
  role       text,
  sections   text[],
  created_at timestamptz
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
    select a.user_id, p.name, u.email::text, a.role, a.sections, a.created_at
    from public.admin_users a
    join auth.users u on u.id = a.user_id
    left join public.profiles p on p.id = a.user_id
    order by a.created_at;
end;
$$;

-- ── Listado de clientes (admin, u operador con la sección «clientes») ─────────

create or replace function public.admin_list_clients()
returns table (
  id         uuid,
  name       text,
  email      text,
  team       text,
  phone      text,
  created_at timestamptz
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
    select p.id, p.name, u.email::text, p.team, p.phone, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    where not u.is_anonymous   -- invitados sin cuenta: no son clientes
      and not exists (select 1 from public.admin_users a where a.user_id = p.id)
    order by p.created_at desc;
end;
$$;

-- ── Rol y secciones de un usuario del sistema (sólo admin) ───────────────────
--
-- Un admin no puede quitarse a sí mismo el rol de admin: así el panel nunca se
-- queda sin administradores (quien llama siempre lo es y lo sigue siendo).
-- «usuarios» no se asigna a operadores: con ella podrían darse más permisos.

create or replace function public.admin_set_staff_access(
  p_user_id  uuid,
  p_role     text,
  p_sections text[]
)
returns table (user_id uuid, role text, sections text[])
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_sections text[];
begin
  if not public.is_full_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_role is null or p_role not in ('admin', 'operator') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;

  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception 'self_demote' using errcode = '42501',
      hint = 'No podés quitarte el rol de administrador.';
  end if;

  if p_role = 'admin' then
    v_sections := '{}';
  else
    select coalesce(array_agg(distinct s order by s), '{}')
      into v_sections
      from unnest(coalesce(p_sections, '{}')) as s;

    if exists (select 1 from unnest(v_sections) s where s !~ '^[a-z][a-zA-Z0-9]{1,63}$') then
      raise exception 'invalid_section' using errcode = '22023';
    end if;
    if 'usuarios' = any(v_sections) then
      raise exception 'forbidden_section' using errcode = '22023';
    end if;
  end if;

  update public.admin_users a
     set role = p_role, sections = v_sections
   where a.user_id = p_user_id;

  if not found then
    raise exception 'not_staff' using errcode = 'P0002';
  end if;

  return query
    select a.user_id, a.role, a.sections
    from public.admin_users a
    where a.user_id = p_user_id;
end;
$$;

revoke all on function public.is_full_admin()                          from public, anon;
revoke all on function public.admin_can_section(text)                  from public, anon;
revoke all on function public.admin_list_staff()                       from public, anon;
revoke all on function public.admin_list_clients()                     from public, anon;
revoke all on function public.admin_set_staff_access(uuid, text, text[]) from public, anon;

grant execute on function public.is_full_admin()                          to authenticated;
grant execute on function public.admin_can_section(text)                  to authenticated;
grant execute on function public.admin_list_staff()                       to authenticated;
grant execute on function public.admin_list_clients()                     to authenticated;
grant execute on function public.admin_set_staff_access(uuid, text, text[]) to authenticated;
