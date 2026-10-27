-- Biblioteca de Escenario (Follow the Leader / Personal Trainer): recorte de
-- cada tema, como los videos de DJ Democracy. `inicio_seg` = desde dónde
-- arranca; `fin_seg` = dónde corta (null = hasta el final del video).
-- Viajan en game_state.escenario_video como trimStart / trimEnd.

alter table public.escenario_videos add column if not exists inicio_seg integer not null default 0;
alter table public.escenario_videos add column if not exists fin_seg integer;

alter table public.escenario_videos add constraint escenario_videos_recorte_valido
  check (inicio_seg >= 0 and inicio_seg <= 7200
         and (fin_seg is null or (fin_seg > inicio_seg and fin_seg <= 7200)));

notify pgrst, 'reload schema';
