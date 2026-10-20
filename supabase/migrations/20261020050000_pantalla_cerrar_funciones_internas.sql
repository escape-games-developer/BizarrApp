-- ─── DJ Democracy: cerrar las funciones internas al público ─────────────────
--
-- Las funciones auxiliares `pantalla__*` y `pantalla_refill_candidates` son
-- SECURITY DEFINER y no verifican quién llama: las validaciones viven en las
-- funciones públicas que las usan (votar, sacar tema, avanzar, TV…). Pero
-- tenían EXECUTE para anon y authenticated, así que cualquiera con la clave
-- pública podía, por ejemplo, llamar `pantalla__advance` y pasar o forzar la
-- canción del bar, o crear participantes a nombre de otros.
--
-- Se les quita EXECUTE a public / anon / authenticated. Siguen funcionando
-- desde adentro: las funciones públicas son SECURITY DEFINER con dueño
-- postgres, que conserva el permiso.
--
-- Para el panel queda `pantalla_refill_event`, con chequeo de admin.

revoke execute on function public.pantalla__advance(uuid, uuid, uuid, text)  from public, anon, authenticated;
revoke execute on function public.pantalla__ensure_participant(uuid, uuid)   from public, anon, authenticated;
revoke execute on function public.pantalla__recalc(uuid[])                    from public, anon, authenticated;
revoke execute on function public.pantalla__active_count(uuid)                from public, anon, authenticated;
revoke execute on function public.pantalla__new_code()                        from public, anon, authenticated;
revoke execute on function public.pantalla__opposite(text)                    from public, anon, authenticated;
revoke execute on function public.pantalla__tv_authorized(uuid, text)         from public, anon, authenticated;
revoke execute on function public.pantalla_refill_candidates(uuid)            from public, anon, authenticated;

create or replace function public.pantalla_refill_event(_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pantalla_can_manage(_event_id) then raise exception 'not authorized'; end if;
  return public.pantalla_refill_candidates(_event_id);
end $$;

revoke all on function public.pantalla_refill_event(uuid) from public, anon;
grant execute on function public.pantalla_refill_event(uuid) to authenticated;
