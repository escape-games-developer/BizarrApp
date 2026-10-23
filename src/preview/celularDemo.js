import { demoDuelo, demoSumaRound, demoPalabraRound, demoRey } from "../bigscreen/demosDiseno";

/**
 * Qué muestra el celular en cada estado de cada juego, para la vista previa
 * del Diseñador (vista 📱 Celular). Devuelve los props de la vista REAL del
 * cliente (JuegosView / EscenarioView) con datos de muestra en `demo`: con
 * ellos las vistas no consultan ni escriben nada.
 *
 *   celularDe(juego, estado) → { seccion: 'juegos'|'escenario', props }
 *
 * Los estados de cada juego están en admin/disenador/vistasJuegos.js.
 */

/** El cliente de la vista previa: logueado, con equipo y ubicación verificada. */
export const USUARIO_DEMO = Object.freeze({
  id: "demo-yo", name: "Marcelo", registered: true, team: "batata", avatar_emoji: "🦁",
});

const PREGUNTA = Object.freeze({
  text: "¿Cuál es el mejor bar de Buenos Aires?",
  options: ["Bizarren", "El de la esquina", "Ninguno", "Todos"], correct: 0,
});

const YO_EN_GRUPO = [
  { user_id: USUARIO_DEMO.id, name: "MARCELO", avatar_emoji: "🦁", assigned_number: 9 },
  { user_id: "d2", name: "SOFI", avatar_emoji: "🦄", assigned_number: 7 },
  { user_id: "d3", name: "JUAN", avatar_emoji: "🎸", assigned_number: 7 },
];

const OTRO = { user_id: "d1", turn_id: "demo-turno", name: "Valentina", avatar_emoji: "💃", playing: true };
const VOTACION_FTL = {
  pct: 64, myVote: "up",
  totals: { up: 12, down: 5, up_pct: 71, down_pct: 29, total: 17 },
};

const juegos = (activeGame, gameState, demo = null) =>
  ({ seccion: "juegos", props: { activeGame, gameState, demo } });
const escenario = (activeEscenario, gameState, demo) =>
  ({ seccion: "escenario", props: { activeEscenario, gameState: { active_escenario: activeEscenario, ...gameState }, demo } });

const REY = {
  anuncio:   () => juegos(null, { active_placa: "game_rey" }),
  esperando: () => juegos("rey del orto", demoRey("reposo")),
  sorteo:    () => juegos("rey del orto", demoRey("sorteo")),
  ganaste:   () => juegos("rey del orto", { ...demoRey("ganador"), raffle_winner_id: USUARIO_DEMO.id, raffle_prize: "TRAGO GRATIS" }),
  perdiste:  () => juegos("rey del orto", { ...demoRey("ganador"), raffle_winner_id: "otro", raffle_prize: "TRAGO GRATIS" }),
  cancelado: () => juegos("rey del orto", demoRey("cancelado")),
};

const trivia = (fase, demo, extra = {}) =>
  juegos("trivia", { active_game: "trivia", trivia_state: fase, trivia_question: 0, trivia_round_id: "demo", ...extra }, demo);
const TRIVIA = {
  anuncio:   () => juegos(null, { active_placa: "game_trivia" }),
  esperando: () => trivia("idle", { question: null }),
  pregunta:  () => trivia("active", { question: PREGUNTA, myVote: null }),
  votaste:   () => trivia("active", { question: PREGUNTA, myVote: 0 }),
  respuesta: () => trivia("revealed", { question: PREGUNTA, myVote: 0 }),
  final:     () => trivia("finished", { question: PREGUNTA, myVote: 0 }, { trivia_winner_team: "batata" }),
};

const SUMA = {
  anuncio:     () => juegos(null, { active_placa: "game_suma" }),
  "tu-numero": () => juegos("suma", { active_game: "suma" }, { round: demoSumaRound("en-juego"), miNumero: 7 }),
  ganaron:     () => juegos("suma", { active_game: "suma" },
    { round: { ...demoSumaRound("ganadores"), winner_group: YO_EN_GRUPO }, miNumero: 9 }),
  terminada:   () => juegos("suma", { active_game: "suma" }, { round: demoSumaRound("cerrada"), miNumero: 7 }),
};

const PALABRA = {
  anuncio:    () => juegos(null, { active_placa: "game_palabra" }),
  "tu-letra": () => juegos("palabra", { active_game: "palabra" }, { round: demoPalabraRound("en-juego"), miLetra: "V" }),
  ganaron:    () => juegos("palabra", { active_game: "palabra" },
    { round: { ...demoPalabraRound("en-juego"), status: "finished", winner_group: YO_EN_GRUPO }, miLetra: "V" }),
  terminada:  () => juegos("palabra", { active_game: "palabra" }, { round: demoPalabraRound("entre-rondas"), miLetra: "V" }),
};

const DUELO = {
  postulacion: () => escenario("duelo", {}, { misPostulacion: null, round: null }),
  postulado:   () => escenario("duelo", {}, { misPostulacion: { status: "waiting" }, round: null }),
  votacion:    () => escenario("duelo", {}, { misPostulacion: null, ...demoDuelo("votacion") }),
  resultado:   () => escenario("duelo", { duelo_state: "revealed" }, { misPostulacion: null, ...demoDuelo("ganador") }),
};

const escenarioFtl = (tipo) => ({
  postulacion:    () => escenario(tipo, {}, { inscripto: false }),
  anotado:        () => escenario(tipo, {}, { inscripto: true }),
  "en-escenario": () => escenario(tipo, { escenario_participant: { ...OTRO, user_id: USUARIO_DEMO.id, name: USUARIO_DEMO.name } },
    { inscripto: true }),
  votando:        () => escenario(tipo, { escenario_participant: OTRO }, { inscripto: false, votacion: VOTACION_FTL }),
});

const POR_JUEGO = {
  rey: REY, trivia: TRIVIA, suma: SUMA, palabra: PALABRA, duelo: DUELO,
  ftl: escenarioFtl("ftl"), pt: escenarioFtl("pt"),
};

export function celularDe(juego, estado) {
  const estados = POR_JUEGO[juego];
  if (!estados) return null;
  const armar = estados[estado] || Object.values(estados)[0];
  return armar();
}
