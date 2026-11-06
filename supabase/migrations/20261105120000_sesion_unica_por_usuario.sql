-- Sesión única por cliente: una cuenta no puede estar abierta en más de un
-- dispositivo a la vez. Gana el último login: el dispositivo anterior queda
-- deslogueado.
--
-- Dos piezas:
--   1. claim_single_session(): la llama la WebApp apenas inicia sesión
--      (login, registro, link del mail). Borra de auth.sessions todas las
--      sesiones del usuario menos la actual. Al borrar la sesión caen en
--      cascada sus refresh tokens, así que el otro dispositivo ya no puede
--      renovar el JWT.
--   2. my_session_is_active(): el dispositivo viejo la consulta cada 30 s y al
--      volver a la app. Si su sesión ya no existe se desloguea en el acto, sin
--      esperar a que venza el access token (hasta 1 h).
--
-- Quedan afuera:
--   - Staff (admin_users): usa el panel y la WebApp en varios equipos a la vez.
--   - Invitados (anónimos): cada invitado es una cuenta distinta.
-- Varias pestañas del mismo navegador comparten la sesión: no se pisan.

create or replace function public.claim_single_session()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_sid     uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_borradas integer;
begin
  if v_uid is null or v_sid is null then
    return 0;
  end if;

  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return 0;
  end if;

  if exists (select 1 from public.admin_users where user_id = v_uid) then
    return 0;
  end if;

  delete from auth.sessions
   where user_id = v_uid
     and id <> v_sid;
  get diagnostics v_borradas = row_count;
  return v_borradas;
end;
$$;

create or replace function public.my_session_is_active()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when auth.uid() is null
      or nullif(auth.jwt() ->> 'session_id', '') is null then true
    else exists (
      select 1 from auth.sessions
       where id = (auth.jwt() ->> 'session_id')::uuid
         and user_id = auth.uid()
    )
  end;
$$;

revoke all on function public.claim_single_session() from public, anon;
revoke all on function public.my_session_is_active() from public, anon;
grant execute on function public.claim_single_session() to authenticated;
grant execute on function public.my_session_is_active() to authenticated;
