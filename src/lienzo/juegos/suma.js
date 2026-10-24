import { celAnuncio, celFin, celGanaron, celMensaje, celTitulo, convocatoria, filete, pantalla, preparando, qr, tarjeta, tvDato, tvTxt, txt } from "./piezas";

/**
 * Diseño de fábrica de las pantallas de Sumate que sumamos en el editor: calca
 * SumaScreen (TV) y SumaElNumero (app) sin lienzo guardado. Fila `lienzo_suma`.
 */

const LOGO_JUEGO = "/placas/Sumate_que_sumamos-removebg-preview.png";

export const PANTALLAS_SUMA = [
  { id: "convocatoria", nombre: "Convocatoria",        vista: "convocatoria" },
  { id: "preparando",   nombre: "Preparando la ronda", vista: "listo" },
  { id: "en-juego",     nombre: "En juego",            vista: "performance" },
  { id: "ganadores",    nombre: "Ganadores",           vista: "performance" },
  { id: "cerrada",      nombre: "Cerrada",             vista: "performance" },
];

export const PANTALLAS_SUMA_CEL = [
  { id: "cel-anuncio",   nombre: "Anuncio" },
  { id: "cel-sin-ronda", nombre: "Sin ronda" },
  { id: "cel-tu-numero", nombre: "Tu número" },
  { id: "cel-ganaron",   nombre: "¡Ganaron!" },
  { id: "cel-terminada", nombre: "Ganaron otros" },
  { id: "cel-cerrada",   nombre: "Cerrada por el staff" },
];

const NOMBRE = "🔢 Sumate que sumamos";
const tituloTv = (y) => tvTxt("titulo", "Título", "🔢 SUMATE QUE SUMAMOS", y, 70,
  { fuente: "syne", tamano: 56, peso: 900, color: "#FF9500", espaciado: 0.04 });

export const SUMA_POR_DEFECTO = {
  convocatoria: convocatoria(LOGO_JUEGO),
  preparando: preparando(),
  "en-juego": pantalla(
    tituloTv(186),
    tvTxt("objetivo-txt", "OBJETIVO", "OBJETIVO", 266, 40, { fuente: "syne", tamano: 30, peso: 800, color: "#FFD600", espaciado: 0.22 }),
    tvDato("objetivo", "objetivo", "Objetivo", 360, 312, 1200, 372,
      { fuente: "syne", tamano: 367, peso: 900, interlineado: 1, color: "#FF9500", brillo: { color: "rgba(255,149,0,.55)", fuerza: 70 } }),
    tvTxt("consigna", "Consigna", "Busquen personas y sumen sus números.", 700, 48,
      { fuente: "grotesk", tamano: 32, peso: 600, color: "rgba(240,232,255,.72)" }),
    tvTxt("juntense", "Júntense", "¡Júntense y acérquense al escenario!", 762, 52,
      { fuente: "syne", tamano: 36, peso: 900, color: "#FFD600", sombra: { color: "rgba(255,214,0,.3)", x: 0, y: 0, blur: 40 } }),
    tvTxt("mira", "Mirá tu número", "MIRÁ TU NÚMERO EN EL CELULAR", 828, 32,
      { fuente: "grotesk", tamano: 22, peso: 600, color: "rgba(240,232,255,.42)", espaciado: 0.12 }),
    qr(),
  ),
  ganadores: pantalla(
    tvTxt("titulo", "¡Lo lograron!", "🎉 ¡LO LOGRARON! 🎉", 216, 92,
      { fuente: "syne", tamano: 76, peso: 900, color: "#00F5A0", sombra: { color: "rgba(0,245,160,.45)", x: 0, y: 0, blur: 60 } }),
    tvDato("objetivo", "objetivo", "Objetivo", 460, 326, 1000, 264,
      { fuente: "syne", tamano: 259, peso: 900, interlineado: 1, color: "#00F5A0", brillo: { color: "rgba(0,245,160,.5)", fuerza: 80 } }),
    tvDato("tarjetas", "tarjetasGanadores", "Tarjetas de ganadores", 160, 610, 1600, 186,
      { fuente: "syne", tamano: 26, peso: 800, color: "#F0E8FF", mayus: true },
      { ficha: { fondo: "rgba(0,245,160,.1)", borde: "rgba(0,245,160,.45)", acento: "#00F5A0" } }),
    tvDato("cuenta", "sumaCuenta", "La cuenta", 160, 814, 1600, 56, { fuente: "syne", tamano: 44, peso: 900, color: "#FFD600", espaciado: 0.02 }),
    qr(),
  ),
  cerrada: pantalla(
    tituloTv(380),
    tvTxt("finalizada", "Ronda finalizada", "RONDA FINALIZADA", 462, 84,
      { fuente: "syne", tamano: 74, peso: 900, color: "#FFD600", sombra: { color: "rgba(255,214,0,.22)", x: 0, y: 0, blur: 50 } }),
    filete(570, "rgba(255,214,0,.45)"),
    tvTxt("proxima", "Próxima ronda", "Preparando la próxima ronda…", 596, 44,
      { fuente: "grotesk", tamano: 30, peso: 600, color: "rgba(240,232,255,.5)" }),
    qr(),
  ),

  // ── App del cliente ───────────────────────────────────────────────────
  "cel-anuncio": celAnuncio({ logo: LOGO_JUEGO, nombre: "Sumate que sumamos", color: "#FF9500", rgb: "255,149,0",
    bajada: "Te va a tocar un número: armá el objetivo en grupo 🔢" }),
  "cel-sin-ronda": celMensaje(NOMBRE, "Todavía no arrancó ninguna ronda."),
  "cel-tu-numero": pantalla(
    celTitulo(NOMBRE),
    tarjeta("tarjeta-numero", 50, 190, { color: "rgba(0,229,255,.08)" }, "rgba(0,229,255,.28)", 16),
    txt("tu-numero", "TU NÚMERO", "TU NÚMERO", 76, 18, { fuente: "dmsans", tamano: 11, peso: 700, color: "rgba(0,229,255,.75)", espaciado: 0.14 }),
    tvDato("numero", "miNumero", "Tu número", 16, 98, 358, 126, { fuente: "syne", tamano: 120, peso: 900, interlineado: 1, color: "#00E5FF" }),
  ),
  "cel-ganaron": celGanaron(NOMBRE, "Encontraron la combinación correcta.", "rgba(255,215,0,.08)"),
  "cel-terminada": celFin(NOMBRE, "Ronda terminada", "Encontraron la combinación correcta."),
  "cel-cerrada": celFin(NOMBRE, "La ronda terminó.", "Esperá al próximo lanzamiento."),
};
