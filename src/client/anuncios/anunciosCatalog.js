/**
 * Anuncios de juegos y experiencias de Escenario (Admin → 📢 Anunciar).
 *
 * El Admin anuncia escribiendo `game_state.active_placa` (la autoridad del
 * anuncio vigente); un trigger registra cada anuncio en `client_announcements`
 * con un id propio (migración 20261006024522_client_announcements_v1).
 *
 * Acá vive sólo la presentación de cada placa: el texto de la notificación del
 * navegador y a dónde lleva al tocarla. Los textos no se guardan en la base.
 *
 * `url` reutiliza el deep-link público de la WebApp (`?view=`), el mismo que ya
 * usa el push del Duelo. El Duelo vive en Escenario.
 *
 * `postulacion`: juegos donde el cliente se postula (Duelo, FTL, PT). Su placa
 * NO avisa ni muestra PRÓXIMAMENTE: la única notificación es la de la
 * convocatoria abierta, que lleva directo a postularse (pushDuelo /
 * pushConvocatoria). Un aviso previo sólo agregaba un paso sin botón.
 */
export const ANUNCIOS = Object.freeze({
  game_rey:      { emoji: "🎰", nombre: "Rey del Orto",       vista: "games",     cuerpo: "¡Se viene el sorteo!" },
  game_trivia:   { emoji: "🧠", nombre: "Desafío Demente",    vista: "games",     cuerpo: "¡Se viene el juego!" },
  game_suma:     { emoji: "🔢", nombre: "Sumate que sumamos", vista: "games",     cuerpo: "¡Se viene el juego!" },
  game_palabra:  { emoji: "🔤", nombre: "Arma la palabra",    vista: "games",     cuerpo: "¡Se viene el juego!" },
  duelo:         { emoji: "🎤", nombre: "Duelo de Talentos",  vista: "escenario", cuerpo: "¡Se viene el Duelo!",        postulacion: true },
  escenario_ftl: { emoji: "💃", nombre: "Follow the Leader",  vista: "escenario", cuerpo: "¡Se viene en el escenario!", postulacion: true },
  escenario_pt:  { emoji: "🏋️", nombre: "Personal Trainer",   vista: "escenario", cuerpo: "¡Se viene en el escenario!", postulacion: true },
  escenario:     { emoji: "🎤", nombre: "Escenario Bizarren", vista: "escenario", cuerpo: "¡El protagonista sos vos!" },
});

export const anuncioDe = (placa) => (Object.hasOwn(ANUNCIOS, placa) ? ANUNCIOS[placa] : null);

/** URL que abre la notificación: la sección de la experiencia anunciada. */
export const urlDeAnuncio = (placa) => `/?view=${anuncioDe(placa)?.vista ?? "novedades"}`;

/**
 * Experiencia de Escenario anunciada y todavía sin convocatoria: Escenario
 * muestra su standby genérico, así que App le suma la franja PRÓXIMAMENTE.
 * (Juegos tiene sus propias cards Próximamente.)
 */
export function escenarioAnunciado(gameState) {
  const placa = gameState?.active_placa;
  const a = anuncioDe(placa);
  return a?.vista === "escenario" && !a.postulacion && !gameState?.active_escenario ? placa : null;
}
