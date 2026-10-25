-- ─── DJ Democracy: equipos de la app y premio «GIF a pantalla» ───────────────
--
-- 1. EQUIPOS. Los equipos del DJ pasan a ser los de la app: Team Batata y Team
--    Membrillo (profiles.team, los mismos del Desafío Demente). Cada acción de
--    un cliente suma al equipo de su perfil lo que vale en la tabla del Admin
--    del DJ (pantalla_events.team_points_*), sólo con `teams_enabled`:
--      voto 👍/👎            → team_points_vote
--      súper voto            → team_points_super_vote
--      súper odio            → team_points_super_hate
--      reacción              → team_points_reaction
--      GIF a pantalla        → team_points_gif_screen
--    Sin equipo en el perfil (o invitado sin perfil) no suma nada.
--    Un voto suma UNA vez por canción y tipo (cambiar el voto de un lado al
--    otro no regala puntos): lo asegura pantalla_team_vote_awards.
--    pantalla_teams (los equipos propios que creaba el Admin) queda sin uso.
--
-- 2. GIF A PANTALLA. Quien tiene el premio (pantalla_granted_rewards con
--    prize_key 'gif_screen', sin usar) elige un GIF de la galería del DJ
--    (pantalla_gifs, kind 'prize') con pantalla_usar_gif_premio. La TV lo
--    muestra gif_screen_duration_seconds con pantalla_gif_en_pantalla.

-- ── Marcador ──────────────────────────────────────────────────────────────
create table if not exists public.pantalla_team_scores (
  event_id   uuid not null references public.pantalla_events(id) on delete cascade,
  team       text not null check (team in ('batata', 'membrillo')),
  points     integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (event_id, team)
);
alter table public.pantalla_team_scores enable row level security;
-- La TV entra sin sesión: el marcador es público. Escribe sólo el motor.
create policy "pantalla_team_scores: lectura publica" on public.pantalla_team_scores
  for select using (true);

create table if not exists public.pantalla_team_vote_awards (
  event_id  uuid not null references public.pantalla_events(id) on delete cascade,
  user_id   uuid not null,
  item_id   uuid not null,
  vote_type text not null,
  primary key (event_id, user_id, item_id, vote_type)
);
alter table public.pantalla_team_vote_awards enable row level security;

/** Suma al equipo del perfil de `_user` lo que vale `_accion` en el evento. */
create or replace function public.pantalla__sumar_equipo(_event_id uuid, _user uuid, _accion text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ev   pantalla_events%rowtype;
  v_team text;
  v_pts  integer;
begin
  select * into v_ev from pantalla_events where id = _event_id;
  if not found or not coalesce(v_ev.teams_enabled, false) then return; end if;
  v_pts := case _accion
    when 'vote'       then v_ev.team_points_vote
    when 'super_vote' then v_ev.team_points_super_vote
    when 'super_hate' then v_ev.team_points_super_hate
    when 'reaction'   then v_ev.team_points_reaction
    when 'gif_screen' then v_ev.team_points_gif_screen
    else 0 end;
  if coalesce(v_pts, 0) = 0 then return; end if;
  select team into v_team from profiles where id = _user;
  if v_team is null or v_team not in ('batata', 'membrillo') then return; end if;
  insert into pantalla_team_scores (event_id, team, points)
  values (_event_id, v_team, v_pts)
  on conflict (event_id, team)
  do update set points = pantalla_team_scores.points + excluded.points, updated_at = now();
end $$;
revoke all on function public.pantalla__sumar_equipo(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.pantalla__equipo_por_voto()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_nuevo integer;
begin
  insert into pantalla_team_vote_awards (event_id, user_id, item_id, vote_type)
  values (new.event_id, new.user_id, new.item_id, new.vote_type)
  on conflict do nothing;
  get diagnostics v_nuevo = row_count;
  if v_nuevo > 0 then
    perform pantalla__sumar_equipo(new.event_id, new.user_id,
      case new.vote_type when 'super_up' then 'super_vote' when 'super_down' then 'super_hate' else 'vote' end);
  end if;
  return null;
end $$;

create trigger pantalla_votes_equipo after insert on public.pantalla_votes
  for each row execute function public.pantalla__equipo_por_voto();

create or replace function public.pantalla__equipo_por_reaccion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pantalla__sumar_equipo(new.event_id, new.user_id, 'reaction');
  return null;
end $$;

create trigger pantalla_reactions_equipo after insert on public.pantalla_reactions
  for each row execute function public.pantalla__equipo_por_reaccion();

/** Admin: el marcador vuelve a cero (los votos ya contados no vuelven a sumar). */
create or replace function public.pantalla_reset_team_scores(_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not pantalla_can_manage(_event_id) then raise exception 'not allowed'; end if;
  update pantalla_team_scores set points = 0, updated_at = now() where event_id = _event_id;
end $$;
revoke all on function public.pantalla_reset_team_scores(uuid) from public, anon;
grant execute on function public.pantalla_reset_team_scores(uuid) to authenticated;

-- ── GIF a pantalla ────────────────────────────────────────────────────────
/**
 * El cliente usa su premio «GIF a pantalla» con un GIF de la galería del DJ.
 * Queda en `payload` (gif_url, nombre) y `consumed_at`; la TV lo toma de ahí.
 */
create or replace function public.pantalla_usar_gif_premio(_reward_id uuid, _gif_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user   uuid := auth.uid();
  v_rw     pantalla_granted_rewards%rowtype;
  v_url    text;
  v_nombre text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select * into v_rw from pantalla_granted_rewards where id = _reward_id for update;
  if not found or v_rw.user_id <> v_user then raise exception 'reward not found'; end if;
  if v_rw.prize_key <> 'gif_screen' then raise exception 'not a gif reward'; end if;
  if v_rw.consumed_at is not null then raise exception 'reward already used'; end if;
  if (select status from pantalla_events where id = v_rw.event_id) <> 'live' then raise exception 'event not live'; end if;
  select url into v_url from pantalla_gifs
   where id = _gif_id and event_id = v_rw.event_id and kind = 'prize';
  if v_url is null then raise exception 'gif not available'; end if;
  select coalesce(nullif(trim(c.nickname), ''), nullif(trim(p.name), ''), 'Alguien') into v_nombre
    from (select 1) x
    left join pantalla_contacts c on c.event_id = v_rw.event_id and c.user_id = v_user
    left join profiles p on p.id = v_user
   limit 1;
  update pantalla_granted_rewards
     set consumed_at = now(),
         payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('gif_id', _gif_id, 'gif_url', v_url, 'nombre', v_nombre)
   where id = _reward_id;
  perform pantalla__sumar_equipo(v_rw.event_id, v_user, 'gif_screen');
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.pantalla_usar_gif_premio(uuid, uuid) from public, anon;
grant execute on function public.pantalla_usar_gif_premio(uuid, uuid) to authenticated;

/**
 * Lo que la TV muestra ahora del premio: el último GIF usado, mientras dure
 * (gif_screen_duration_seconds, 10 s si no está cargado). Sin nada al aire: null.
 * Pública (la TV entra sin sesión): sólo expone el GIF y el nombre elegido.
 */
create or replace function public.pantalla_gif_en_pantalla(_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('url', r.payload->>'gif_url', 'nombre', r.payload->>'nombre',
                            'hasta', r.consumed_at + make_interval(secs => coalesce(e.gif_screen_duration_seconds, 10)))
    from pantalla_granted_rewards r
    join pantalla_events e on e.id = r.event_id
   where r.event_id = _event_id and r.prize_key = 'gif_screen' and r.consumed_at is not null
     and r.payload ? 'gif_url'
     and r.consumed_at + make_interval(secs => coalesce(e.gif_screen_duration_seconds, 10)) > now()
   order by r.consumed_at desc
   limit 1;
$$;
revoke all on function public.pantalla_gif_en_pantalla(uuid) from public;
grant execute on function public.pantalla_gif_en_pantalla(uuid) to anon, authenticated;
