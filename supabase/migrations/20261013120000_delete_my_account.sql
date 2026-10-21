-- ─── Eliminar mi cuenta ──────────────────────────────────────────────────────
--
-- El cliente borra su propia cuenta desde el menú ⋮ del Perfil. Desde el
-- navegador no se puede borrar una fila de auth.users, así que lo hace esta
-- función con security definer, siempre sobre auth.uid(): nadie puede borrar
-- la cuenta de otro.
--
-- Al borrar de auth.users caen en cascada el perfil y todo lo que cuelga del
-- usuario (mensajes, votos, cupones, pedidos de video, presencia, etc.).
-- Antes hay que soltar las tres referencias que no son cascade y frenarían el
-- borrado:
--   - sessions.created_by            → null (dato de auditoría del admin)
--   - applause_sessions.p1/p2_user_id → null en PT / FTL. Las rondas de DUELO
--                                       donde jugó se borran: el CHECK
--                                       applause_sessions_duelo_consistente
--                                       exige los dos jugadores (sus totales y
--                                       aportes caen en cascada por round_id)
--   - applause_user_contrib.user_id  → se borra (es NOT NULL; son los aplausos
--                                       que aportó, no tienen sentido sin él)
--
-- Las cuentas de staff (admin_users) no se pueden borrar desde acá: perder un
-- admin por un toque equivocado deja el panel sin dueño. Se borran a mano.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if exists (select 1 from public.admin_users where user_id = v_uid) then
    raise exception 'admin_account'
      using errcode = '42501',
            hint    = 'Las cuentas del staff no se eliminan desde la app.';
  end if;

  update public.sessions          set created_by = null where created_by = v_uid;
  delete from public.applause_sessions
   where game_type = 'duelo' and v_uid in (p1_user_id, p2_user_id);
  update public.applause_sessions set p1_user_id = null where p1_user_id = v_uid;
  update public.applause_sessions set p2_user_id = null where p2_user_id = v_uid;
  delete from public.applause_user_contrib where user_id = v_uid;

  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
