/**
 * Datos de prueba de Pantalla › DJ Democracy para el preview del Diseñador
 * Cliente. Cubren los estados visibles: primer puesto, voto a favor, voto en
 * contra, tema caliente, super voto disponible y kick en progreso.
 *
 * `cli` imita la forma de usePantallaClient con acciones inertes: el preview
 * no vota, no reacciona ni pide sacar temas.
 */
const noop = () => {};

export const previewPantallaShellState = Object.freeze({ isLoggedIn: true, isRestricted: false });

const event = Object.freeze({ id: "preview-event", voting_frozen: false, voting_disabled: false });

const current = Object.freeze({
  id: "preview-current", title: "Hubo un tiempo que fui mozo", artist: "Todo X Dos Pesos", cover_url: null,
});

const candidates = Object.freeze([
  { id: "c1", title: "Mil horas",              artist: "Los Abuelos de la Nada", score: 14, hot_until: null },
  { id: "c2", title: "Lamento boliviano",      artist: "Enanitos Verdes",        score: 9,
    hot_until: "2999-01-01T00:00:00Z" },
  { id: "c3", title: "Persiana americana",     artist: "Soda Stereo",            score: 4,  hot_until: null },
  { id: "c4", title: "Y dale alegría a mi corazón", artist: "Fito Páez",         score: -2, hot_until: null },
].map((c) => Object.freeze({ ...c, cover_url: null })));

const votos = { c2: "up", c4: "down" };
const poderes = { up: { enabled: true, value: 1 }, down: { enabled: true, value: 1 }, super_up: { enabled: true, value: 5 } };

const cli = Object.freeze({
  role: "guest",
  emojis: ["🔥", "🙌", "💃", "😍", "🤘"],
  kick: { enabled: true, votes: 7, needed: 20, voted: false, button_text: "Voltear este tema" },
  busy: null,
  error: null,
  superUsed: false,
  powerOf: (tipo) => poderes[tipo] ?? { enabled: false, value: 0 },
  voteOn: (id) => votos[id] ?? null,
  vote: noop, superVote: noop, toggleKick: noop, react: noop, clearError: noop,
});

export const previewPantallaProps = Object.freeze({
  event, current, candidates, loading: false, cli,
  user: { registered: true }, isRestricted: false, isGuest: false,
});
