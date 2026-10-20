-- ─── /tv avisa que terminó el video de un juego de Escenario ────────────────
--
-- Cuando el video del participante (FTL / PT) llega a su fin, la TV vuelve
-- sola a la pantalla de convocatoria, sin transición: es lo mismo que el
-- "■ Finalizar — vuelve la convocatoria" del Admin.
--   game_state.escenario_participant / escenario_video → null
--   escenario_queue.status 'called' → 'done'
--
-- /tv entra por token (sin sesión de auth), así que se valida con el mismo
-- pantalla__tv_authorized que usa pantalla_tv_song_ended. Idempotente: sólo
-- actúa si ese turno sigue en el escenario y con el video sonando, así un
-- ENDED atrasado o repetido no baja al participante siguiente.

create or replace function public.tv_escenario_video_terminado(_event_id uuid, _token text, _turn_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session uuid;
  v_n       integer;
begin
  if not public.pantalla__tv_authorized(_event_id, _token) then
    raise exception 'invalid tv access';
  end if;
  if _turn_id is null then return false; end if;

  select session_id into v_session from public.pantalla_events where id = _event_id;
  if v_session is null then return false; end if;

  update public.game_state
     set escenario_participant = null,
         escenario_video       = null
   where session_id = v_session
     and escenario_participant->>'turn_id' = _turn_id::text
     and coalesce((escenario_participant->>'playing')::boolean, false);
  get diagnostics v_n = row_count;
  if v_n = 0 then return false; end if;

  update public.escenario_queue
     set status = 'done'
   where id = _turn_id and status = 'called';

  return true;
end $$;

revoke all on function public.tv_escenario_video_terminado(uuid, text, uuid) from public;
grant execute on function public.tv_escenario_video_terminado(uuid, text, uuid) to anon, authenticated;
