-- ─── Perfiles: Cliente, Anfitrión, Producción y Administrador general ───────
--
--   Cliente               → sin fila en admin_users (como hasta ahora).
--   Anfitrión  'anfitrion'  → ve sólo las secciones que le habilita el admin.
--                             Reemplaza a 'operator'.
--   Producción 'produccion' → mismas reglas que Anfitrión (sections); el panel
--                             la precarga con todas las secciones y el admin
--                             puede sacarle alguna.
--   Administrador general 'admin' → ve todo y gestiona los usuarios del sistema.
--
-- Backend: Anfitrión y Producción se autorizan igual (admin_can_section mira
-- `sections`; is_full_admin sólo 'admin'). La diferencia es el perfil que se
-- muestra y el preset de secciones.
--
-- 'operator' se sigue aceptando en admin_set_staff_access como alias de
-- 'anfitrion', para que un panel viejo abierto durante el deploy no falle.

alter table public.admin_users drop constraint if exists admin_users_role_check;

update public.admin_users set role = 'anfitrion' where role = 'operator';

alter table public.admin_users
  add constraint admin_users_role_check check (role in ('admin', 'produccion', 'anfitrion'));

create or replace function public.admin_set_staff_access(p_user_id uuid, p_role text, p_sections text[])
returns table(user_id uuid, role text, sections text[])
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_role     text := case when p_role = 'operator' then 'anfitrion' else p_role end;
  v_sections text[];
begin
  if not public.is_full_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_role is null or v_role not in ('admin', 'produccion', 'anfitrion') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;

  if p_user_id = auth.uid() and v_role <> 'admin' then
    raise exception 'self_demote' using errcode = '42501',
      hint = 'No podés quitarte el rol de administrador.';
  end if;

  if v_role = 'admin' then
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
     set role = v_role, sections = v_sections
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
