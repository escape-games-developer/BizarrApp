-- DJ Democracy · «Sacar tema»: los votos que llegaban tarde caían en la canción
-- siguiente (prueba de carga 2026-10-28: con 50 conectados el tema se saca con
-- 26; los otros 24, mandados contra ESE tema, quedaban anotados contra el que
-- empezó, a 2 votos de sacarlo también).
--
-- Las RPC no sabían a qué canción apuntaba el voto: lo anotaban contra la que
-- estuviera sonando al llegar. Estas versiones reciben `_item_id`, la canción
-- que el celular tenía en pantalla al tocar. Si ya no es la actual, el voto no
-- se anota y se devuelve el estado de la canción nueva (con `stale: true`): el
-- botón se actualiza solo, sin cartel de error.
--
-- El evento se bloquea antes de comparar, igual que en la RPC original (que
-- se llama adentro, en la misma transacción): entre la comparación y el voto
-- la canción no puede cambiar. Las versiones de un argumento quedan para los
-- celulares que todavía tengan la app anterior cargada.

create or replace function public.pantalla_toggle_kick_vote(_event_id uuid, _item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actual uuid;
begin
  select current_item_id into v_actual from pantalla_events where id = _event_id for update;
  if _item_id is not null and v_actual is distinct from _item_id then
    return public.pantalla_get_kick_status(_event_id) || jsonb_build_object('stale', true);
  end if;
  return public.pantalla_toggle_kick_vote(_event_id);
end;
$function$;

create or replace function public.pantalla_kick_voto_fijo(_event_id uuid, _value integer, _item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actual uuid;
begin
  select current_item_id into v_actual from pantalla_events where id = _event_id for update;
  if _item_id is not null and v_actual is distinct from _item_id then
    return public.pantalla_get_kick_status(_event_id) || jsonb_build_object('stale', true);
  end if;
  return public.pantalla_kick_voto_fijo(_event_id, _value);
end;
$function$;

revoke all on function public.pantalla_toggle_kick_vote(uuid, uuid) from public, anon;
revoke all on function public.pantalla_kick_voto_fijo(uuid, integer, uuid) from public, anon;
grant execute on function public.pantalla_toggle_kick_vote(uuid, uuid) to authenticated, service_role;
grant execute on function public.pantalla_kick_voto_fijo(uuid, integer, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
