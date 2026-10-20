-- ─── DJ Democracy: límites a las reacciones del público ─────────────────────
--
-- El celular inserta directo en `pantalla_reactions` (la RLS sólo exige
-- user_id = auth.uid()). Sin más control, un cliente modificado podía:
--   · mandar reacciones sin límite de frecuencia (inundar la TV),
--   · mandar reacciones gigantes sin haberlas ganado (is_giant = true),
--   · reaccionar en eventos que no están en vivo,
--   · mandar textos largos como "emoji".
--
-- Trigger BEFORE INSERT, igual que el original: lo que no corresponde se
-- DESCARTA EN SILENCIO (RETURN NULL), sin error, así el celular no cambia de
-- comportamiento:
--   · evento que no está en vivo → descartada
--   · emoji vacío o de más de 16 caracteres → descartada
--   · otra reacción del mismo usuario en el mismo evento hace < 400 ms → descartada
--   · is_giant → se fuerza a false: todavía no hay forma de ganarla
-- El staff del evento (pantalla_can_manage) no tiene estos límites.

create index if not exists pantalla_reactions_limite_idx
  on public.pantalla_reactions (event_id, user_id, created_at desc);

create or replace function public.pantalla__reaccion_limite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.pantalla_can_manage(new.event_id) then
    return new;
  end if;

  if not exists (select 1 from pantalla_events where id = new.event_id and status = 'live') then
    return null;
  end if;

  if new.emoji is null or length(btrim(new.emoji)) = 0 or length(new.emoji) > 16 then
    return null;
  end if;

  if exists (select 1 from pantalla_reactions
             where event_id = new.event_id and user_id = new.user_id
               and created_at > now() - interval '400 milliseconds') then
    return null;
  end if;

  new.is_giant := false;
  new.created_at := now();
  return new;
end $$;

revoke execute on function public.pantalla__reaccion_limite() from public, anon, authenticated;

drop trigger if exists pantalla_reactions_limite on public.pantalla_reactions;
create trigger pantalla_reactions_limite
  before insert on public.pantalla_reactions
  for each row execute function public.pantalla__reaccion_limite();
