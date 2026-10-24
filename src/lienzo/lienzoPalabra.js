import { FONDO_BASE } from "./modelo";

/**
 * Diseño de fábrica de las pantallas de Arma la palabra en el editor: calca
 * los elementos de PalabraScreen y PlacaScreen sin lienzo guardado.
 * Posiciones en px sobre 1920 × 1080. El fondo arranca vacío: los fondos de
 * fábrica están en la biblioteca, categoría «Fondos» («Arma la palabra · …»).
 *
 * `vista` agrupa los estados como las vistas del Diseñador de Juegos.
 */

const LOGO_JUEGO = "/placas/Arma_la_palabra-removebg-preview.png";
const LOGO_APP = "/logo.png";

export const PANTALLAS_PALABRA = [
  { id: "convocatoria", nombre: "Convocatoria", vista: "convocatoria" },
  { id: "preparando",   nombre: "Preparando la ronda", vista: "listo" },
  { id: "en-juego",     nombre: "En juego",     vista: "performance" },
  { id: "entre-rondas", nombre: "Entre rondas", vista: "performance" },
  { id: "ganadores",    nombre: "Ganadores",    vista: "performance" },
];

/** QR del juego en pantalla, en el mismo lugar que el QR de la TV (abajo a la izquierda). */
const qr = (texto = "Escaneá para participar") => ({
  id: "qr", tipo: "dato", dato: "qr", nombre: "QR a la app", texto, x: 30, y: 790, w: 310, h: 262,
  estilo: { fuente: "grotesk", tamano: 22, peso: 700, color: "#F0E8FF", sombra: { color: "rgba(0,0,0,.8)", x: 0, y: 2, blur: 10 } },
});

export const PALABRA_POR_DEFECTO = {
  convocatoria: {
    fondo: { ...FONDO_BASE },
    elementos: [
      { id: "logo", tipo: "imagen", nombre: "Logo del juego", src: LOGO_JUEGO, ajuste: "contain",
        x: 173, y: 151, w: 1574, h: 778, efecto: "latido" },
      { id: "logo-app", tipo: "imagen", nombre: "Logo de BizarrApp", src: LOGO_APP, ajuste: "contain",
        x: 64, y: 64, w: 200, h: 130, efecto: "campana" },
      qr(),
    ],
  },
  preparando: {
    fondo: { ...FONDO_BASE },
    elementos: [
      { id: "preparando", tipo: "texto", nombre: "Preparando", texto: "Preparando la ronda…", x: 460, y: 500, w: 1000, h: 80,
        estilo: { fuente: "grotesk", tamano: 36, peso: 400, color: "rgba(240,232,255,.35)" } },
      qr(),
    ],
  },
  "en-juego": {
    fondo: { ...FONDO_BASE },
    elementos: [
      { id: "logo", tipo: "imagen", nombre: "Logo del juego", src: LOGO_JUEGO, ajuste: "contain",
        x: 320, y: 150, w: 1280, h: 302, efecto: "brillo" },
      { id: "formen", tipo: "texto", nombre: "FORMEN", texto: "FORMEN:", x: 560, y: 474, w: 800, h: 50,
        estilo: { fuente: "syne", tamano: 34, peso: 800, color: "#FFD600", espaciado: 0.12 } },
      { id: "fichas", tipo: "dato", dato: "fichas", nombre: "Fichas de la palabra", x: 160, y: 540, w: 1600, h: 200,
        estilo: { fuente: "syne", tamano: 108, peso: 900, color: "#C77DFF", brillo: { color: "rgba(168,85,247,.7)", fuerza: 40 } },
        ficha: { fondo: "rgba(168,85,247,.12)", borde: "rgba(168,85,247,.5)" } },
      { id: "juntense", tipo: "texto", nombre: "Consigna", texto: "¡Júntense y acérquense al escenario!",
        x: 260, y: 770, w: 1400, h: 60,
        estilo: { fuente: "syne", tamano: 38, peso: 900, color: "#FFD600", sombra: { color: "rgba(255,214,0,.3)", x: 0, y: 0, blur: 40 } } },
      { id: "mira", tipo: "texto", nombre: "Mirá tu letra", texto: "MIRÁ TU LETRA EN EL CELULAR",
        x: 460, y: 846, w: 1000, h: 46,
        estilo: { fuente: "grotesk", tamano: 29, peso: 600, color: "rgba(240,232,255,.55)", espaciado: 0.05 } },
      qr(),
    ],
  },
  "entre-rondas": {
    fondo: { ...FONDO_BASE },
    elementos: [
      { id: "titulo", tipo: "texto", nombre: "Título", texto: "🔤 ARMA LA PALABRA", x: 360, y: 452, w: 1200, h: 90,
        estilo: { fuente: "syne", tamano: 65, peso: 900, color: "#A855F7", espaciado: 0.04 } },
      { id: "preparando", tipo: "texto", nombre: "Preparando", texto: "PREPARANDO LA PALABRA SIGUIENTE…",
        x: 360, y: 566, w: 1200, h: 56,
        estilo: { fuente: "grotesk", tamano: 38, peso: 400, color: "rgba(240,232,255,.55)", espaciado: 0.08 } },
      qr(),
    ],
  },
  ganadores: {
    fondo: { ...FONDO_BASE },
    elementos: [
      { id: "titulo", tipo: "texto", nombre: "Título", texto: "🏆 ¡ARMARON LA PALABRA!", x: 40, y: 230, w: 1840, h: 110,
        estilo: { fuente: "syne", tamano: 82, peso: 900, color: "#00F5A0" } },
      { id: "letras", tipo: "dato", dato: "fichasGanadoras", nombre: "Letras ganadoras", x: 160, y: 370, w: 1600, h: 120,
        estilo: { fuente: "syne", tamano: 65, peso: 900, color: "#00F5A0" },
        ficha: { fondo: "rgba(0,245,160,.1)", borde: "rgba(0,245,160,.5)" } },
      { id: "tarjetas", tipo: "dato", dato: "tarjetasGanadores", nombre: "Tarjetas de ganadores", x: 160, y: 520, w: 1600, h: 200,
        estilo: { fuente: "syne", tamano: 22, peso: 800, color: "#F0E8FF", mayus: true },
        ficha: { fondo: "rgba(240,232,255,.05)", borde: "rgba(0,245,160,.3)", acento: "#00F5A0" } },
      { id: "ganadores", tipo: "texto", nombre: "Ganadores", texto: "🎉 GANADORES 🎉", x: 560, y: 752, w: 800, h: 56,
        estilo: { fuente: "syne", tamano: 34, peso: 800, color: "rgba(240,232,255,.85)" } },
      qr(),
    ],
  },
};

// ── App del cliente (celular) ──────────────────────────────────────────────
// Lienzo de 390 × 640 que reemplaza el contenido de la sección Juegos mientras
// se juega Arma la palabra. Encabezado y barra de la app quedan fijos. Ids con
// prefijo `cel-` en la misma fila `lienzo_palabra`.

export const PANTALLAS_PALABRA_CEL = [
  { id: "cel-anuncio",   nombre: "Anuncio" },
  { id: "cel-sin-ronda", nombre: "Sin ronda" },
  { id: "cel-tu-letra",  nombre: "Tu letra" },
  { id: "cel-ganaron",   nombre: "¡Ganaron!" },
  { id: "cel-terminada", nombre: "Ganaron otros" },
  { id: "cel-cerrada",   nombre: "Cerrada por el staff" },
];

const CREMA = (a) => `rgba(245,230,192,${a})`;
const titulo = () => ({ id: "titulo", tipo: "texto", nombre: "Título de la sección", texto: "🔤 Arma la palabra",
  x: 0, y: 0, w: 390, h: 34, estilo: { fuente: "syne", tamano: 18, peso: 800, color: "#FFD700", alinear: "left" } });
const tarjeta = (id, y, h, relleno, borde, radio) => ({ id, tipo: "forma", nombre: "Tarjeta", x: 0, y, w: 390, h,
  relleno, borde: { color: borde, ancho: 1 }, radio });
const txt = (id, nombre, texto, y, h, estilo, x = 16, w = 358) => ({ id, tipo: "texto", nombre, texto, x, y, w, h, estilo });
const fin = (mensaje) => ({
  fondo: { ...FONDO_BASE },
  elementos: [
    titulo(),
    tarjeta("tarjeta", 50, 160, { color: "rgba(255,255,255,.04)" }, "rgba(255,255,255,.1)", 18),
    txt("icono", "Ícono", "🏁", 76, 50, { fuente: "dmsans", tamano: 40, peso: 400 }),
    txt("titulo-fin", "Ronda terminada", "Ronda terminada", 132, 26, { fuente: "syne", tamano: 16, peso: 800, color: CREMA(.6) }),
    txt("mensaje", "Mensaje", mensaje, 162, 24, { fuente: "dmsans", tamano: 12.5, peso: 400, color: CREMA(.4) }),
  ],
});

Object.assign(PALABRA_POR_DEFECTO, {
  "cel-anuncio": {
    fondo: { ...FONDO_BASE },
    elementos: [
      tarjeta("tarjeta", 0, 290, { color: "rgba(168,85,247,.12)", degradado: { colores: ["rgba(168,85,247,.12)", "rgba(255,45,120,.08)"], angulo: 135 } },
        "rgba(168,85,247,.4)", 18),
      { id: "logo", tipo: "imagen", nombre: "Logo del juego", src: LOGO_JUEGO, ajuste: "contain", x: 135, y: 18, w: 120, h: 120, opacidad: 0.85 },
      txt("nombre", "Nombre del juego", "Arma la palabra", 144, 28, { fuente: "syne", tamano: 18, peso: 900, color: "#C77DFF" }),
      txt("bajada", "Bajada", "Encontrá a los que tienen las otras letras 🔤", 174, 20, { fuente: "dmsans", tamano: 12, peso: 400, color: CREMA(.45) }),
      { id: "boton", tipo: "forma", nombre: "Botón Próximamente", x: 16, y: 206, w: 358, h: 46,
        relleno: { color: "rgba(255,255,255,.04)" }, borde: { color: "rgba(255,255,255,.08)", ancho: 1 }, radio: 12 },
      txt("boton-texto", "Texto del botón", "Próximamente", 206, 46, { fuente: "syne", tamano: 13, peso: 700, color: CREMA(.35) }),
      txt("preparate", "Preparate", "⏳ Preparate — arranca en breve", 262, 18, { fuente: "dmsans", tamano: 11, peso: 400, color: "rgba(255,215,0,.45)" }),
    ],
  },
  "cel-sin-ronda": {
    fondo: { ...FONDO_BASE },
    elementos: [
      titulo(),
      txt("mensaje", "Mensaje", "Todavía no arrancó ninguna ronda.", 84, 28, { fuente: "dmsans", tamano: 12, peso: 400, color: CREMA(.3) }),
    ],
  },
  "cel-tu-letra": {
    fondo: { ...FONDO_BASE },
    elementos: [
      titulo(),
      tarjeta("tarjeta-letra", 50, 190, { color: "rgba(168,85,247,.1)" }, "rgba(168,85,247,.3)", 16),
      txt("tu-letra", "TU LETRA", "TU LETRA", 72, 18, { fuente: "dmsans", tamano: 11, peso: 700, color: "rgba(168,85,247,.8)", espaciado: 0.14 }),
      { id: "letra", tipo: "dato", dato: "miLetra", nombre: "Tu letra", x: 16, y: 96, w: 358, h: 126,
        estilo: { fuente: "syne", tamano: 110, peso: 900, color: "#A855F7" } },
      tarjeta("tarjeta-consigna", 250, 116, { color: "rgba(168,85,247,.07)" }, "rgba(168,85,247,.18)", 12),
      txt("consigna", "Consigna", "Encontrá a las personas que necesitás para formar la palabra.", 262, 44,
        { fuente: "dmsans", tamano: 12.5, peso: 400, color: "rgba(240,232,255,.55)", interlineado: 1.6 }),
      { id: "separador", tipo: "forma", nombre: "Separador", x: 16, y: 316, w: 358, h: 1,
        relleno: { color: "rgba(168,85,247,.18)" }, borde: { color: "transparent", ancho: 0 }, radio: 0 },
      txt("juntense", "Júntense", "¡Júntense y acérquense al escenario!", 326, 30, { fuente: "syne", tamano: 13.5, peso: 900, color: "#C084FC" }),
    ],
  },
  "cel-ganaron": {
    fondo: { ...FONDO_BASE },
    elementos: [
      titulo(),
      tarjeta("tarjeta", 50, 172, { color: "rgba(0,245,160,.16)", degradado: { colores: ["rgba(0,245,160,.16)", "rgba(168,85,247,.08)"], angulo: 135 } },
        "rgba(0,245,160,.4)", 20),
      txt("trofeo", "Trofeo", "🏆", 76, 58, { fuente: "dmsans", tamano: 48, peso: 400 }),
      txt("ganaron", "¡GANARON!", "¡GANARON!", 138, 32, { fuente: "syne", tamano: 22, peso: 900, color: "#00F5A0" }),
      txt("mensaje", "Mensaje", "Armaron la palabra correctamente.", 174, 24, { fuente: "dmsans", tamano: 13, peso: 400, color: CREMA(.6) }),
    ],
  },
  "cel-terminada": fin("Armaron la palabra correctamente."),
  "cel-cerrada": fin("El staff cerró la ronda."),
});
