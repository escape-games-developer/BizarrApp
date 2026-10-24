import { CREMA, celAnuncio, celTitulo, convocatoria, pantalla, qr, tarjeta, tvDato, tvTxt, txt } from "./piezas";

/**
 * Diseño de fábrica de las pantallas de Desafío Demente en el editor: calca
 * TriviaScreen (TV) y DesafioDemente (app) sin lienzo guardado. Fila
 * `lienzo_trivia`.
 */

const LOGO_JUEGO = "/placas/Desafio_demente-removebg-preview.png";

export const PANTALLAS_TRIVIA = [
  { id: "convocatoria", nombre: "Convocatoria",    vista: "convocatoria" },
  { id: "preparando",   nombre: "Preparando",      vista: "listo" },
  { id: "pregunta",     nombre: "Pregunta",        vista: "performance" },
  { id: "respuesta",    nombre: "Respuesta",       vista: "performance" },
  { id: "final",        nombre: "Final",           vista: "performance" },
];

export const PANTALLAS_TRIVIA_CEL = [
  { id: "cel-anuncio",     nombre: "Anuncio" },
  { id: "cel-esperando",   nombre: "Esperando" },
  { id: "cel-pregunta",    nombre: "Pregunta" },
  { id: "cel-votaste",     nombre: "Votó" },
  { id: "cel-respuesta",   nombre: "Respuesta" },
  { id: "cel-final-gano",  nombre: "Final: ganó su equipo" },
  { id: "cel-final-perdio", nombre: "Final: perdió" },
  { id: "cel-empate",      nombre: "Final: empate" },
];

const NOMBRE = "🧠 Desafío Demente!";
const VIOLETA = (a) => `rgba(138,85,247,${a})`;
const tituloTv = (y) => tvTxt("titulo", "Título", "🧠 DESAFÍO DEMENTE!", y, 80,
  { fuente: "syne", tamano: 60, peso: 900, degradado: { colores: ["#9B2FFF", "#FF2D78"], angulo: 135 } });
const etiqueta = (texto, y, h = 26, tamano = 18, alfa = 0.45) => tvTxt(`etiqueta-${y}`, texto, texto, y, h,
  { fuente: "grotesk", tamano, peso: 400, color: `rgba(240,232,255,${alfa})`, espaciado: 0.1 });
const numero = (plantilla, y) => tvDato("numero", "triviaNumero", "Número de pregunta", 160, y, 1600, 32,
  { fuente: "grotesk", tamano: 22, peso: 400, color: "rgba(240,232,255,.55)" }, { texto: plantilla });
const preguntaTv = (y) => tvDato("pregunta", "triviaPregunta", "Pregunta", 192, y, 1536, 116,
  { fuente: "syne", tamano: 42, peso: 800, color: "#F0E8FF", interlineado: 1.3 });
const opciones = (y) => tvDato("opciones", "triviaOpciones", "Opciones", 410, y, 1100, 160,
  { fuente: "grotesk", tamano: 28, peso: 700, color: "#F0E8FF" },
  { ficha: { fondo: "rgba(240,232,255,.06)", borde: "rgba(240,232,255,.18)", acento: "#00F5A0" } });
const equipos = (y) => [
  etiqueta("PARTICIPACIÓN POR EQUIPO", y, 24, 16, 0.4),
  tvDato("equipos", "triviaEquipos", "Participación por equipo", 192, y + 36, 1536, 210,
    { fuente: "syne", tamano: 32, peso: 900, color: "#F0E8FF" }),
];

// Celular: tarjeta de la pregunta y botones, los mismos en pregunta / votó / respuesta.
const celPregunta = (...extra) => pantalla(
  celTitulo(NOMBRE),
  tvDato("equipo", "miEquipo", "Tu equipo", 0, 46, 390, 40, { fuente: "dmsans", tamano: 12, peso: 700, alinear: "left" }),
  tarjeta("tarjeta-pregunta", 100, 96, { color: VIOLETA(.08) }, VIOLETA(.2), 12),
  tvDato("numero", "triviaNumero", "Número de pregunta", 14, 112, 362, 16,
    { fuente: "dmsans", tamano: 10, peso: 400, color: VIOLETA(.6), alinear: "left" }, { texto: "PREGUNTA {}" }),
  tvDato("pregunta", "triviaPregunta", "Pregunta", 14, 132, 362, 54,
    { fuente: "dmsans", tamano: 14, peso: 600, color: "#F0E8FF", alinear: "left", interlineado: 1.5 }),
  tvDato("votar", "triviaVotar", "Botones para votar", 0, 210, 390, 216,
    { fuente: "dmsans", tamano: 13, peso: 400, color: "#F0E8FF", alinear: "left" },
    { ficha: { fondo: "rgba(255,255,255,.04)", borde: "rgba(255,255,255,.1)", acento: "#22C55E" } }),
  ...extra,
);
const celFinal = (mensaje, estilo) => pantalla(
  txt("trofeo", "Trofeo", "🏆", 24, 58, { fuente: "dmsans", tamano: 48, peso: 400, interlineado: 1 }),
  txt("terminado", "¡Desafío terminado!", "¡Desafío terminado!", 92, 30, { fuente: "syne", tamano: 20, peso: 900, color: "#FFD700" }),
  txt("mensaje", "Mensaje", mensaje, 128, 24, estilo),
);

export const TRIVIA_POR_DEFECTO = {
  convocatoria: convocatoria(LOGO_JUEGO),
  preparando: pantalla(
    tituloTv(466),
    tvTxt("preparando", "Preparando", "PREPARANDO NUEVO DESAFÍO…", 572, 50,
      { fuente: "grotesk", tamano: 34, peso: 400, color: "rgba(240,232,255,.55)", espaciado: 0.08 }),
    qr(),
  ),
  pregunta: pantalla(
    tituloTv(124),
    numero("PREGUNTA {} · VOTACIÓN ABIERTA", 232),
    preguntaTv(290),
    opciones(432),
    ...equipos(640),
    qr(),
  ),
  respuesta: pantalla(
    tituloTv(60),
    numero("PREGUNTA {} · RESPUESTA", 158),
    preguntaTv(204),
    opciones(334),
    etiqueta("CÓMO RESPONDIERON", 512),
    tvDato("distribucion", "triviaDistribucion", "Cómo respondieron", 410, 544, 1100, 104,
      { fuente: "grotesk", tamano: 18, peso: 700, color: "rgba(240,232,255,.5)" },
      { ficha: { fondo: "rgba(240,232,255,.08)", borde: "rgba(240,232,255,.28)", acento: "#00F5A0" } }),
    ...equipos(676),
    qr(),
  ),
  final: pantalla(
    tituloTv(250),
    tvDato("ganador", "triviaGanador", "Equipo ganador", 192, 362, 1536, 60, { fuente: "syne", tamano: 42, peso: 800, color: "#F0E8FF" }),
    tvDato("aciertos", "triviaAciertos", "Aciertos", 192, 426, 1536, 30, { fuente: "syne", tamano: 19, peso: 800, color: "rgba(240,232,255,.7)" },
      { texto: "Aciertos {}" }),
    ...equipos(520),
    qr(),
  ),

  // ── App del cliente ───────────────────────────────────────────────────
  "cel-anuncio": celAnuncio({ logo: LOGO_JUEGO, nombre: "Desafío Demente", color: "#C084FC", rgb: "155,47,255",
    bajada: "Team Batata 🍠 vs Team Membrillo 🍋" }),
  "cel-esperando": pantalla(
    celTitulo(NOMBRE),
    tvDato("equipo", "miEquipo", "Tu equipo", 0, 50, 390, 76, { fuente: "syne", tamano: 16, peso: 900 }),
    txt("mensaje", "Mensaje", "⏳ Esperá que el staff lance la primera pregunta...", 140, 36,
      { fuente: "dmsans", tamano: 12, peso: 400, color: "rgba(255,215,0,.3)" }),
  ),
  "cel-pregunta": celPregunta(),
  "cel-votaste": celPregunta(
    tarjeta("tarjeta-voto", 440, 38, { color: "rgba(34,197,94,.08)" }, "rgba(34,197,94,.2)", 10, "Tarjeta del voto"),
    txt("voto", "Voto enviado", "✓ Voto enviado · Esperá el resultado en pantalla", 440, 38,
      { fuente: "dmsans", tamano: 12, peso: 400, color: "#86EFAC" }),
  ),
  "cel-respuesta": celPregunta(),
  "cel-final-gano": celFinal("¡Tu equipo ganó el desafío! 🎉", { fuente: "dmsans", tamano: 14, peso: 400, color: "#86EFAC" }),
  "cel-final-perdio": celFinal("Mejor suerte la próxima.", { fuente: "dmsans", tamano: 13, peso: 400, color: CREMA(.5) }),
  "cel-empate": celFinal("🤝 ¡EMPATE!", { fuente: "dmsans", tamano: 15, peso: 800, color: "#FCD34D" }),
};
