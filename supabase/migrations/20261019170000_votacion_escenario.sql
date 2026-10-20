-- ─── Ajustes → Votación de Escenario: cómo vota el público en FTL y PT ───────
--
-- Fila admin_ui_config key='votacion_escenario':
--   { version: 1, ftl: <modo>, pt: <modo> }
--   modo = 'toques' → Mod 1: barómetro de energía (ftl_tocar / ftl_energia_pct)
--          'votos'  → Mod 2: 👍/👎 (cast_follow_leader_vote / vote_totals)
--          'off'    → sin votación
-- Por defecto lo que había: FTL con toques, PT sin votación.
--
-- Los RPC de los dos modos pasan a aceptar turnos 'ftl' y 'pt', y cada uno
-- rechaza el voto si el juego no está en su modo: el Ajuste manda también en
-- el servidor, no sólo en la pantalla.
--
-- Escritura: la de admin_ui_config (UPDATE de `value` con is_admin()).
-- Lectura pública con votacion_escenario_config(): la TV entra sin sesión.

create or replace function public.admin_ui_votacion_valido(v jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_typeof(v) is not distinct from 'object'
     and jsonb_typeof(v->'version') is not distinct from 'number'
     and (v->>'version') ~ '^[1-9][0-9]*$'
     and (v->>'ftl') in ('toques', 'votos', 'off')
     and (v->>'pt')  in ('toques', 'votos', 'off')
     and (v - 'version' - 'ftl' - 'pt') = '{}'::jsonb;
$$;

alter table public.admin_ui_config
  add constraint admin_ui_config_votacion_valido
  check (key <> 'votacion_escenario' or public.admin_ui_votacion_valido(value));

insert into public.admin_ui_config (key, value)
values ('votacion_escenario', '{"version":1,"ftl":"toques","pt":"off"}'::jsonb)
on conflict (key) do nothing;

create or replace function public.votacion_escenario_config()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select value from public.admin_ui_config where key = 'votacion_escenario';
$$;

revoke all on function public.votacion_escenario_config() from public;
grant execute on function public.votacion_escenario_config() to anon, authenticated;

/** Modo vigente de un juego ('toques' | 'votos' | 'off'). */
create or replace function public.votacion_escenario_modo(p_juego text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select value->>p_juego from public.admin_ui_config where key = 'votacion_escenario'),
    case p_juego when 'ftl' then 'toques' else 'off' end);
$$;

revoke all on function public.votacion_escenario_modo(text) from public;
grant execute on function public.votacion_escenario_modo(text) to anon, authenticated;

-- ── Mod 2: 👍/👎 — acepta FTL y PT, sólo si el juego está en 'votos' ────────
create or replace function public.cast_follow_leader_vote(p_turn_id uuid, p_vote text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_turn public.escenario_queue%rowtype;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_vote not in ('up','down') then raise exception 'invalid vote'; end if;

  select * into v_turn from public.escenario_queue where id = p_turn_id;
  if not found                          then raise exception 'turn not found'; end if;
  if v_turn.type not in ('ftl','pt')    then raise exception 'not a follow the leader turn'; end if;
  if public.votacion_escenario_modo(v_turn.type) <> 'votos'
                                        then raise exception 'voting mode disabled'; end if;
  if v_turn.status <> 'called'          then raise exception 'turn not open for voting'; end if;
  if v_turn.user_id = v_user            then raise exception 'protagonist cannot vote on their own turn'; end if;

  insert into public.follow_leader_votes (turn_id, session_id, user_id, vote)
  values (p_turn_id, v_turn.session_id, v_user, p_vote)
  on conflict (turn_id, user_id) do update
    set vote = excluded.vote,
        updated_at = now()
    where public.follow_leader_votes.vote is distinct from excluded.vote;
end $$;

revoke all on function public.cast_follow_leader_vote(uuid, text) from public, anon;
grant execute on function public.cast_follow_leader_vote(uuid, text) to authenticated;

-- ── Mod 1: toques — acepta FTL y PT, sólo si el juego está en 'toques' ──────
create or replace function public.ftl_tocar(p_turn_id uuid, p_toques integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_n    integer := least(greatest(coalesce(p_toques, 0), 0), 12);
  v_turn public.escenario_queue%rowtype;
  v_ok   integer;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if v_n = 0 then return; end if;

  select * into v_turn from public.escenario_queue where id = p_turn_id;
  if not found                       then raise exception 'turn not found'; end if;
  if v_turn.type not in ('ftl','pt') then raise exception 'not a follow the leader turn'; end if;
  if public.votacion_escenario_modo(v_turn.type) <> 'toques'
                                     then raise exception 'voting mode disabled'; end if;
  if v_turn.status <> 'called'       then raise exception 'turn not open for voting'; end if;
  if v_turn.user_id = v_user         then raise exception 'protagonist cannot vote on their own turn'; end if;

  if not exists (
    select 1 from public.game_state
    where escenario_participant->>'turn_id' = p_turn_id::text
      and coalesce((escenario_participant->>'playing')::boolean, false)
  ) then
    raise exception 'performance not live';
  end if;

  insert into public.ftl_toques_usuario as t (turn_id, user_id, ultimo, toques)
  values (p_turn_id, v_user, now(), v_n)
  on conflict (turn_id, user_id) do update
    set ultimo = now(), toques = t.toques + excluded.toques
    where t.ultimo < now() - interval '400 milliseconds';
  get diagnostics v_ok = row_count;
  if v_ok = 0 then return; end if;

  insert into public.ftl_energia as e (turn_id, energia, actualizado, toques_total)
  values (p_turn_id, v_n, now(), v_n)
  on conflict (turn_id) do update
    set energia      = e.energia * exp(-extract(epoch from (now() - e.actualizado)) / 4.0) + excluded.energia,
        actualizado  = now(),
        toques_total = e.toques_total + excluded.toques_total;
end $$;

revoke all on function public.ftl_tocar(uuid, integer) from public, anon;
grant execute on function public.ftl_tocar(uuid, integer) to authenticated;
