-- Follow the Leader: barómetro de energía por toques.
--
-- Reemplaza la votación 👍/👎 (follow_leader_votes queda como histórico).
-- Los clientes tocan la pantalla durante la performance y cada toque suma
-- "energía" al turno. La energía se descarga sola (decaimiento exponencial,
-- tau = 4 s): el % sube mientras el público toca y baja cuando deja de tocar.
--
--   energía(t) = energía(t0) · e^(−(t−t0)/4) + toques nuevos
--
-- Con un ritmo constante de R toques/seg la energía se estabiliza en R·4.
-- 100% = un ritmo de max(6, 1.5 × conectados) toques/seg: escala con la gente
-- que hay en el bar (connected_users con heartbeat en los últimos 90 s).
--
-- Las dos tablas no tienen policies: sólo se tocan por los RPC (security
-- definer). El % es público (la TV entra sin sesión).

create table if not exists public.ftl_energia (
  turn_id       uuid primary key references public.escenario_queue(id) on delete cascade,
  energia       double precision not null default 0,
  actualizado   timestamptz not null default now(),
  toques_total  integer not null default 0
);

create table if not exists public.ftl_toques_usuario (
  turn_id  uuid not null references public.escenario_queue(id) on delete cascade,
  user_id  uuid not null,
  ultimo   timestamptz not null default now(),
  toques   integer not null default 0,
  primary key (turn_id, user_id)
);

alter table public.ftl_energia        enable row level security;
alter table public.ftl_toques_usuario enable row level security;

-- Suma toques del cliente. El celular los manda en tandas (~cada 0,5 s); se
-- acepta como mucho una tanda cada 400 ms por persona y 12 toques por tanda,
-- así un script no puede llenar el barómetro solo.
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
  if not found                 then raise exception 'turn not found'; end if;
  if v_turn.type   <> 'ftl'    then raise exception 'not a follow the leader turn'; end if;
  if v_turn.status <> 'called' then raise exception 'turn not open for voting'; end if;
  if v_turn.user_id = v_user   then raise exception 'protagonist cannot vote on their own turn'; end if;

  -- Sólo con el video sonando (▶ Lanzar), no con el participante preparado.
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
  if v_ok = 0 then return; end if;   -- tanda demasiado seguida: se descarta

  insert into public.ftl_energia as e (turn_id, energia, actualizado, toques_total)
  values (p_turn_id, v_n, now(), v_n)
  on conflict (turn_id) do update
    set energia      = e.energia * exp(-extract(epoch from (now() - e.actualizado)) / 4.0) + excluded.energia,
        actualizado  = now(),
        toques_total = e.toques_total + excluded.toques_total;
end $$;

revoke all on function public.ftl_tocar(uuid, integer) from public, anon;
grant execute on function public.ftl_tocar(uuid, integer) to authenticated;

-- % actual del barómetro (0–100), con el decaimiento aplicado a este instante.
create or replace function public.ftl_energia_pct(p_turn_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_energia    double precision;
  v_session    uuid;
  v_conectados integer;
  v_lleno      double precision;
begin
  select e.energia * exp(-extract(epoch from (now() - e.actualizado)) / 4.0), q.session_id
    into v_energia, v_session
  from public.ftl_energia e
  join public.escenario_queue q on q.id = e.turn_id
  where e.turn_id = p_turn_id;
  if v_energia is null then return 0; end if;

  select count(*) into v_conectados
  from public.connected_users
  where session_id = v_session and last_seen > now() - interval '90 seconds';

  v_lleno := greatest(6.0, 1.5 * v_conectados) * 4.0;
  return least(100, greatest(0, round(100.0 * v_energia / v_lleno)))::integer;
end $$;

revoke all on function public.ftl_energia_pct(uuid) from public;
grant execute on function public.ftl_energia_pct(uuid) to anon, authenticated;
