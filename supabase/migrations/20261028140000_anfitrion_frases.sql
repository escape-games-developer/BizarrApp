-- Frases del Anfitrión: bibliotecas de ALIENTO y DESALIENTO que la tablet le
-- propone decirle a cada participante según vaya ganando o perdiendo (Duelo,
-- Follow the Leader, Personal Trainer). Las cargan Admin y Producción desde
-- Ajustes → General; se prenden o apagan con `admin_ui_config.general.frasesAnfitrion`.
-- Las bibliotecas con nombre llegan en 20261028150000.

create table public.anfitrion_frases (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null,
  texto      text not null,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint anfitrion_frases_tipo check (tipo in ('aliento', 'desaliento')),
  constraint anfitrion_frases_texto check (char_length(btrim(texto)) between 3 and 200 and texto = btrim(texto))
);

create unique index anfitrion_frases_unica on public.anfitrion_frases (tipo, lower(texto));

alter table public.anfitrion_frases enable row level security;

create policy "anfitrion_frases: admin lee" on public.anfitrion_frases
  for select to authenticated using (public.is_admin());
create policy "anfitrion_frases: admin inserta" on public.anfitrion_frases
  for insert to authenticated with check (public.is_admin());
create policy "anfitrion_frases: admin edita" on public.anfitrion_frases
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "anfitrion_frases: admin borra" on public.anfitrion_frases
  for delete to authenticated using (public.is_admin());

revoke all on table public.anfitrion_frases from public, anon, authenticated;
grant select, delete on table public.anfitrion_frases to authenticated;
grant insert (tipo, texto), update (texto) on table public.anfitrion_frases to authenticated;
grant all on table public.anfitrion_frases to service_role;

-- La tablet del Anfitrión ve las altas y bajas en vivo.
alter publication supabase_realtime add table public.anfitrion_frases;

insert into public.anfitrion_frases (tipo, texto) values
  ('aliento', '¡Dale, máquina! ¡Hoy estás más afilado que cuchillo de carnicero!'),
  ('aliento', '¡Vamos, carajo! ¡Tenés más aguante que un Nokia 1100!'),
  ('aliento', '¡Dale, campeón! ¡Que no se diga que viniste solamente a escabiar!'),
  ('aliento', '¡Estás más encendido que parrilla un domingo al mediodía!'),
  ('aliento', '¡Dale, bestia! ¡Hacé que tu vieja se arrepienta de haberte subestimado!'),
  ('aliento', '¡Vamos, loco! ¡Tenés más huevos que una fábrica de mayonesa!'),
  ('aliento', '¡Sos una máquina, papá! ¡Ni la AFIP te puede parar!'),
  ('aliento', '¡Metéle garra, que hoy hasta tu ex te aplaudiría!'),
  ('aliento', '¡Dale, fenómeno! ¡Estás jugando como si debieras tres meses de alquiler!'),
  ('aliento', '¡Hoy sos Gardel, Messi y el Diego, todo junto y medio en pedo!'),
  ('aliento', '¡Rompela toda, que mañana volvés a ser un ciudadano común!'),
  ('aliento', '¡Dale, titán! ¡Tenés más potencia que ventilador de chino!'),
  ('aliento', '¡Estás más inspirado que un tachero hablando de política!'),
  ('aliento', '¡Vamos, animal! ¡Que el éxito no se consigue mirando el techo!'),
  ('aliento', '¡Dale, campeón! ¡Hoy no te para ni un piquete en la 9 de Julio!'),
  ('aliento', '¡Sos más peligroso que una suegra con información privilegiada!'),
  ('aliento', '¡Seguí así, papá! ¡Estás más firme que milanesa de bodegón!'),
  ('aliento', '¡Dale, maestro! ¡Que hoy el universo está de tu lado, la concha de la lora!'),
  ('aliento', '¡Estás intratable, hermano! ¡Ni el VAR te puede cagar esta!'),
  ('aliento', '¡Vamos, loco! ¡Demostrá que no sos solamente una cara bonita y un hígado castigado!'),
  ('aliento', '¡Dale, hijo de puta, que hoy naciste para hacer historia y romper las pelotas!'),
  ('aliento', '¡Jugá como si el premio fuera un asado gratis para veinte personas!'),
  ('aliento', '¡Dale, papá! ¡Que hoy te tienen que sacar en andas como al Diego!'),
  ('aliento', '¡Hoy sos el terror de los rivales y el orgullo del bartender!'),
  ('aliento', '¡Dale, bestia, que hoy estás para que te hagan una estatua en el Obelisco!'),
  ('desaliento', '¡Sos más lento que trámite en ANSES un viernes!'),
  ('desaliento', '¡Dale, hermano! ¡Mi abuela con ciática juega mejor que vos!'),
  ('desaliento', '¡Tenés menos reacción que un lunes a las siete de la mañana!'),
  ('desaliento', '¡Sos más inútil que cenicero de moto!'),
  ('desaliento', '¡Jugás peor que la Selección de Sampaoli, hermano!'),
  ('desaliento', '¡Tenés menos puntería que borracho jugando al metegol!'),
  ('desaliento', '¡Aflojá, campeón! ¡Hasta el WiFi del subte responde más rápido!'),
  ('desaliento', '¡Sos un peligro! ¡Pero para tu propio equipo, salame!'),
  ('desaliento', '¡Tenés menos coordinación que un grupo de WhatsApp organizando una salida!'),
  ('desaliento', '¡Dale, maestro! ¡Te está ganando alguien que ni entendió las reglas!'),
  ('desaliento', '¡Sos más frío que paty de estación de servicio!'),
  ('desaliento', '¡Qué manera de pasar vergüenza, papá! ¡Y encima gratis!'),
  ('desaliento', '¡Tenés menos futuro que un helado al sol en enero!'),
  ('desaliento', '¡Jugás con menos ganas que empleado un lunes después de un feriado!'),
  ('desaliento', '¡Hermano, lo tuyo no es mala suerte, es falta de talento!'),
  ('desaliento', '¡Tenés menos luces que un boliche clausurado!'),
  ('desaliento', '¡Dale, fenómeno! ¡No te pedimos que seas Messi, pero tampoco un cono!'),
  ('desaliento', '¡Sos más perdido que turista en Constitución a las tres de la mañana!'),
  ('desaliento', '¡Hasta tu ex tiene más chances de volver que vos de ganar esto!'),
  ('desaliento', '¡Retirate con dignidad, papá! ¡Todavía estás a tiempo de decir que fue una apuesta!'),
  ('desaliento', '¡Sos la prueba viviente de que participar no siempre es importante!'),
  ('desaliento', '¡Tu talento está en modo avión, hermano!'),
  ('desaliento', '¡Qué desastre, hermano! ¡Hasta tu vieja está alentando al otro!'),
  ('desaliento', '¡No te preocupes, campeón, el ridículo también es una forma de entretenimiento!'),
  ('desaliento', '¡Con ese rendimiento, hasta el premio consuelo te rechaza!');

notify pgrst, 'reload schema';
