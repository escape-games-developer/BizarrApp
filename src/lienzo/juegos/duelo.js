import { FONDO_BASE } from "../modelo";
import { CREMA, LOGO_APP, qr, tarjeta, txt } from "./piezas";
import { COLOR_P1, COLOR_P2 } from "../datosDuelo";

/**
 * Diseño de fábrica del Duelo de Talentos en el editor (fila `lienzo_duelo`):
 * calca la placa del Duelo (convocatoria), DueloBigscreen (votación, ganador,
 * empate) y DueloVistaCompleta (celular).
 *
 * En la votación, cada duelista es un juego de piezas sueltas (ver
 * piezasColumna): el fondo es una imagen webp común, encima los efectos
 * (área que dibuja la TV) y la cara, el nombre, el 👍 % y el barómetro.
 */

export const PANTALLAS_DUELO = [
  { id: "convocatoria", nombre: "Convocatoria", vista: "convocatoria" },
  { id: "votacion",     nombre: "Votación",     vista: "performance" },
  { id: "ganador",      nombre: "Ganador",      vista: "performance" },
  { id: "empate",       nombre: "Empate",       vista: "performance" },
];
export const PANTALLAS_DUELO_CEL = [
  { id: "cel-postulacion",  nombre: "Postulación" },
  { id: "cel-postulado",    nombre: "Postulado" },
  { id: "cel-votacion",     nombre: "Votación" },
  { id: "cel-en-escenario", nombre: "En el escenario" },
  { id: "cel-resultado",    nombre: "Resultado" },
];

const PINK = "#FF2D95";
const ANCHO_COLUMNA = 288;   // 15 % de 1920, la columna de siempre
const BAROMETRO_FABRICA = { ancho: 100, alto: 60, y: 64, x: 50 };

/**
 * Las piezas de la columna del duelista `n` dentro de la caja `c`
 * ({x, y, w, h}). El barómetro sale de «Pantalla del duelo» (`config`), con
 * las mismas cuentas que la columna vieja: así un diseño guardado se separa
 * sin moverse (separarColumnas).
 */
export function piezasColumna(n, c, config = null, visible = true) {
  const b = config?.barometro || BAROMETRO_FABRICA;
  const baroW = Math.round(59.5 * (b.ancho / 100)), baroH = Math.round(c.h * (b.alto / 100));
  const baroCx = n === 1 ? c.x + c.w * (b.x / 100) : c.x + c.w - c.w * (b.x / 100);
  const lado = 100;
  const v = { visible };
  return [
    { id: `fondo${n}`, tipo: "imagen", nombre: `Fondo del duelista ${n}`, src: `/duelo/columna-p${n}.webp`, ajuste: "cover", ...c, ...v },
    dato(`efectos${n}`, `duEfectos${n}`, `Efectos del duelista ${n}`, c.x, c.y, c.w, c.h, v),
    dato(`barometro${n}`, `duBarometro${n}`, `Barómetro del duelista ${n}`, Math.round(baroCx - baroW / 2),
      Math.round(c.y + c.h * (b.y / 100) - baroH / 2), baroW, baroH, v),
    dato(`cara${n}`, `duAvatar${n}`, `Cara del duelista ${n}`, Math.round(c.x + c.w / 2 - lado / 2), c.y + 40, lado, lado, v),
    dato(`nombre${n}`, `duNombre${n}`, `Nombre del duelista ${n}`, c.x, c.y + 150, c.w, 44, { ...v,
      estilo: { fuente: "grotesk", tamano: 33, peso: 700, mayus: true, espaciado: 0.02, color: "#FFFFFF",
        sombra: { color: "rgba(0,0,0,.7)", x: 0, y: 2, blur: 10 } } }),
    dato(`pct${n}`, `duPct${n}`, `👍 % del duelista ${n}`, c.x, c.y + 200, c.w, 70, { ...v,
      estilo: { fuente: "syne", tamano: 48, peso: 800, color: n === 1 ? "#ff258e" : "#ff9100",
        sombra: { color: n === 1 ? "rgba(255,22,136,.4)" : "rgba(255,138,0,.4)", x: 0, y: 2, blur: 12 } } }),
  ];
}

/**
 * Diseños guardados con la columna entera (`duColumna1/2`): cada una se
 * reemplaza, en su lugar y en su capa, por sus piezas sueltas. El editor lo
 * hace al abrir; la TV, al dibujar (así se ve igual hasta que se guarde).
 */
export function separarColumnas(p, config = null) {
  if (!p?.elementos?.some((e) => e.tipo === "dato" && (e.dato === "duColumna1" || e.dato === "duColumna2"))) return p;
  const elementos = p.elementos.flatMap((e) => {
    const n = e.tipo === "dato" ? { duColumna1: 1, duColumna2: 2 }[e.dato] : null;
    return n ? piezasColumna(n, { x: e.x, y: e.y, w: e.w, h: e.h }, config, e.visible !== false) : [e];
  });
  return { ...p, elementos };
}
const dato = (id, d, nombre, x, y, w, h, extra = {}) => ({ id, tipo: "dato", dato: d, nombre, x, y, w, h, ...extra });
const tv = (id, nombre, texto, y, h, estilo, x = 160, w = 1600) => ({ id, tipo: "texto", nombre, texto, x, y, w, h, estilo });
const encabezado = () => txt("titulo", "Título de la sección", "Duelo de Talentos", 0, 30,
  { fuente: "syne", tamano: 17, peso: 900, color: PINK, alinear: "left" }, 0, 390);

export const DUELO_POR_DEFECTO = {
  convocatoria: {
    fondo: { ...FONDO_BASE, tipo: "lineal", colores: ["#3D001A", "#08040F"], angulo: 160, orbs: true,
      orbsColores: ["rgba(255,45,149,.5)", "rgba(255,45,149,.5)", "rgba(0,0,0,0)"], marco: "rgba(255,45,120,.3)" },
    elementos: [
      { id: "logo", tipo: "imagen", nombre: "Logo del Duelo", src: "/placas/Duelo_de_talento-removebg-preview.png", ajuste: "contain",
        x: 173, y: 151, w: 1574, h: 778, efecto: "latido" },
      { id: "logo-app", tipo: "imagen", nombre: "Logo de BizarrApp", src: LOGO_APP, ajuste: "contain", x: 64, y: 64, w: 200, h: 130, efecto: "campana" },
      qr("Escaneá para postularte"),
    ],
  },
  // Transparente: el fondo de la votación es el video (o la imagen de «Pantalla del duelo»).
  votacion: { fondo: { ...FONDO_BASE }, elementos: [
    dato("video", "duVideo", "Video de la ronda", 0, 0, 1920, 1080),
    ...piezasColumna(1, { x: 0, y: 0, w: ANCHO_COLUMNA, h: 1080 }),
    ...piezasColumna(2, { x: 1920 - ANCHO_COLUMNA, y: 0, w: ANCHO_COLUMNA, h: 1080 }),
    { id: "logo-app", tipo: "imagen", nombre: "Logo de BizarrApp", src: LOGO_APP, ajuste: "contain", x: 860, y: 20, w: 200, h: 110 },
    dato("centro", "duCentro", "Logo del duelo", 288, 140, 1344, 800,
      { estilo: { fuente: "syne", tamano: 120, peso: 900, color: "#F0E8FF", interlineado: 1.05, espaciado: 0.04 }, opacidad: 0.92 }),
    dato("reloj", "duReloj", "Reloj", 710, 930, 500, 100, {
      estilo: { fuente: "syne", tamano: 64, peso: 900, color: "#F0E8FF" },
      ficha: { fondo: "rgba(8,4,15,.78)", borde: "rgba(240,232,255,.25)", acento: COLOR_P1 } }),
  ] },
  ganador: {
    fondo: { ...FONDO_BASE, tipo: "radial", colores: [`${COLOR_P1}33`, "#08040F"] },
    elementos: [
      tv("titulo", "🏆 GANADOR 🏆", "🏆 GANADOR 🏆", 241, 64, { fuente: "syne", tamano: 52, peso: 900, color: "rgba(240,232,255,.85)", espaciado: 0.15 }),
      dato("cara", "duGanadorAvatar", "Cara del ganador", 830, 329, 260, 260),
      dato("nombre", "duGanadorNombre", "Nombre del ganador", 160, 613, 1600, 170,
        { estilo: { fuente: "syne", tamano: 160, peso: 900, interlineado: 1, color: "#F0E8FF" } }),
      dato("marcador", "duMarcador", "Marcador final", 160, 807, 1600, 50,
        { estilo: { fuente: "syne", tamano: 38, peso: 800, color: "rgba(240,232,255,.8)" } }),
    ],
  },
  empate: {
    fondo: { ...FONDO_BASE, tipo: "radial", colores: ["rgba(255,214,0,.16)", "#08040F"] },
    elementos: [
      tv("icono", "Apretón", "🤝", 221, 150, { fuente: "dmsans", tamano: 140, peso: 400, interlineado: 1 }),
      tv("empate", "¡EMPATE!", "¡EMPATE!", 395, 180, { fuente: "syne", tamano: 170, peso: 900, color: "#FFD600", espaciado: 0.02 }),
      dato("cara1", "duAvatar1", "Cara del duelista 1", 650, 599, 150, 150),
      dato("cara2", "duAvatar2", "Cara del duelista 2", 1120, 599, 150, 150),
      dato("nombre1", "duNombre1", "Nombre del duelista 1", 525, 759, 400, 54, { estilo: { fuente: "syne", tamano: 44, peso: 900, color: COLOR_P1 } }),
      dato("nombre2", "duNombre2", "Nombre del duelista 2", 995, 759, 400, 54, { estilo: { fuente: "syne", tamano: 44, peso: 900, color: COLOR_P2 } }),
      dato("marcador", "duMarcador", "Marcador final", 160, 837, 1600, 50,
        { estilo: { fuente: "syne", tamano: 38, peso: 800, color: "rgba(240,232,255,.8)" } }),
    ],
  },

  // ── Celular ───────────────────────────────────────────────────────────────
  "cel-postulacion": { fondo: { ...FONDO_BASE }, elementos: [
    encabezado(),
    tarjeta("tarjeta", 46, 400, { color: "rgba(255,45,149,.12)", degradado: { colores: ["rgba(255,45,149,.12)", "rgba(255,149,0,.08)"], angulo: 135 } },
      "rgba(255,45,149,.4)", 18),
    { id: "logo", tipo: "imagen", nombre: "Logo del Duelo", src: "/placas/Duelo_de_talento-removebg-preview.png", ajuste: "contain", x: 110, y: 70, w: 170, h: 170 },
    txt("consigna", "Consigna", "¿Te animás a subir al escenario? Postulate y esperá que el staff te elija.", 258, 70,
      { fuente: "dmsans", tamano: 17, peso: 700, color: CREMA(0.75), interlineado: 1.35 }),
    dato("postular", "escPostular", "Botón «Postularme»", 16, 350, 358, 52, {
      texto: "🎤 Postularme", estilo: { fuente: "syne", tamano: 14, peso: 800, color: "#FFFFFF" },
      ficha: { fondo: PINK, borde: "transparent" } }),
  ] },
  "cel-postulado": { fondo: { ...FONDO_BASE }, elementos: [
    encabezado(),
    tarjeta("tarjeta", 46, 90, { color: "rgba(255,45,149,.08)" }, "rgba(255,45,149,.3)", 16),
    txt("postulado", "Estás postulado", "⏳ Estás postulado", 62, 22, { fuente: "dmsans", tamano: 15, peso: 700, color: PINK }),
    dato("estado", "duEstado", "Estado de la postulación", 16, 88, 358, 36,
      { estilo: { fuente: "dmsans", tamano: 12.5, peso: 400, color: CREMA(0.5), interlineado: 1.4 } }),
  ] },
  "cel-votacion": { fondo: { ...FONDO_BASE }, elementos: [
    encabezado(),
    dato("reloj", "duReloj", "Reloj", 95, 40, 200, 36, {
      estilo: { fuente: "syne", tamano: 22, peso: 900, color: "#F0E8FF" },
      ficha: { fondo: "transparent", borde: "transparent", acento: PINK } }),
    dato("vs", "duVs", "Duelista VS duelista", 16, 82, 358, 20,
      { estilo: { fuente: "syne", tamano: 13, peso: 900, color: CREMA(0.5), espaciado: 0.15 } }),
    dato("consigna", "duConsigna", "Cómo se vota", 16, 106, 358, 36,
      { estilo: { fuente: "dmsans", tamano: 13, peso: 400, color: CREMA(0.6), interlineado: 1.35 } }),
    dato("panel", "duPanel", "Botones / marcador", 0, 150, 390, 250),
    dato("saldo", "duSaldo", "Estado del voto", 16, 410, 358, 24, { estilo: { fuente: "dmsans", tamano: 14, peso: 700, color: "#F0E8FF" } }),
  ] },
  "cel-en-escenario": { fondo: { ...FONDO_BASE }, elementos: [
    encabezado(),
    dato("reloj", "duReloj", "Reloj", 95, 40, 200, 36, {
      estilo: { fuente: "syne", tamano: 22, peso: 900, color: "#F0E8FF" },
      ficha: { fondo: "transparent", borde: "transparent", acento: PINK } }),
    tarjeta("tarjeta", 84, 146, { color: "rgba(255,45,149,.18)", degradado: { colores: ["rgba(255,45,149,.18)", "rgba(255,149,0,.10)"], angulo: 135 } }, PINK, 18),
    txt("icono", "Micrófono", "🎤", 100, 46, { fuente: "dmsans", tamano: 40, peso: 400 }),
    txt("en-escenario", "ESTÁS EN EL ESCENARIO", "ESTÁS EN EL ESCENARIO", 150, 26, { fuente: "syne", tamano: 18, peso: 900, color: PINK }),
    txt("mensaje", "Mensaje", "¡Dalo todo! Los duelistas no votan: el público decide.", 178, 40,
      { fuente: "dmsans", tamano: 13, peso: 400, color: CREMA(0.6), interlineado: 1.5 }),
    dato("panel", "duPanel", "Botones / marcador", 0, 244, 390, 200),
  ] },
  "cel-resultado": { fondo: { ...FONDO_BASE }, elementos: [
    encabezado(),
    tarjeta("tarjeta", 46, 140, { color: "rgba(0,245,160,.14)", degradado: { colores: ["rgba(0,245,160,.14)", "rgba(255,45,149,.08)"], angulo: 135 } },
      "rgba(0,245,160,.35)", 20),
    dato("icono", "duIcono", "Ícono del resultado", 16, 66, 358, 56, { estilo: { fuente: "dmsans", tamano: 48, peso: 400, interlineado: 1 } }),
    dato("resultado", "duResultado", "Resultado", 16, 130, 358, 32, { estilo: { fuente: "syne", tamano: 20, peso: 900, color: "#00F5A0" } }),
    dato("panel", "duPanel", "Botones / marcador", 0, 200, 390, 150),
    tarjeta("tarjeta-proxima", 364, 50, { color: "rgba(255,214,0,.07)" }, "rgba(255,214,0,.3)", 14),
    txt("proxima", "Próxima ronda", "⏳ Esperá la próxima ronda", 364, 50, { fuente: "syne", tamano: 15, peso: 800, color: "#FFD600" }),
  ] },
};

