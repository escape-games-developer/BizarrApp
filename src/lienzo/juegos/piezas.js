import { FONDO_BASE } from "../modelo";

/**
 * Piezas de los diseños de fábrica de las pantallas del editor (src/lienzo):
 * lo que se repite entre juegos. Posiciones en px lógicos (TV 1920 × 1080,
 * celular 390 × 640).
 */

export const LOGO_APP = "/logo.png";
export const CREMA = (a) => `rgba(245,230,192,${a})`;

/** Pantalla con el fondo vacío: los fondos de fábrica están en la biblioteca («Fondos»). */
export const pantalla = (...elementos) => ({ fondo: { ...FONDO_BASE }, elementos });

// ── TV ───────────────────────────────────────────────────────────────────

/** QR del juego en pantalla, en el mismo lugar que el QR de la TV (abajo a la izquierda). */
export const qr = (texto = "Escaneá para participar") => ({
  id: "qr", tipo: "dato", dato: "qr", nombre: "QR a la app", texto, x: 30, y: 790, w: 310, h: 262,
  estilo: { fuente: "grotesk", tamano: 22, peso: 700, color: "#F0E8FF", sombra: { color: "rgba(0,0,0,.8)", x: 0, y: 2, blur: 10 } },
});

/** Texto centrado de la TV: `y` y `h` mandan; ocupa casi todo el ancho. */
export const tvTxt = (id, nombre, texto, y, h, estilo, x = 160, w = 1600) => ({ id, tipo: "texto", nombre, texto, x, y, w, h, estilo });

/** Dato de la TV, con su caja. */
export const tvDato = (id, dato, nombre, x, y, w, h, estilo, extra = {}) => ({ id, tipo: "dato", dato, nombre, x, y, w, h, estilo, ...extra });

/** Filete horizontal con degradado (los separadores de las pantallas de cancelación). */
export const filete = (y, color, ancho = 220) => ({
  id: "filete", tipo: "forma", nombre: "Filete", x: Math.round((1920 - ancho) / 2), y, w: ancho, h: 2,
  relleno: { color, degradado: { colores: ["transparent", color, "transparent"], angulo: 90 } }, borde: { color: "transparent", ancho: 0 }, radio: 0,
});

/** Placa de anuncio de un juego: su logo grande con latido, el logo de BizarrApp y el QR. */
export const convocatoria = (logoJuego) => pantalla(
  { id: "logo", tipo: "imagen", nombre: "Logo del juego", src: logoJuego, ajuste: "contain",
    x: 173, y: 151, w: 1574, h: 778, efecto: "latido" },
  { id: "logo-app", tipo: "imagen", nombre: "Logo de BizarrApp", src: LOGO_APP, ajuste: "contain",
    x: 64, y: 64, w: 200, h: 130, efecto: "campana" },
  qr(),
);

/** «Preparando la ronda…» (el juego al aire, sin ronda todavía). */
export const preparando = () => pantalla(
  tvTxt("preparando", "Preparando", "Preparando la ronda…", 500, 80,
    { fuente: "grotesk", tamano: 36, peso: 400, color: "rgba(240,232,255,.35)" }, 460, 1000),
  qr(),
);

// ── Celular ──────────────────────────────────────────────────────────────

/** Encabezado de la sección (el `.sec-hdr` de la app): emoji + nombre del juego. */
export const celTitulo = (texto) => ({ id: "titulo", tipo: "texto", nombre: "Título de la sección", texto,
  x: 0, y: 0, w: 390, h: 34, estilo: { fuente: "syne", tamano: 18, peso: 800, color: "#FFD700", alinear: "left" } });

export const tarjeta = (id, y, h, relleno, borde, radio, nombre = "Tarjeta") => ({ id, tipo: "forma", nombre, x: 0, y, w: 390, h,
  relleno, borde: { color: borde, ancho: 1 }, radio });

export const txt = (id, nombre, texto, y, h, estilo, x = 16, w = 358) => ({ id, tipo: "texto", nombre, texto, x, y, w, h, estilo });

/** Tarjeta apagada de «Ronda terminada» con su mensaje. */
export const celFin = (titulo, encabezado, mensaje) => pantalla(
  celTitulo(titulo),
  tarjeta("tarjeta", 50, 160, { color: "rgba(255,255,255,.04)" }, "rgba(255,255,255,.1)", 18),
  txt("icono", "Ícono", "🏁", 76, 50, { fuente: "dmsans", tamano: 40, peso: 400 }),
  txt("titulo-fin", "Ronda terminada", encabezado, 132, 26, { fuente: "syne", tamano: 16, peso: 800, color: CREMA(.6) }),
  txt("mensaje", "Mensaje", mensaje, 162, 24, { fuente: "dmsans", tamano: 12.5, peso: 400, color: CREMA(.4) }),
);

/** Tarjeta verde de «¡GANARON!». `segundo`: el otro color del degradé. */
export const celGanaron = (titulo, mensaje, segundo) => pantalla(
  celTitulo(titulo),
  tarjeta("tarjeta", 50, 172, { color: "rgba(0,245,160,.16)", degradado: { colores: ["rgba(0,245,160,.16)", segundo], angulo: 135 } },
    "rgba(0,245,160,.4)", 20),
  txt("trofeo", "Trofeo", "🏆", 76, 58, { fuente: "dmsans", tamano: 48, peso: 400 }),
  txt("ganaron", "¡GANARON!", "¡GANARON!", 138, 32, { fuente: "syne", tamano: 22, peso: 900, color: "#00F5A0" }),
  txt("mensaje", "Mensaje", mensaje, 174, 24, { fuente: "dmsans", tamano: 13, peso: 400, color: CREMA(.6) }),
);

/** Mensaje suelto bajo el encabezado («Todavía no arrancó ninguna ronda.»). */
export const celMensaje = (titulo, mensaje, color = CREMA(.3)) => pantalla(
  celTitulo(titulo),
  txt("mensaje", "Mensaje", mensaje, 84, 28, { fuente: "dmsans", tamano: 12, peso: 400, color }),
);

/**
 * Card de «Próximamente» del juego anunciado (logo en gris, nombre, bajada y
 * el botón apagado). `color` del nombre; `rgb` del tinte de la tarjeta.
 */
export const celAnuncio = ({ logo, nombre, color, rgb, bajada, opacidad = 0.85 }) => pantalla(
  tarjeta("tarjeta", 0, 290, { color: `rgba(${rgb},.12)`, degradado: { colores: [`rgba(${rgb},.12)`, "rgba(255,45,120,.08)"], angulo: 135 } },
    `rgba(${rgb},.4)`, 18),
  { id: "logo", tipo: "imagen", nombre: "Logo del juego", src: logo, ajuste: "contain", x: 135, y: 18, w: 120, h: 120, opacidad },
  txt("nombre", "Nombre del juego", nombre, 144, 28, { fuente: "syne", tamano: 18, peso: 900, color }),
  txt("bajada", "Bajada", bajada, 174, 20, { fuente: "dmsans", tamano: 12, peso: 400, color: CREMA(.45) }),
  { id: "boton", tipo: "forma", nombre: "Botón Próximamente", x: 16, y: 206, w: 358, h: 46,
    relleno: { color: "rgba(255,255,255,.04)" }, borde: { color: "rgba(255,255,255,.08)", ancho: 1 }, radio: 12 },
  txt("boton-texto", "Texto del botón", "Próximamente", 206, 46, { fuente: "syne", tamano: 13, peso: 700, color: CREMA(.35) }),
  txt("preparate", "Preparate", "⏳ Preparate — arranca en breve", 262, 18, { fuente: "dmsans", tamano: 11, peso: 400, color: "rgba(255,215,0,.45)" }),
);
