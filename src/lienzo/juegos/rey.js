import { CREMA, celAnuncio, celTitulo, convocatoria, filete, pantalla, qr, tarjeta, tvDato, tvTxt, txt } from "./piezas";

/**
 * Diseño de fábrica de las pantallas de Rey del Orto en el editor: calca
 * RaffleScreen (TV) y ReyDelOrto (app) sin lienzo guardado. Fila `lienzo_rey`.
 */

const LOGO_JUEGO = "/placas/Rey_del_orto-removebg-preview.png";

export const PANTALLAS_REY = [
  { id: "convocatoria", nombre: "Convocatoria",     vista: "convocatoria" },
  { id: "listo",        nombre: "Antes del sorteo", vista: "listo" },
  { id: "sorteo",       nombre: "Sorteo",           vista: "performance" },
  { id: "ganador",      nombre: "Ganador",          vista: "performance" },
  { id: "cancelado",    nombre: "Cancelado",        vista: "performance" },
];

export const PANTALLAS_REY_CEL = [
  { id: "cel-anuncio",   nombre: "Anuncio" },
  { id: "cel-esperando", nombre: "Esperando" },
  { id: "cel-sorteo",    nombre: "Sorteo" },
  { id: "cel-ganaste",   nombre: "Ganó" },
  { id: "cel-perdiste",  nombre: "No ganó" },
  { id: "cel-cancelado", nombre: "Cancelado" },
];

const etiqueta = (y) => tvTxt("etiqueta", "Rey del Orto", "REY DEL ORTO", y, 56,
  { fuente: "syne", tamano: 42, peso: 800, color: "rgba(255,255,255,.5)", espaciado: 0.07 });
const titulo = () => celTitulo("🎰 Rey del Orto");
const blanco = (a) => `rgba(255,255,255,${a})`;

export const REY_POR_DEFECTO = {
  convocatoria: convocatoria(LOGO_JUEGO),
  listo: pantalla(etiqueta(512), qr()),
  sorteo: pantalla(
    tvDato("estrobo", "estrobo", "Estroboscópico", 0, 0, 1920, 1080),
    tvDato("cuenta", "reyCuenta", "Cuenta regresiva", 560, 396, 800, 236,
      { fuente: "syne", tamano: 220, peso: 900, interlineado: 1, color: blanco(.9), sombra: { color: blanco(.4), x: 0, y: 0, blur: 60 } },
      { efecto: "latido" }),
    etiqueta(640),
    qr(),
  ),
  ganador: pantalla(
    { id: "aro", tipo: "forma", nombre: "Aro del avatar", x: 860, y: 300, w: 200, h: 200,
      relleno: { color: "rgba(0,245,160,.1)" }, borde: { color: "#00F5A0", ancho: 6 }, radio: 100 },
    tvDato("avatar", "reyAvatar", "Avatar del ganador", 860, 300, 200, 200, { fuente: "dmsans", tamano: 100, peso: 400, interlineado: 1 }),
    tvDato("nombre", "reyNombre", "Nombre del ganador", 160, 524, 1600, 110,
      { fuente: "syne", tamano: 90, peso: 900, color: "#00F5A0", espaciado: -0.02 }),
    tvDato("premio", "reyPremio", "Premio", 160, 658, 1600, 56, { fuente: "syne", tamano: 40, peso: 800, color: "#FFD600" },
      { texto: "🏆 {}" }),
    tvTxt("insignia", "Insignia", "REY DEL ORTO · BIZARREN MIUSIK BAR", 738, 32,
      { fuente: "grotesk", tamano: 22, peso: 400, color: "rgba(240,232,255,.4)", espaciado: 0.09 }),
    qr(),
  ),
  cancelado: pantalla(
    tvTxt("corona", "Corona", "👑", 318, 116, { fuente: "dmsans", tamano: 104, peso: 400, interlineado: 1 }),
    etiqueta(442),
    tvTxt("titulo", "Sorteo cancelado", "SORTEO CANCELADO", 506, 76,
      { fuente: "syne", tamano: 68, peso: 900, color: "#FFD600", sombra: { color: "rgba(255,214,0,.25)", x: 0, y: 0, blur: 50 } }),
    filete(604, "rgba(255,214,0,.45)"),
    tvDato("motivo", "reyMotivo", "Motivo de la cancelación", 560, 626, 800, 96,
      { fuente: "grotesk", tamano: 30, peso: 600, color: "rgba(240,232,255,.62)", interlineado: 1.45 }),
    tvTxt("proximo", "Próximo sorteo", "PREPARANDO EL PRÓXIMO SORTEO…", 748, 30,
      { fuente: "syne", tamano: 20, peso: 700, color: "rgba(240,232,255,.3)", espaciado: 0.1 }),
    qr(),
  ),

  // ── App del cliente ───────────────────────────────────────────────────
  "cel-anuncio": celAnuncio({ logo: LOGO_JUEGO, nombre: "Rey del Orto", color: "#FFD700", rgb: "255,215,0",
    bajada: "Se viene el sorteo 🎰" }),
  "cel-esperando": pantalla(
    titulo(),
    tarjeta("tarjeta", 50, 44, { color: "#000000" }, "rgba(255,215,0,.14)", 12),
    txt("mensaje", "Mensaje", "⏳ Esperá que el staff lance el sorteo...", 50, 44,
      { fuente: "dmsans", tamano: 12, peso: 400, color: "rgba(255,215,0,.5)" }),
  ),
  // Sin número ni texto: la cuenta regresiva vive en la pantalla gigante.
  "cel-sorteo": pantalla(tvDato("estrobo", "estrobo", "Estroboscópico", 0, 0, 390, 640)),
  "cel-ganaste": {
    ...pantalla(
      txt("trofeo", "Trofeo", "🏆", 210, 76, { fuente: "dmsans", tamano: 64, peso: 400, interlineado: 1 }),
      txt("ganaste", "¡GANASTE!", "¡GANASTE!", 296, 40, { fuente: "syne", tamano: 30, peso: 900, color: "#FFFFFF" }),
      tvDato("premio", "reyPremio", "Premio", 16, 346, 358, 26, { fuente: "dmsans", tamano: 17, peso: 700, color: "#FFFFFF" },
        { texto: "Premio: {}" }),
    ),
    fondo: { ...pantalla().fondo, tipo: "color", color: "#16A34A" },
  },
  "cel-perdiste": {
    ...pantalla(
      txt("emoji", "Emoji", "😅", 210, 76, { fuente: "dmsans", tamano: 64, peso: 400, interlineado: 1 }),
      txt("titulo-perdiste", "Esta vez no fue", "Esta vez no fue...", 296, 40, { fuente: "syne", tamano: 30, peso: 900, color: "#FFFFFF" }),
      txt("mensaje", "Mensaje", "La próxima es la tuya.", 346, 22, { fuente: "dmsans", tamano: 14, peso: 400, color: blanco(.85) }),
    ),
    fondo: { ...pantalla().fondo, tipo: "color", color: "#DC2626" },
  },
  "cel-cancelado": pantalla(
    titulo(),
    tarjeta("tarjeta", 50, 124, { color: "#000000" }, "rgba(255,215,0,.16)", 12),
    txt("corona", "Corona", "👑", 66, 38, { fuente: "dmsans", tamano: 30, peso: 400, interlineado: 1 }),
    txt("titulo-cancelado", "Sorteo cancelado", "El sorteo fue cancelado.", 110, 22, { fuente: "syne", tamano: 15, peso: 900, color: "#FCD34D" }),
    txt("mensaje", "Mensaje", "Esperá al próximo lanzamiento.", 138, 20, { fuente: "dmsans", tamano: 12, peso: 400, color: CREMA(.4) }),
  ),
};
