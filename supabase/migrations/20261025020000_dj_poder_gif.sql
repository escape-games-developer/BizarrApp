-- ─── DJ Democracy: el poder «GIF a pantalla» del cliente ─────────────────────
--
-- «GIF a pantalla» es un PODER del cliente, y le llega por dos caminos:
--   · Regalos VIP (pantalla_vip_gifts, gift_type 'gif_screen'): cada VIP tiene
--     `quantity` GIFs cada `interval_minutes` (ventana móvil).
--   · Premios (pantalla_granted_rewards, prize_key 'gif_screen'): por un logro
--     o un sorteo, uno por fila, hasta usarlo.
--
-- pantalla_usar_gif(evento, gif) gasta uno — primero un premio sin usar (el
-- más viejo), si no hay, el cupo VIP — y lo deja registrado en
-- pantalla_granted_rewards (el uso VIP como fila source 'vip_gift' ya usada),
-- con el GIF y el nombre en `payload`. La TV lo toma de ahí con
-- pantalla_gif_en_pantalla (migración 20261025010000), y suma los puntos del
-- equipo. pantalla_mis_poderes(evento) dice cuántos le quedan y cuándo se
-- recarga el cupo VIP (para el celular).
--
-- pantalla_usar_gif_premio (la anterior, sólo premios) queda como estaba.

/** Los GIF a pantalla que le quedan a `_user`: premios sin usar + cupo VIP. */
create or replace function public.pantalla__gifs_disponibles(_event_id uuid, _user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_rol      text;
  v_premios  integer;
  v_regalo   pantalla_vip_gifts%rowtype;
  v_usados   integer := 0;
  v_cupo     integer := 0;
  v_primero  timestamptz;
  v_recarga  timestamptz;
begin
  select role into v_rol from pantalla_participants where event_id = _event_id and user_id = _user;
  select count(*) into v_premios from pantalla_granted_rewards
   where event_id = _event_id and user_id = _user and prize_key = 'gif_screen' and consumed_at is null;
  if v_rol = 'vip' then
    select * into v_regalo from pantalla_vip_gifts where event_id = _event_id and gift_type = 'gif_screen';
    if found and v_regalo.enabled and coalesce(v_regalo.quantity, 0) > 0 and coalesce(v_regalo.interval_minutes, 0) > 0 then
      select count(*), min(granted_at) into v_usados, v_primero from pantalla_granted_rewards
       where event_id = _event_id and user_id = _user and prize_key = 'gif_screen' and source = 'vip_gift'
         and granted_at > now() - make_interval(mins => v_regalo.interval_minutes);
      v_cupo := greatest(0, v_regalo.quantity - v_usados);
      if v_cupo = 0 and v_primero is not null then
        v_recarga := v_primero + make_interval(mins => v_regalo.interval_minutes);
      end if;
    end if;
  end if;
  return jsonb_build_object('premios', v_premios, 'vip', v_cupo, 'total', v_premios + v_cupo, 'recarga_vip', v_recarga);
end $$;
revoke all on function public.pantalla__gifs_disponibles(uuid, uuid) from public, anon, authenticated;

/** El cliente: cuántos GIF a pantalla le quedan (y la galería la lee aparte). */
create or replace function public.pantalla_mis_poderes(_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  return jsonb_build_object('gif_screen', pantalla__gifs_disponibles(_event_id, v_user));
end $$;
revoke all on function public.pantalla_mis_poderes(uuid) from public, anon;
grant execute on function public.pantalla_mis_poderes(uuid) to authenticated;

/** El cliente usa su poder «GIF a pantalla» con un GIF de la galería del DJ. */
create or replace function public.pantalla_usar_gif(_event_id uuid, _gif_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user   uuid := auth.uid();
  v_url    text;
  v_nombre text;
  v_rw     uuid;
  v_disp   jsonb;
  v_datos  jsonb;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if (select status from pantalla_events where id = _event_id) is distinct from 'live' then raise exception 'event not live'; end if;
  select url into v_url from pantalla_gifs where id = _gif_id and event_id = _event_id and kind = 'prize';
  if v_url is null then raise exception 'gif not available'; end if;
  select coalesce(nullif(trim(c.nickname), ''), nullif(trim(p.name), ''), 'Alguien') into v_nombre
    from (select 1) x
    left join pantalla_contacts c on c.event_id = _event_id and c.user_id = v_user
    left join profiles p on p.id = v_user
   limit 1;
  v_datos := jsonb_build_object('gif_id', _gif_id, 'gif_url', v_url, 'nombre', v_nombre);

  -- 1) Un premio sin usar, el más viejo.
  select id into v_rw from pantalla_granted_rewards
   where event_id = _event_id and user_id = v_user and prize_key = 'gif_screen' and consumed_at is null
   order by granted_at limit 1 for update;
  if v_rw is not null then
    update pantalla_granted_rewards set consumed_at = now(), payload = coalesce(payload, '{}'::jsonb) || v_datos where id = v_rw;
  else
    -- 2) El cupo VIP.
    v_disp := pantalla__gifs_disponibles(_event_id, v_user);
    if coalesce((v_disp->>'vip')::integer, 0) <= 0 then raise exception 'no gif power'; end if;
    insert into pantalla_granted_rewards (event_id, user_id, prize_key, source, source_key, consumed_at, payload)
    values (_event_id, v_user, 'gif_screen', 'vip_gift', 'gif_screen', now(), v_datos);
  end if;

  perform pantalla__sumar_equipo(_event_id, v_user, 'gif_screen');
  return jsonb_build_object('ok', true, 'quedan', pantalla__gifs_disponibles(_event_id, v_user));
end $$;
revoke all on function public.pantalla_usar_gif(uuid, uuid) from public, anon;
grant execute on function public.pantalla_usar_gif(uuid, uuid) to authenticated;
