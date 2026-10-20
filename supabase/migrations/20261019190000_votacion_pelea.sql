-- ─── Votación de Escenario: Mod 3 «pelea» (👍/👎 con toques múltiples) ──────
--
-- Modos de admin_ui_config key='votacion_escenario' (ftl / pt):
--   'toques' → Mod 1: todos tocan positivo, la energía sube y se descarga sola
--   'votos'  → Mod 2: un voto fijo por persona, 👍 o 👎 (cambiable)
--   'pelea'  → Mod 3: cada uno toca 👍 o 👎 todas las veces que quiera y la
--              barra se pelea: arranca en 50 %, 👍 la sube, 👎 la baja
--   'off'    → sin votación
--
-- Mod 3: la posición queda donde la deja la pelea (no se descarga). Cada toque
-- mueve 50 / max(15, 2 × conectados) puntos: con 20 conectados, 40 toques
-- netos llevan la barra del medio a un extremo. Mismo anti-abuso que Mod 1:
-- una tanda cada 400 ms por persona y hasta 12 toques por tanda (sumando 👍 y
-- 👎). La tabla de throttle `ftl_toques_usuario` se comparte con Mod 1.

create or replace function public.admin_ui_votacion_valido(v jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_typeof(v) is not distinct from 'object'
     and jsonb_typeof(v->'version') is not distinct from 'number'
     and (v->>'version') ~ '^[1-9][0-9]*$'
     and (v->>'ftl') in ('toques', 'votos', 'pelea', 'off')
     and (v->>'pt')  in ('toques', 'votos', 'pelea', 'off')
     and (v - 'version' - 'ftl' - 'pt') = '{}'::jsonb;
$$;

create table if not exists public.ftl_pelea (
  turn_id      uuid primary key references public.escenario_queue(id) on delete cascade,
  posicion     double precision not null default 50 check (posicion between 0 and 100),
  positivos    integer not null default 0,
  negativos    integer not null default 0,
  actualizado  timestamptz not null default now()
);

alter table public.ftl_pelea enable row level security;   -- sólo por RPC

create or replace function public.ftl_pelear(p_turn_id uuid, p_positivos integer, p_negativos integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_pos   integer := greatest(coalesce(p_positivos, 0), 0);
  v_neg   integer := greatest(coalesce(p_negativos, 0), 0);
  v_turn  public.escenario_queue%rowtype;
  v_ok    integer;
  v_conectados integer;
  v_paso  double precision;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  -- Tope de 12 por tanda entre los dos botones, proporcional.
  if v_pos + v_neg > 12 then
    v_pos := round(v_pos * 12.0 / (v_pos + v_neg));
    v_neg := 12 - v_pos;
  end if;
  if v_pos + v_neg = 0 then return; end if;

  select * into v_turn from public.escenario_queue where id = p_turn_id;
  if not found                       then raise exception 'turn not found'; end if;
  if v_turn.type not in ('ftl','pt') then raise exception 'not a follow the leader turn'; end if;
  if public.votacion_escenario_modo(v_turn.type) <> 'pelea'
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
  values (p_turn_id, v_user, now(), v_pos + v_neg)
  on conflict (turn_id, user_id) do update
    set ultimo = now(), toques = t.toques + excluded.toques
    where t.ultimo < now() - interval '400 milliseconds';
  get diagnostics v_ok = row_count;
  if v_ok = 0 then return; end if;

  select count(*) into v_conectados
  from public.connected_users
  where session_id = v_turn.session_id and last_seen > now() - interval '90 seconds';
  v_paso := 50.0 / greatest(15, 2 * v_conectados);

  insert into public.ftl_pelea as p (turn_id, posicion, positivos, negativos)
  values (p_turn_id, least(100, greatest(0, 50 + (v_pos - v_neg) * v_paso)), v_pos, v_neg)
  on conflict (turn_id) do update
    set posicion    = least(100, greatest(0, p.posicion + (v_pos - v_neg) * v_paso)),
        positivos   = p.positivos + excluded.positivos,
        negativos   = p.negativos + excluded.negativos,
        actualizado = now();
end $$;

revoke all on function public.ftl_pelear(uuid, integer, integer) from public, anon;
grant execute on function public.ftl_pelear(uuid, integer, integer) to authenticated;

-- Estado de la pelea: posición (0–100, 50 sin toques) y totales. Público.
create or replace function public.ftl_pelea_estado(p_turn_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select jsonb_build_object('pct', round(posicion)::int, 'positivos', positivos, 'negativos', negativos)
       from public.ftl_pelea where turn_id = p_turn_id),
    jsonb_build_object('pct', 50, 'positivos', 0, 'negativos', 0));
$$;

revoke all on function public.ftl_pelea_estado(uuid) from public;
grant execute on function public.ftl_pelea_estado(uuid) to anon, authenticated;
