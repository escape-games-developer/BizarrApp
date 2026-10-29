-- DJ Democracy: el contador de votos de un tema perdía votos con votos
-- simultáneos (prueba de carga 2026-10-28: 50 votos reales al mismo tema,
-- contador entre 29 y 42). Y la próxima canción se elige por ese contador.
--
-- `pantalla__recalc` recuenta desde `pantalla_votes`, pero sin bloquear: en
-- READ COMMITTED dos votos al mismo tema recontaban a la vez, cada uno sin ver
-- el voto del otro, y el último en escribir pisaba al primero.
--
-- Ahora bloquea las filas de los temas ANTES de contar. El segundo voto espera
-- a que el primero confirme y recién ahí cuenta, con una foto nueva que ya
-- incluye ese voto. NO KEY UPDATE y no FOR UPDATE: el INSERT del voto ya tomó
-- KEY SHARE sobre el tema (la FK item_id), y FOR UPDATE choca con KEY SHARE:
-- dos votos simultáneos se trabarían entre sí. El ORDER BY evita deadlocks
-- cuando un voto toca dos temas (cambio de 👍 de un tema a otro).
--
-- Sirve a todos los que recalculan: votar, supervotar y quitar el voto.

create or replace function public.pantalla__recalc(_item_ids uuid[])
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform 1 from pantalla_playlist_items
   where id = any(_item_ids)
   order by id
   for no key update;

  update pantalla_playlist_items pi set
    pos_votes = agg.pos,
    neg_votes = agg.neg,
    score     = agg.pos - agg.neg
  from (
    select i.id,
      coalesce((select sum(v.weight) from pantalla_votes v
                where v.item_id = i.id and v.vote_type in ('up','super_up')), 0)::int   as pos,
      coalesce((select sum(v.weight) from pantalla_votes v
                where v.item_id = i.id and v.vote_type in ('down','super_down')), 0)::int as neg
    from pantalla_playlist_items i
    where i.id = any(_item_ids)
  ) agg
  where pi.id = agg.id;
end;
$function$;

-- Interna: la llaman las RPC públicas, nunca el cliente.
revoke execute on function public.pantalla__recalc(uuid[]) from public, anon, authenticated;
