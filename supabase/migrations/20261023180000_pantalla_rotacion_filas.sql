-- Rotación por Categorías por FILAS, como en el original.
--
-- Antes: `category_rotation = { enabled, slots: { A, B, C, D } }` (lugares por
-- categoría). Ahora: `{ enabled, rows: [ { slots, categories: ['A','B'] } ] }`:
-- cada fila reserva N lugares de la ventana de candidatos para canciones de
-- CUALQUIERA de sus categorías. Las filas se cubren en orden; una canción ya
-- contada para una fila no cuenta para la siguiente.
--
-- · `pantalla__rotacion_filas(...)` cubre las filas y devuelve cuántas sumó.
--   La llama `pantalla_refill_candidates` (20261023180100).
-- · `pantalla_set_category_rotation` normaliza y guarda las filas. Mientras la
--   versión nueva de refill no esté aplicada, también deja `slots` derivado
--   (las filas de una sola categoría, exactas; las de varias, en la primera)
--   para que la versión vieja siga funcionando.
-- · Lo guardado con el formato viejo se convierte a filas.

create or replace function public.pantalla__rotacion_filas(
  _event_id uuid, _need integer, _current uuid, _set uuid, _rows jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row     jsonb;
  v_cats    text[];
  v_slots   integer;
  v_claimed uuid[] := '{}';
  v_mine    uuid[];
  v_falta   integer;
  v_need    integer := _need;
  v_added   integer := 0;
begin
  for v_row in select * from jsonb_array_elements(coalesce(_rows, '[]'::jsonb)) loop
    exit when v_need <= 0;
    v_slots := greatest(0, coalesce((v_row->>'slots')::int, 0));
    select coalesce(array_agg(c), '{}') into v_cats
      from jsonb_array_elements_text(coalesce(v_row->'categories', '[]'::jsonb)) c;
    continue when v_slots = 0 or cardinality(v_cats) = 0;

    -- Candidatas que ya ocupan lugares de esta fila (sin repetir las de filas anteriores).
    select coalesce(array_agg(id), '{}') into v_mine from (
      select id from pantalla_playlist_items
       where event_id = _event_id and is_active_candidate and category = any(v_cats)
         and id is distinct from _current and not (id = any(v_claimed))
       order by position limit v_slots) s;
    v_claimed := v_claimed || v_mine;

    v_falta := least(v_slots - cardinality(v_mine), v_need);
    continue when v_falta <= 0;

    with elegibles as (
      select pi.id from pantalla_playlist_items pi
       where pi.event_id = _event_id and pi.enabled and not pi.is_active_candidate
         and pi.category = any(v_cats)
         and pi.id is distinct from _current
         and coalesce(pi.last_status, 'idle') <> 'rejected'
         and (_set is null or exists (
           select 1 from pantalla_set_items si where si.set_id = _set and si.item_id = pi.id))
       order by (pi.last_status = 'played_recently') asc, pi.times_played asc, pi.position asc, pi.created_at asc
       limit v_falta
    ), sumadas as (
      update pantalla_playlist_items pi set
        is_active_candidate = true, last_status = 'active', last_status_changed_at = now(),
        consecutive_last_place_rounds = 0, pos_votes = 0, neg_votes = 0, score = 0
      from elegibles e where pi.id = e.id
      returning pi.id
    )
    select coalesce(array_agg(id), '{}') into v_mine from sumadas;

    v_claimed := v_claimed || v_mine;
    v_added := v_added + cardinality(v_mine);
    v_need := v_need - cardinality(v_mine);
  end loop;
  return v_added;
end $function$;

create or replace function public.pantalla_set_category_rotation(_event_id uuid, _rotation jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rows  jsonb := '[]'::jsonb;
  v_row   jsonb;
  v_cats  jsonb;
  v_slots integer;
  v_leg   jsonb := jsonb_build_object('A', 0, 'B', 0, 'C', 0, 'D', 0);
  v       jsonb;
begin
  if not public.pantalla_can_manage(_event_id) then raise exception 'not authorized'; end if;

  -- Filas: hasta 8, lugares 0..15, categorías válidas sin repetir.
  for v_row in select * from jsonb_array_elements(coalesce(_rotation->'rows', '[]'::jsonb)) limit 8 loop
    v_slots := greatest(0, least(15, coalesce((v_row->>'slots')::int, 0)));
    select coalesce(jsonb_agg(distinct c order by c), '[]'::jsonb) into v_cats
      from jsonb_array_elements_text(coalesce(v_row->'categories', '[]'::jsonb)) c
     where c in ('A', 'B', 'C', 'D');
    v_rows := v_rows || jsonb_build_array(jsonb_build_object('slots', v_slots, 'categories', v_cats));
    -- Formato viejo, para la versión anterior de refill: en la primera categoría.
    if v_slots > 0 and jsonb_array_length(v_cats) > 0 then
      v_leg := jsonb_set(v_leg, array[v_cats->>0], to_jsonb(least(15, (v_leg->>(v_cats->>0))::int + v_slots)));
    end if;
  end loop;

  v := jsonb_build_object('enabled', coalesce((_rotation->>'enabled')::boolean, false),
                          'rows', v_rows, 'slots', v_leg);
  update pantalla_events set category_rotation = v where id = _event_id;
  perform public.pantalla_refill_candidates(_event_id);
  return v;
end $function$;

-- Lo guardado con el formato viejo (sólo `slots`) pasa a filas: una por categoría con lugares.
update pantalla_events
   set category_rotation = category_rotation || jsonb_build_object('rows', (
         select coalesce(jsonb_agg(jsonb_build_object('slots', (category_rotation->'slots'->>c)::int,
                                                      'categories', jsonb_build_array(c)) order by c), '[]'::jsonb)
           from unnest(array['A', 'B', 'C', 'D']) c
          where coalesce((category_rotation->'slots'->>c)::int, 0) > 0))
 where category_rotation is not null and not (category_rotation ? 'rows');
