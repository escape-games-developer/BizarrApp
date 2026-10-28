-- Frases del Anfitrión agrupadas en BIBLIOTECAS con nombre. Admin y Producción
-- marcan cuáles están en uso (una o varias: se mezclan) y pueden armar una
-- nueva copiando frases de las otras. Las frases que ya estaban quedan en
-- «Bizarren picante»; se suman «Humor de pantalla» y «90/2000».

create table public.anfitrion_frases_bibliotecas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  activa     boolean not null default false,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint anfitrion_frases_bibliotecas_nombre check (char_length(btrim(nombre)) between 2 and 40 and nombre = btrim(nombre))
);

create unique index anfitrion_frases_bibliotecas_unica on public.anfitrion_frases_bibliotecas (lower(nombre));

alter table public.anfitrion_frases_bibliotecas enable row level security;

create policy "anfitrion_frases_bibliotecas: admin lee" on public.anfitrion_frases_bibliotecas
  for select to authenticated using (public.is_admin());
create policy "anfitrion_frases_bibliotecas: admin inserta" on public.anfitrion_frases_bibliotecas
  for insert to authenticated with check (public.is_admin());
create policy "anfitrion_frases_bibliotecas: admin edita" on public.anfitrion_frases_bibliotecas
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "anfitrion_frases_bibliotecas: admin borra" on public.anfitrion_frases_bibliotecas
  for delete to authenticated using (public.is_admin());

revoke all on table public.anfitrion_frases_bibliotecas from public, anon, authenticated;
grant select, delete on table public.anfitrion_frases_bibliotecas to authenticated;
grant insert (nombre, activa), update (nombre, activa) on table public.anfitrion_frases_bibliotecas to authenticated;
grant all on table public.anfitrion_frases_bibliotecas to service_role;

alter publication supabase_realtime add table public.anfitrion_frases_bibliotecas;

insert into public.anfitrion_frases_bibliotecas (nombre, activa, created_at) values
  ('Bizarren picante',  false, now() - interval '2 seconds'),
  ('Humor de pantalla', true,  now() - interval '1 second'),
  ('90/2000',           false, now());

-- Cada frase pertenece a una biblioteca; borrar la biblioteca borra sus frases.
alter table public.anfitrion_frases
  add column biblioteca_id uuid references public.anfitrion_frases_bibliotecas(id) on delete cascade;

update public.anfitrion_frases
   set biblioteca_id = (select id from public.anfitrion_frases_bibliotecas where nombre = 'Bizarren picante')
 where biblioteca_id is null;

alter table public.anfitrion_frases alter column biblioteca_id set not null;

-- La misma frase puede estar en varias bibliotecas (así se arman las mezclas).
drop index if exists public.anfitrion_frases_unica;
create unique index anfitrion_frases_unica on public.anfitrion_frases (biblioteca_id, tipo, lower(texto));
create index anfitrion_frases_biblioteca on public.anfitrion_frases (biblioteca_id);

grant insert (biblioteca_id, tipo, texto) on table public.anfitrion_frases to authenticated;

insert into public.anfitrion_frases (biblioteca_id, tipo, texto)
select b.id, v.tipo, v.texto
  from public.anfitrion_frases_bibliotecas b
  join (values
  ('Humor de pantalla', 'aliento', '¡PARÁ UN POCO, MESSI! ¡DEJÁ ALGO PARA LOS DEMÁS!'),
  ('Humor de pantalla', 'aliento', '¡EPA! ¡MIRÁ QUIÉN SE LEVANTÓ INSPIRADO!'),
  ('Humor de pantalla', 'aliento', '¡QUÉ NIVEL, MARIBEL! ¡NI VOS TE LO CREÉS!'),
  ('Humor de pantalla', 'aliento', '¡SE AGRANDÓ CHACARITA, SEÑORES!'),
  ('Humor de pantalla', 'aliento', '¡ESTÁS MÁS FINO QUE SÁNGUCHE DE MIGA!'),
  ('Humor de pantalla', 'aliento', '¡BUENO, BUENO! ¡TENEMOS UN PROFESIONAL!'),
  ('Humor de pantalla', 'aliento', '¡MIRÁ VOS! ¡Y EN TU CASA NO TE TENÍAN FE!'),
  ('Humor de pantalla', 'aliento', '¡TRANQUILO, CAMPEÓN! ¡NO ES LA FINAL DEL MUNDO!'),
  ('Humor de pantalla', 'aliento', '¡QUÉ JUGADÓN! ¡TE MERECÉS OTRA PORCIÓN DE PAPAS!'),
  ('Humor de pantalla', 'aliento', '¡QUE ALGUIEN LE AVISE A SCALONI!'),
  ('Humor de pantalla', 'aliento', '¡MIRÁ CÓMO ACTIVÓ EL MUCHACHO!'),
  ('Humor de pantalla', 'aliento', '¡HOY ESTÁS MÁS DULCE QUE DULCE DE LECHE!'),
  ('Humor de pantalla', 'aliento', '¡APA! ¡EL FERNET TE DIO SUPERPODERES!'),
  ('Humor de pantalla', 'aliento', '¡VINO POR UNA BIRRA Y SE LLEVÓ LA GLORIA!'),
  ('Humor de pantalla', 'aliento', '¡SEÑORES, TENEMOS UN TAPADO!'),
  ('Humor de pantalla', 'aliento', '¡QUÉ ELEGANCIA, LA DE FRANCIA!'),
  ('Humor de pantalla', 'aliento', '¡NO TE TENÍAMOS FE Y NOS CERRASTE LA BOCA!'),
  ('Humor de pantalla', 'aliento', '¡ESTÁS PARA QUE TE HAGAN UN STICKER DE WHATSAPP!'),
  ('Humor de pantalla', 'aliento', '¡ASÍ SE HACE, PAPÁ! ¡SIN DESPEINARSE!'),
  ('Humor de pantalla', 'aliento', '¡HOY DORMÍS CON LA MEDALLA PUESTA!'),
  ('Humor de pantalla', 'aliento', '¡APA, APARECIÓ EL TALENTO!'),
  ('Humor de pantalla', 'aliento', '¡HOY INVITÁS VOS, FIGURA!'),
  ('Humor de pantalla', 'aliento', '¡PERO MIRÁ QUÉ JUGADORAZO!'),
  ('Humor de pantalla', 'aliento', '¡QUE LO LLEVEN EN ANDAS!'),
  ('Humor de pantalla', 'aliento', '¡EL PIBE ESTÁ EN LLAMAS!'),
  ('Humor de pantalla', 'desaliento', '¡BUENO, LO IMPORTANTE ES QUE VINISTE!'),
  ('Humor de pantalla', 'desaliento', '¡TRANQUI, MESSI! ¡TODAVÍA NO TE LLAMÓ SCALONI!'),
  ('Humor de pantalla', 'desaliento', '¡EPA! ¡ALGUIEN SE OLVIDÓ DE TRAER EL TALENTO!'),
  ('Humor de pantalla', 'desaliento', '¡NO PASA NADA, CAMPEÓN! ¡EL BAR SIGUE ABIERTO!'),
  ('Humor de pantalla', 'desaliento', '¡TE TENÍAMOS FE... POQUITA, PERO FE!'),
  ('Humor de pantalla', 'desaliento', '¡MAMITA QUERIDA! ¡QUÉ MANERA DE COMPLICAR LO FÁCIL!'),
  ('Humor de pantalla', 'desaliento', '¡LO BUENO ES QUE NADIE ESTÁ GRABANDO! ¿O SÍ?'),
  ('Humor de pantalla', 'desaliento', '¡TRANQUILO, QUE PARA PEDIR PAPAS NO HACE FALTA GANAR!'),
  ('Humor de pantalla', 'desaliento', '¡ESTÁS JUGANDO EN MODO AHORRO DE ENERGÍA!'),
  ('Humor de pantalla', 'desaliento', '¡MIRÁ EL LADO BUENO! ¡PEOR SERÍA ESTAR LABURANDO!'),
  ('Humor de pantalla', 'desaliento', '¡NO FUE TU MEJOR MOMENTO, DIGAMOS TODO!'),
  ('Humor de pantalla', 'desaliento', '¡TENÉS MENOS SUERTE QUE EL QUE PIDE UBER CUANDO LLUEVE!'),
  ('Humor de pantalla', 'desaliento', '¡HAY QUE PRACTICAR UN POQUITO, ME PARECE!'),
  ('Humor de pantalla', 'desaliento', '¡BUENO, AL MENOS TENÉS BUENA PRESENCIA!'),
  ('Humor de pantalla', 'desaliento', '¡VAMOS TODAVÍA! ¡QUE PERDER TAMBIÉN ES PARTICIPAR!'),
  ('Humor de pantalla', 'desaliento', '¡NO TE PREOCUPES, LO TUYO ES MÁS LO SOCIAL!'),
  ('Humor de pantalla', 'desaliento', '¡ME PARECE QUE EL FERNET ESTÁ JUGANDO POR VOS!'),
  ('Humor de pantalla', 'desaliento', '¡QUÉ LINDO ES VERTE INTENTAR!'),
  ('Humor de pantalla', 'desaliento', '¡HOY NO ES TU DÍA, PERO MAÑANA QUIÉN TE DICE!'),
  ('Humor de pantalla', 'desaliento', '¡UN APLAUSO POR LA ACTITUD, PORQUE POR EL RESULTADO...!'),
  ('Humor de pantalla', 'desaliento', '¡BUENO, LA INTENCIÓN ESTUVO!'),
  ('Humor de pantalla', 'desaliento', '¡HAY QUE REVISAR ESE GPS!'),
  ('Humor de pantalla', 'desaliento', '¡TE FALTÓ UN POQUITITO... DE TODO!'),
  ('Humor de pantalla', 'desaliento', '¡VOLVÉ A CONFIGURACIÓN DE FÁBRICA!'),
  ('Humor de pantalla', 'desaliento', '¡EL PREMIO PUEDE ESPERAR SENTADO!'),
  ('90/2000', 'aliento', '¡ES UNA NENAAAA, DIRÍA BAMBINO! ¡QUÉ BELLEZA!'),
  ('90/2000', 'aliento', '¡TAC, TAC, TAC! ¡ESTÁS INTRATABLE, PAPÁ!'),
  ('90/2000', 'aliento', '¡APLAUSOS, MEDALLA Y BESO DE SUSANA!'),
  ('90/2000', 'aliento', '¡SOS UN CAPO TOTAL, NIVEL MAXI CYBER!'),
  ('90/2000', 'aliento', '¡PARÁ, MOSTRO! ¡NI EN EL FIFA 98 HACÍAS ESO!'),
  ('90/2000', 'aliento', '¡ESTÁS MÁS AFILADO QUE EL WINDOWS XP RECIÉN INSTALADO!'),
  ('90/2000', 'aliento', '¡QUÉ JUGADOR, NENE! ¡TE MERECÉS UN LLAMADO DE SOFOVICH!'),
  ('90/2000', 'aliento', '¡CHAU, CHAU, CHAUUU! ¡QUÉ MANERA DE JUGAR!'),
  ('90/2000', 'aliento', '¡ESTÁS PARA GANARTE UN AUTO EN EL PROGRAMA DE SUSANA!'),
  ('90/2000', 'aliento', '¡TE SALIÓ REDONDITO, COMO CD VIRGEN RECIÉN GRABADO!'),
  ('90/2000', 'aliento', '¡MIRÁ QUÉ JUGADA, PAPÁ! ¡NI EL TRUCO DEL AGE OF EMPIRES!'),
  ('90/2000', 'aliento', '¡UN APLAUSO, QUE SE ESCUCHE HASTA EN EL CYBER!'),
  ('90/2000', 'aliento', '¡SE AGRANDÓ EL PIBE! ¡AHORA QUIERE SALIR EN VIDEOMATCH!'),
  ('90/2000', 'aliento', '¡HOY TENÉS MÁS ONDA QUE UN NOKIA CON CARCASA INTERCAMBIABLE!'),
  ('90/2000', 'aliento', '¡ESTÁS JUGANDO CON TODOS LOS TRUCOS ACTIVADOS!'),
  ('90/2000', 'aliento', '¡PERO QUÉ NIVEL, NENE! ¡TE FALTA EL TROFEO DE TELEFÉ!'),
  ('90/2000', 'aliento', '¡ESPECTACULAR, ESPECTACULAR! ¡PONÉ LA REPETICIÓN!'),
  ('90/2000', 'aliento', '¡SOS MÁS GRANDE QUE EL LOCUTORIO CON INTERNET!'),
  ('90/2000', 'aliento', '¡ESTO ES PARA GRABARLO EN VHS Y GUARDARLO!'),
  ('90/2000', 'aliento', '¡QUE PASE EL QUE SIGUE! ¡ESTE MUCHACHO ESTÁ EN OTRA LIGA!'),
  ('90/2000', 'aliento', '¡ES UNA MANTECA, NENE!'),
  ('90/2000', 'aliento', '¡SE VIENE EL ESTALLIDO!'),
  ('90/2000', 'aliento', '¡QUÉ MOMENTO, SEÑORES!'),
  ('90/2000', 'aliento', '¡SOS UN SHOWMAN, PAPÁ!'),
  ('90/2000', 'aliento', '¡ESTÁS PARA EL PRIME TIME!'),
  ('90/2000', 'desaliento', '¡NOOO, NENE! ¡TE FALTÓ EL ÚLTIMO FICHÍN!'),
  ('90/2000', 'desaliento', '¡ESTÁS MÁS COLGADO QUE EL ARES BAJANDO UNA CANCIÓN!'),
  ('90/2000', 'desaliento', '¡QUÉ PASÓ, CAMPEÓN! ¿SE TE CORTÓ EL DIAL-UP?'),
  ('90/2000', 'desaliento', '¡TE SALIÓ MÁS TRUCHO QUE CD COMPRADO EN LA SALADA!'),
  ('90/2000', 'desaliento', '¡TENÉS MENOS REACCIÓN QUE WINDOWS 98 CON 20 VENTANAS!'),
  ('90/2000', 'desaliento', '¡BUENO, POR LO MENOS NO TE SACARON DEL CYBER!'),
  ('90/2000', 'desaliento', '¡TE FALTÓ PRÁCTICA, NO TODO SE ARREGLA CON EL KONAMI CODE!'),
  ('90/2000', 'desaliento', '¡HERMANO, TE CLAVARON EL VISTO ANTES DE QUE EXISTIERA!'),
  ('90/2000', 'desaliento', '¡MÁS PERDIDO QUE EL CONTROL REMOTO DE LA VIDEOCASSETTERA!'),
  ('90/2000', 'desaliento', '¡TE QUEDASTE CARGANDO COMO EL MSN UN DOMINGO!'),
  ('90/2000', 'desaliento', '¡QUÉ JUGADA, PAPÁ! ¡DIRECTO A VIDEOMATCH, PERO A LOS BLOOPERS!'),
  ('90/2000', 'desaliento', '¡NO TE ENOJES, QUE ESTO NO ES CUESTIÓN DE PESO!'),
  ('90/2000', 'desaliento', '¡TE FALTÓ MÁS PILA QUE AL DISCMAN EN EL COLECTIVO!'),
  ('90/2000', 'desaliento', '¡ESE INTENTO NECESITA UN SERVICE Y DOS DISKETTES!'),
  ('90/2000', 'desaliento', '¡LA PRÓXIMA PEDÍ AYUDA AL LIBRITO DE TRUCOS!'),
  ('90/2000', 'desaliento', '¡BUENO, CAMPEÓN! ¡PODÉS VOLVER A EMPEZAR COMO EL WINDOWS!'),
  ('90/2000', 'desaliento', '¡TE DESCONFIGURASTE COMO EL CONTROL DEL SEGA!'),
  ('90/2000', 'desaliento', '¡NI CON EL GAME SHARK LEVANTÁS ESTA PARTIDA!'),
  ('90/2000', 'desaliento', '¡ESTÁS MÁS DESORIENTADO QUE UN TAMAGOTCHI SIN DUEÑO!'),
  ('90/2000', 'desaliento', '¡TE FALTÓ UN POQUITO! ¡COMO AL MP3 CUANDO SE QUEDABA SIN PILA!'),
  ('90/2000', 'desaliento', '¡MAMITA, QUERIDA!'),
  ('90/2000', 'desaliento', '¡NO ME QUEMÉS, HERMANO!'),
  ('90/2000', 'desaliento', '¡UN POQUITO DE POR FAVOR!'),
  ('90/2000', 'desaliento', '¡TE FUISTE AL PASTO, PERO PARA EL OTRO LADO!'),
  ('90/2000', 'desaliento', '¡DIRECTO A LOS BLOOPERS DE FIN DE AÑO!')
  ) as v(biblioteca, tipo, texto) on v.biblioteca = b.nombre;

notify pgrst, 'reload schema';
