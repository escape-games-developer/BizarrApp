import { LOGO_APP, pantalla, qr } from "./piezas";

/**
 * Diseño de fábrica de la pantalla del DJ Democracy en el editor: calca el
 * diseño del Diseñador TV que estaba en vivo en el bar (evento LDR4X3, en %
 * de pantalla → px sobre 1920 × 1080). Fila `lienzo_dj`.
 *
 * Sin pantalla guardada la TV sigue con el diseño viejo del evento
 * (`pantalla_events.tv_canvas_config`).
 */

export const PANTALLAS_DJ = [
  { id: "dj", nombre: "Pantalla del DJ" },
];

const dato = (id, d, nombre, x, y, w, h, extra = {}) => ({ id, tipo: "dato", dato: d, nombre, x, y, w, h, ...extra });

/**
 * El título de «Próximas canciones» era parte de la lista (`texto`, en el
 * color «Título»). Ahora es un texto suelto: se edita, se formatea y se mueve
 * aparte. Lo deja donde se veía y la lista empieza debajo, así un diseño
 * guardado no se mueve (separarProximas).
 */
function separarTitulo(el) {
  if (el.tipo !== "dato" || el.dato !== "djProximas" || !el.texto) return [el];
  const t = el.estilo?.tamano || 22;
  const relleno = Math.round(t * 0.7), altoTitulo = Math.round(t * 1.05 * 1.3), corrimiento = altoTitulo + Math.round(t * 0.45);
  const acento = el.ficha?.acento || "#00F5A0";
  const titulo = {
    id: `${el.id}-titulo`, tipo: "texto", nombre: "Título de próximas", texto: el.texto,
    x: el.x + relleno, y: el.y + relleno, w: Math.max(40, el.w - relleno * 2), h: altoTitulo, visible: el.visible !== false,
    estilo: { ...el.estilo, tamano: Math.round(t * 1.05), interlineado: 1.1, color: acento, degradado: null },
  };
  return [titulo, { ...el, texto: "", y: el.y + corrimiento, h: Math.max(40, el.h - corrimiento) }];
}

/** Pone al día una pantalla del DJ guardada con el título dentro de la lista. */
export function separarProximas(p) {
  if (!p?.elementos?.some((e) => e.tipo === "dato" && e.dato === "djProximas" && e.texto)) return p;
  return { ...p, elementos: p.elementos.flatMap(separarTitulo) };
}

export const DJ_POR_DEFECTO = {
  dj: pantalla(
    dato("video", "djVideo", "Video del DJ", 0, 0, 1920, 1080),
    // El logo del evento (Personalización visual) reemplaza a éste en la TV.
    { id: "logo", tipo: "imagen", nombre: "Logo", src: LOGO_APP, ajuste: "contain", x: 24, y: 8, w: 317, h: 196 },
    // El mismo QR de los juegos (lugar, tamaño y leyenda); lleva a votar.
    { ...qr("Escaneá para votar"), nombre: "QR para votar", leyenda: "arriba" },
    { id: "fondo-proximas", tipo: "forma", nombre: "Fondo de próximas", x: 1564, y: 741, w: 365, h: 378,
      relleno: { color: "rgba(17,17,17,.65)" }, borde: { color: "transparent", ancho: 0 }, radio: 15 },
    ...separarTitulo(dato("proximas", "djProximas", "Próximas canciones", 1564, 741, 365, 378, {
      texto: "PRÓXIMAS CANCIONES", proporcion: 0.8, cantidad: 8,
      estilo: { fuente: "poppins", tamano: 22, peso: 700, color: "#F0E8FF", alinear: "left" },
      ficha: { fondo: "rgba(240,232,255,.03)", borde: "rgba(240,232,255,.06)", acento: "#00E5FF" },
    })),
    dato("evento", "djEvento", "Nombre del evento", 1517, 22, 365, 86, {
      estilo: { fuente: "grotesk", tamano: 17, peso: 700, color: "#F0E8FF" },
    }),
    dato("sonando", "djSonando", "Sonando ahora", 1279, 8, 644, 212, {
      estilo: { fuente: "grotesk", tamano: 51, peso: 700, color: "#FFD600", alinear: "left", sombra: { color: "#000", x: 0, y: 2, blur: 14 } },
      ficha: { fondo: "transparent", borde: "transparent", acento: "rgba(240,232,255,.6)" },
    }),
    // Los cinco del DJ Democracy original que el Diseñador TV viejo tenía pero la
    // TV nunca dibujaba; mismas cajas que en el diseño en vivo.
    dato("progreso", "djProgreso", "Barra de progreso", 384, 160, 860, 12, {
      texto: "", estilo: { fuente: "grotesk", tamano: 18, peso: 700, color: "#F0E8FF" },
      ficha: { fondo: "rgba(255,255,255,.15)", borde: "transparent", acento: "#FFD600" },
    }),
    dato("estado", "djEstado", "Pastillas de estado", 1528, 374, 365, 86, {
      estilo: { fuente: "grotesk", tamano: 16, peso: 700, color: "#F0E8FF", espaciado: 0.06 },
      ficha: { fondo: "rgba(8,4,15,.6)", borde: "rgba(240,232,255,.15)" },
    }),
    dato("equipos", "djEquipos", "Marcador de equipos", 1517, 500, 365, 124, {
      estilo: { fuente: "grotesk", tamano: 20, peso: 700, color: "#F0E8FF" },
      ficha: { fondo: "rgba(8,4,15,.6)", borde: "rgba(240,232,255,.15)", acento: "#FFD600" },
    }),
    dato("gif-premio", "djGifPremio", "GIF a pantalla (premio)", 38, 270, 307, 346, {
      texto: "🎞 {}", estilo: { fuente: "grotesk", tamano: 22, peso: 700, color: "#FFD600" },
      ficha: { fondo: "rgba(8,4,15,.6)", borde: "rgba(255,214,0,.35)" },
    }),
    dato("votacion-cerrada", "djVotacionCerrada", "Aviso de votación cerrada", 422, 929, 1037, 108, {
      texto: "❄ VOTACIÓN CERRADA — PREPARANDO PRÓXIMA", estilo: { fuente: "grotesk", tamano: 44, peso: 700, color: "#FFFFFF" },
      ficha: { fondo: "rgba(8,4,15,.72)", borde: "rgba(255,214,0,.35)" },
    }),
    dato("contador", "djContador", "Contador Sacar tema", 614, 810, 691, 86, {
      texto: "👎 SACAR TEMA · {}", estilo: { fuente: "syne", tamano: 26, peso: 900, color: "#FFFFFF", espaciado: 0.04 },
      ficha: { fondo: "#ef4444", borde: "rgba(255,255,255,.3)", acento: "#FFFFFF" },
    }),
    { ...dato("transicion", "djTransicion", "Transición entre canciones", 672, 378, 576, 270), visible: false },
  ),
};
