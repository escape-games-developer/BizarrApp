/**
 * Datos de muestra para ver las pantallas de los juegos sin una ronda real:
 * los usa la vista previa del Diseñador (/designer-preview/tv). Cada juego
 * guarda su ronda fuera de game_state (sumate_rounds, arma_palabra_rounds,
 * applause_sessions…), así que sin esto esas pantallas no se pueden mostrar.
 */

/** Duelo de Talentos. estado: 'convocatoria' | 'votacion' | 'ganador' | 'empate'. */
export function demoDuelo(estado) {
  if (estado === "convocatoria") return { round: null, counts: { p1: 0, p2: 0 } };
  const base = {
    id: "demo", game_type: "duelo", p1_user_id: "d1", p1_name: "SOFI", p1_avatar: JSON.stringify({ avatar_emoji: "🦄" }),
    p2_user_id: "d2", p2_name: "JUAN", p2_avatar: JSON.stringify({ avatar_emoji: "🎸" }), tap_limit: 100,
  };
  if (estado === "votacion") return {
    round: { ...base, status: "voting", vote_mode: "toques", voting_ends_at: new Date(Date.now() + 45000).toISOString() },
    counts: { p1: 132, p2: 98 },
  };
  if (estado === "ganador") return {
    round: { ...base, status: "finished", vote_mode: "toques", result: "p1", winner_slot: 1 }, counts: { p1: 212, p2: 167 },
  };
  if (estado === "empate") return {
    round: { ...base, status: "finished", vote_mode: "toques", result: "tie", winner_slot: null }, counts: { p1: 150, p2: 150 },
  };
  return null;
}

/** Sumate que sumamos. estado: 'en-juego' | 'ganadores' | 'cerrada'. */
export function demoSumaRound(estado) {
  if (estado === "en-juego") return { id: "demo", target_number: 23, status: "playing" };
  if (estado === "cerrada") return { id: "demo", target_number: 23, status: "cancelled", cancel_reason: "manual" };
  if (estado === "ganadores") return {
    id: "demo", target_number: 23, status: "finished",
    winner_group: [
      { user_id: "d1", name: "SOFI",  avatar_emoji: "🦄", assigned_number: 9 },
      { user_id: "d2", name: "MARCE", avatar_emoji: "🍺", assigned_number: 7 },
      { user_id: "d3", name: "JUAN",  avatar_emoji: "🎸", assigned_number: 7 },
    ],
  };
  return null;
}

/** Arma la palabra. estado: 'en-juego' | 'entre-rondas'. */
export function demoPalabraRound(estado) {
  if (estado === "en-juego") return { id: "demo", target_word: "AVE", status: "playing" };
  if (estado === "entre-rondas") return { id: "demo", target_word: "AVE", status: "cancelled" };
  return null;
}

/** Rey del Orto: game_state de muestra. estado: 'reposo' | 'sorteo' | 'ganador' | 'cancelado'. */
export function demoRey(estado) {
  const base = { active_game: "rey del orto" };
  if (estado === "reposo") return { ...base, raffle_state: "idle" };
  if (estado === "sorteo") return { ...base, raffle_state: "launched", updated_at: new Date().toISOString() };
  if (estado === "ganador") return { ...base, raffle_state: "winner",
    raffle_winner: { name: "JUAN CARLOS", avatar: "🎰", prize: "TRAGO GRATIS" } };
  if (estado === "cancelado") return { ...base, raffle_state: "cancelled",
    raffle_cancel: { code: "MIN_PARTICIPANTS", connected_count: 4, required_count: 5 } };
  return base;
}

/**
 * Desafío Demente: game_state + datos de muestra para TriviaScreen.
 * estado: 'preparando' | 'pregunta' | 'respuesta' | 'final'.
 */
export function demoTrivia(estado) {
  const fase = { preparando: "idle", pregunta: "active", respuesta: "revealed", final: "finished" }[estado] || "idle";
  return {
    gameState: { active_game: "trivia", trivia_state: fase, trivia_question: 0, trivia_winner_team: "batata" },
    demo: {
      question: { text: "¿Cuál es el mejor bar de Buenos Aires?",
        options: ["Bizarren", "El de la esquina", "Ninguno", "Todos"], correct: 0 },
      pcts: { batata: 58, membrillo: 42, opts: [61, 17, 9, 13] },
      accumulated: { batata: 4, membrillo: 3 },
    },
  };
}
