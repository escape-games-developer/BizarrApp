/**
 * Las cuatro vistas que tiene todo juego en el Diseñador, y qué es cada una
 * en cada juego. `estados` son las variantes de una vista que la vista previa
 * puede mostrar (p. ej. el ganador dentro de Performance); `texto` dice qué
 * ve el bar en ese momento.
 *
 * Una vista con `sinPantalla` es un momento que el juego todavía no tiene en
 * la TV: se muestra igual, para que la estructura sea la misma en todos.
 */

export const VISTAS = [
  { id: "convocatoria", icon: "📢", label: "Convocatoria" },
  { id: "listo",        icon: "🙋", label: "Participante listo" },
  { id: "performance",  icon: "🔥", label: "Performance" },
  { id: "celular",      icon: "📱", label: "Celular" },
];

const PLACA = "La placa de anuncio: lo que ve el bar desde que tocás 📢 Anunciar.";

// Follow the Leader y Personal Trainer comparten contrato, y por eso vistas.
const VISTAS_ESCENARIO = {
  convocatoria: { texto: "La convocatoria: desde 📢 Anunciar hasta que llamás al participante, y entre performances." },
  listo:        { texto: "Al llamar al participante, antes de que arranque el video." },
  performance:  { texto: "Durante el video del desafío." },
  celular:      { texto: "Lo que ve el cliente en Escenario.", estados: [
    { id: "postulacion", label: "Postulación" }, { id: "anotado", label: "Anotado" },
    { id: "en-escenario", label: "En el escenario" }, { id: "votando", label: "Votando" },
  ] },
};

export const VISTAS_POR_JUEGO = {
  rey: {
    convocatoria: { texto: PLACA },
    listo:        { texto: "Rey del Orto en pantalla, antes de lanzar el sorteo." },
    performance:  { texto: "El sorteo y su resultado.", estados: [
      { id: "sorteo",    label: "Sorteo" },
      { id: "ganador",   label: "Ganador" },
      { id: "cancelado", label: "Cancelado" },
    ] },
    celular: { texto: "Lo que ve el cliente en Juegos.", estados: [
      { id: "anuncio", label: "Anuncio" }, { id: "esperando", label: "Esperando" },
      { id: "sorteo", label: "Sorteo" }, { id: "ganaste", label: "Ganó" },
      { id: "perdiste", label: "No ganó" }, { id: "cancelado", label: "Cancelado" },
    ] },
  },
  trivia: {
    convocatoria: { texto: PLACA },
    listo:        { texto: "El juego en pantalla mientras cargás las preguntas de la partida." },
    performance:  { texto: "Las preguntas y el resultado de la partida.", estados: [
      { id: "pregunta",  label: "Pregunta" },
      { id: "respuesta", label: "Respuesta" },
      { id: "final",     label: "Final" },
    ] },
    celular: { texto: "Lo que ve el cliente en Juegos.", estados: [
      { id: "anuncio", label: "Anuncio" }, { id: "esperando", label: "Esperando" },
      { id: "pregunta", label: "Pregunta" }, { id: "votaste", label: "Votó" },
      { id: "respuesta", label: "Respuesta" }, { id: "final", label: "Final" },
    ] },
  },
  suma: {
    convocatoria: { texto: PLACA },
    listo:        { texto: "El juego en pantalla antes de lanzar la ronda." },
    performance:  { texto: "La ronda y su resultado.", estados: [
      { id: "en-juego",  label: "En juego" },
      { id: "ganadores", label: "Ganadores" },
      { id: "cerrada",   label: "Cerrada" },
    ] },
    celular: { texto: "Lo que ve el cliente en Juegos.", estados: [
      { id: "anuncio", label: "Anuncio" }, { id: "tu-numero", label: "Su número" },
      { id: "ganaron", label: "Ganaron" }, { id: "terminada", label: "Terminada" },
    ] },
  },
  palabra: {
    convocatoria: { texto: PLACA },
    listo:        { texto: "El juego en pantalla antes de lanzar la ronda." },
    performance:  { texto: "La ronda en juego y la pantalla entre rondas.", estados: [
      { id: "en-juego",     label: "En juego" },
      { id: "entre-rondas", label: "Entre rondas" },
    ] },
    celular: { texto: "Lo que ve el cliente en Juegos.", estados: [
      { id: "anuncio", label: "Anuncio" }, { id: "tu-letra", label: "Su letra" },
      { id: "ganaron", label: "Ganaron" }, { id: "terminada", label: "Terminada" },
    ] },
  },
  duelo: {
    convocatoria: { texto: "La convocatoria: lo que ve el bar desde que tocás 📢 Anunciar hasta que lanzás la ronda." },
    listo:        { texto: "Hoy no existe: la TV pasa de la convocatoria directo a la votación.", sinPantalla: true },
    performance:  { texto: "La votación y su resultado.", estados: [
      { id: "votacion", label: "Votación" },
      { id: "ganador",  label: "Ganador" },
      { id: "empate",   label: "Empate" },
    ] },
    celular: { texto: "Lo que ve el cliente en Escenario.", estados: [
      { id: "postulacion", label: "Postulación" }, { id: "postulado", label: "Postulado" },
      { id: "votacion", label: "Votación" }, { id: "resultado", label: "Resultado" },
    ] },
  },
  ftl: VISTAS_ESCENARIO,
  pt:  VISTAS_ESCENARIO,
};
