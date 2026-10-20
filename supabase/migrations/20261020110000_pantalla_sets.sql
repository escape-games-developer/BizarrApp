-- ─── DJ Democracy: sets de canciones + rotación por categorías ──────────────
--
-- 1) SETS. Un set es un subconjunto con nombre de la playlist del evento (ej.
--    "Rock Internacional"). Puede haber varios guardados y, como mucho, uno
--    ACTIVO:
--      · con set activo → sólo sus canciones pueden entrar a la votación
--        (también las fijadas: una fijada fuera del set no entra);
--      · sin set activo → como siempre, entran todas las habilitadas.
--    Al activar un set, las candidatas que no son del set salen en el acto (se
--    borran sus votos) y se completa la ventana con canciones del set. La que
--    está sonando no se toca.
--
-- 2) ROTACIÓN POR CATEGORÍAS. pantalla_events.category_rotation =
--      { "enabled": bool, "slots": { "A": n, "B": n, "C": n, "D": n } }
--    Con la rotación activa, cada categoría tiene N lugares fijos en la
--    ventana de candidatas: al completar la ventana se cubren primero esos
--    lugares con canciones de esa categoría y el resto, con cualquiera.
--
-- 3) ALTA con volumen y categoría:
--      URL | Título | Artista | Inicio | Fin | Volumen (0-100) | Categoría (A-D)
--
-- Todo lo maneja el staff del evento (pantalla_can_manage).

-- ── Sets ────────────────────────────────────────────────────────────────────
create table if not exists public.pantalla_sets (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.pantalla_events(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 60),
  created_at  timestamptz not null default now()
);

create table if not exists public.pantalla_set_items (
  set_id   uuid not null references public.pantalla_sets(id) on delete cascade,
  item_id  uuid not null references public.pantalla_playlist_items(id) on delete cascade,
  primary key (set_id, item_id)
);

create index if not exists pantalla_sets_event_idx on public.pantalla_sets (event_id, created_at);
create index if not exists pantalla_set_items_item_idx on public.pantalla_set_items (item_id);

alter table public.pantalla_events
  add column if not exists active_set_id uuid references public.pantalla_sets(id) on delete set null;

alter table public.pantalla_sets      enable row level security;
alter table public.pantalla_set_items enable row level security;

drop policy if exists pantalla_sets_staff on public.pantalla_sets;
create policy pantalla_sets_staff on public.pantalla_sets
  for all using (public.pantalla_can_manage(event_id)) with check (public.pantalla_can_manage(event_id));

drop policy if exists pantalla_set_items_staff on public.pantalla_set_items;
create policy pantalla_set_items_staff on public.pantalla_set_items
  for all using (exists (select 1 from public.pantalla_sets s where s.id = set_id and public.pantalla_can_manage(s.event_id)))
  with check (exists (select 1 from public.pantalla_sets s where s.id = set_id and public.pantalla_can_manage(s.event_id)));

-- ── Rotación por categorías ─────────────────────────────────────────────────
alter table public.pantalla_events
  add column if not exists category_rotation jsonb not null
    default '{"enabled":false,"slots":{"A":0,"B":0,"C":0,"D":0}}'::jsonb;

-- ── Pool de candidatas: set activo + lugares por categoría ─────────────────
create or replace function public.pantalla_refill_candidates(_event_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ev pantalla_events%rowtype; v_have integer; v_need integer;
  v_added integer := 0; v_n integer; v_relegated uuid[];
  v_cat text; v_slots integer; v_have_cat integer;
begin
  select * into v_ev from pantalla_events where id = _event_id;
  if not found then raise exception 'event not found'; end if;

  select array(select id from pantalla_playlist_items
    where event_id = _event_id and is_active_candidate and not locked and not pinned
      and consecutive_last_place_rounds >= v_ev.relegation_rounds_threshold) into v_relegated;

  select v_relegated || array(select id from pantalla_playlist_items
    where event_id = _event_id and is_active_candidate and not locked and not pinned
      and score <= v_ev.reject_score_threshold and not (id = any(v_relegated))) into v_relegated;

  if array_length(v_relegated, 1) > 0 then
    delete from pantalla_votes where item_id = any(v_relegated);
    update pantalla_playlist_items set
      is_active_candidate = false,
      last_status = case when score <= v_ev.reject_score_threshold then 'rejected' else 'idle' end,
      last_status_changed_at = now(), consecutive_last_place_rounds = 0,
      pos_votes = 0, neg_votes = 0, score = 0,
      position = (select coalesce(max(position),0) + 1 from pantalla_playlist_items where event_id = _event_id)
    where id = any(v_relegated);
  end if;

  update pantalla_playlist_items pi set
    is_active_candidate = true, last_status = 'active', last_status_changed_at = now()
  where pi.event_id = _event_id and pi.pinned and pi.enabled and not pi.is_active_candidate
    and pi.id is distinct from v_ev.current_item_id
    and (v_ev.active_set_id is null or exists (
      select 1 from pantalla_set_items si where si.set_id = v_ev.active_set_id and si.item_id = pi.id));

  select count(*) into v_have from pantalla_playlist_items
   where event_id = _event_id and is_active_candidate and id is distinct from v_ev.current_item_id;

  v_need := v_ev.active_candidates_count - v_have;
  if v_need <= 0 then return 0; end if;

  -- Primero, los lugares fijos de cada categoría (si la rotación está activa).
  if coalesce((v_ev.category_rotation->>'enabled')::boolean, false) then
    foreach v_cat in array array['A','B','C','D'] loop
      exit when v_need <= 0;
      v_slots := coalesce((v_ev.category_rotation->'slots'->>v_cat)::int, 0);
      continue when v_slots <= 0;
      select count(*) into v_have_cat from pantalla_playlist_items
       where event_id = _event_id and is_active_candidate and category = v_cat
         and id is distinct from v_ev.current_item_id;
      continue when v_have_cat >= v_slots;

      with elegibles as (
        select pi.id from pantalla_playlist_items pi
         where pi.event_id = _event_id and pi.enabled and not pi.is_active_candidate
           and pi.category = v_cat
           and pi.id is distinct from v_ev.current_item_id
           and coalesce(pi.last_status,'idle') <> 'rejected'
           and (v_ev.active_set_id is null or exists (
             select 1 from pantalla_set_items si where si.set_id = v_ev.active_set_id and si.item_id = pi.id))
         order by (pi.last_status = 'played_recently') asc, pi.times_played asc, pi.position asc, pi.created_at asc
         limit least(v_slots - v_have_cat, v_need)
      )
      update pantalla_playlist_items pi set
        is_active_candidate = true, last_status = 'active', last_status_changed_at = now(),
        consecutive_last_place_rounds = 0, pos_votes = 0, neg_votes = 0, score = 0
      from elegibles e where pi.id = e.id;

      get diagnostics v_n = row_count;
      v_added := v_added + v_n;
      v_need := v_need - v_n;
    end loop;
  end if;

  if v_need <= 0 then return v_added; end if;

  -- Después, el resto de la ventana con cualquier canción elegible.
  with elegibles as (
    select pi.id from pantalla_playlist_items pi
     where pi.event_id = _event_id and pi.enabled and not pi.is_active_candidate
       and pi.id is distinct from v_ev.current_item_id
       and coalesce(pi.last_status,'idle') <> 'rejected'
       and (v_ev.active_set_id is null or exists (
         select 1 from pantalla_set_items si where si.set_id = v_ev.active_set_id and si.item_id = pi.id))
     order by (pi.last_status = 'played_recently') asc, pi.times_played asc, pi.position asc, pi.created_at asc
     limit v_need
  )
  update pantalla_playlist_items pi set
    is_active_candidate = true, last_status = 'active', last_status_changed_at = now(),
    consecutive_last_place_rounds = 0, pos_votes = 0, neg_votes = 0, score = 0
  from elegibles e where pi.id = e.id;

  get diagnostics v_n = row_count;
  return v_added + v_n;
end $function$;

revoke execute on function public.pantalla_refill_candidates(uuid) from public, anon, authenticated;

-- ── Activar / desactivar un set ─────────────────────────────────────────────
create or replace function public.pantalla_activate_set(_event_id uuid, _set_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_ev pantalla_events%rowtype; v_fuera uuid[];
begin
  if not public.pantalla_can_manage(_event_id) then raise exception 'not authorized'; end if;
  if _set_id is not null and not exists (select 1 from pantalla_sets where id = _set_id and event_id = _event_id) then
    raise exception 'set not found';
  end if;

  update pantalla_events set active_set_id = _set_id where id = _event_id returning * into v_ev;

  if _set_id is not null then
    select array(select pi.id from pantalla_playlist_items pi
      where pi.event_id = _event_id and pi.is_active_candidate
        and pi.id is distinct from v_ev.current_item_id
        and not exists (select 1 from pantalla_set_items si where si.set_id = _set_id and si.item_id = pi.id))
      into v_fuera;
    if array_length(v_fuera, 1) > 0 then
      delete from pantalla_votes where item_id = any(v_fuera);
      update pantalla_playlist_items set is_active_candidate = false, last_status = 'idle',
        last_status_changed_at = now(), consecutive_last_place_rounds = 0,
        pos_votes = 0, neg_votes = 0, score = 0
      where id = any(v_fuera);
    end if;
  end if;

  perform public.pantalla_refill_candidates(_event_id);
  return jsonb_build_object('ok', true, 'active_set_id', _set_id,
    'retiradas', coalesce(array_length(v_fuera, 1), 0));
end $function$;

revoke all on function public.pantalla_activate_set(uuid, uuid) from public, anon;
grant execute on function public.pantalla_activate_set(uuid, uuid) to authenticated;

-- ── Guardar la rotación por categorías y aplicarla ──────────────────────────
create or replace function public.pantalla_set_category_rotation(_event_id uuid, _rotation jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v jsonb;
begin
  if not public.pantalla_can_manage(_event_id) then raise exception 'not authorized'; end if;
  v := jsonb_build_object(
    'enabled', coalesce((_rotation->>'enabled')::boolean, false),
    'slots', jsonb_build_object(
      'A', greatest(0, least(15, coalesce((_rotation->'slots'->>'A')::int, 0))),
      'B', greatest(0, least(15, coalesce((_rotation->'slots'->>'B')::int, 0))),
      'C', greatest(0, least(15, coalesce((_rotation->'slots'->>'C')::int, 0))),
      'D', greatest(0, least(15, coalesce((_rotation->'slots'->>'D')::int, 0)))));
  update pantalla_events set category_rotation = v where id = _event_id;
  perform public.pantalla_refill_candidates(_event_id);
  return v;
end $function$;

revoke all on function public.pantalla_set_category_rotation(uuid, jsonb) from public, anon;
grant execute on function public.pantalla_set_category_rotation(uuid, jsonb) to authenticated;

-- ── Alta de canciones: acepta también volumen y categoría ───────────────────
create or replace function public.pantalla_add_items(_event_id uuid, _items jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_base integer; v_count integer;
begin
  if not public.pantalla_can_manage(_event_id) then raise exception 'not authorized'; end if;
  if jsonb_typeof(_items) <> 'array' then raise exception 'items must be an array'; end if;

  select coalesce(max(position), 0) into v_base from pantalla_playlist_items where event_id = _event_id;

  with nuevos as (
    select it, row_number() over () as rn
      from jsonb_array_elements(_items) it
     where coalesce(it->>'youtube_id','') <> ''
  )
  insert into pantalla_playlist_items
    (event_id, title, artist, cover_url, source_type, youtube_id,
     trim_start_seconds, trim_end_seconds, youtube_volume, category, position)
  select _event_id,
         coalesce(nullif(trim(it->>'title'), ''), 'Sin titulo'),
         nullif(trim(coalesce(it->>'artist','')), ''),
         coalesce(nullif(it->>'cover_url',''),
                  'https://i.ytimg.com/vi/' || (it->>'youtube_id') || '/mqdefault.jpg'),
         'youtube', it->>'youtube_id',
         coalesce((it->>'trim_start_seconds')::int, 0),
         nullif(it->>'trim_end_seconds','')::int,
         least(100, greatest(0, coalesce(nullif(it->>'youtube_volume','')::int, 100))),
         case when upper(coalesce(it->>'category','')) in ('A','B','C','D') then upper(it->>'category') else 'A' end,
         v_base + rn
    from nuevos;

  get diagnostics v_count = row_count;
  perform public.pantalla_refill_candidates(_event_id);
  return v_count;
end $function$;
