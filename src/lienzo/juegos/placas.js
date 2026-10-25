import { FONDO_BASE } from "../modelo";
import { LOGO_APP, qr } from "./piezas";

/**
 * Diseño de fábrica de las placas de Lanzar en el editor (fila
 * `lienzo_placas`): calca PlacaScreen (TV) y el banner de MensajeCliente
 * (celular) sin lienzo guardado.
 *
 * TV, 1920 × 1080: el fondo en degradé con las luces y el marco fino de cada
 * placa, la imagen oficial (Break, Cierre) o el texto del operador (Mensaje,
 * Promo), y el logo de BizarrApp y el QR a la app — que además respetan los
 * interruptores «QR y logo» de cada placa.
 * Celular: banner de 390 × 110 arriba de la app (sólo Mensaje y Promo: Break y
 * Cierre no tienen pantalla en el celular).
 */

export const PANTALLAS_PLACAS = {
  break:   [{ id: "break",   nombre: "Break" }],
  cierre:  [{ id: "cierre",  nombre: "Cierre" }],
  mensaje: [{ id: "mensaje", nombre: "Mensaje" }],
  promo:   [{ id: "promo",   nombre: "Promo" }],
};
export const PANTALLAS_PLACAS_CEL = {
  mensaje: [{ id: "cel-mensaje", nombre: "Banner del mensaje" }],
  promo:   [{ id: "cel-promo",   nombre: "Banner de la promo" }],
};

const fondo = (mid, glow, marco) => ({
  ...FONDO_BASE, tipo: "lineal", colores: [mid, "#08040F"], angulo: 160,
  orbs: true, orbsColores: [glow, glow, "rgba(0,0,0,0)"], marco,
});

const logoApp = () => ({ id: "logo-app", tipo: "imagen", nombre: "Logo de BizarrApp", src: LOGO_APP, ajuste: "contain",
  x: 64, y: 64, w: 200, h: 130, efecto: "campana" });
const qrApp = () => ({ ...qr("Escaneá y sumate a BizarrApp"), nombre: "QR a la app" });
const imagen = (src, nombre) => ({ id: "imagen", tipo: "imagen", nombre, src, ajuste: "contain",
  x: 173, y: 151, w: 1574, h: 778, efecto: "latido" });
const textoOperador = (y, colores) => ({ id: "texto", tipo: "dato", dato: "placaTexto", nombre: "Texto del operador",
  x: 96, y, w: 1728, h: 220,
  estilo: { fuente: "syne", tamano: 100, peso: 900, interlineado: 1, espaciado: -0.03, degradado: { colores, angulo: 135 } } });
const subtitulo = (y) => ({ id: "subtitulo", tipo: "dato", dato: "placaSubtitulo", nombre: "Subtítulo", x: 288, y, w: 1344, h: 50,
  estilo: { fuente: "grotesk", tamano: 32, peso: 500, color: "rgba(240,232,255,.45)", interlineado: 1.4 } });

const MENSAJE = ["#FFD600", "#FF9500", "#FF2D78"];
const PROMO = ["#00E5FF", "#00F5A0"];

export const PLACAS_POR_DEFECTO = {
  break: { fondo: fondo("#2A1400", "rgba(255,149,0,.4)", "rgba(255,149,0,.25)"),
    elementos: [imagen("/placas/Break-removebg-preview.png", "Imagen del Break"), logoApp(), qrApp()] },
  cierre: { fondo: fondo("#0D0820", "rgba(155,47,255,.4)", "rgba(155,47,255,.25)"),
    elementos: [imagen("/placas/Gracias_por_esta_noche-removebg-preview.png", "Imagen del cierre"), logoApp(), qrApp()] },
  mensaje: { fondo: fondo("#2D1000", "rgba(255,149,0,.4)", "rgba(255,149,0,.25)"),
    elementos: [textoOperador(430, MENSAJE), subtitulo(670), logoApp(), qrApp()] },
  promo: { fondo: fondo("#001A2E", "rgba(0,229,255,.35)", "rgba(0,229,255,.2)"),
    elementos: [
      { id: "emoji", tipo: "dato", dato: "placaEmoji", nombre: "Emoji de la promo", x: 760, y: 250, w: 400, h: 160,
        estilo: { fuente: "dmsans", tamano: 130, peso: 400, interlineado: 1 }, efecto: "flotar" },
      textoOperador(430, PROMO), subtitulo(670), logoApp(), qrApp(),
    ] },
};

// ── Banner del celular ─────────────────────────────────────────────────────
const CREMA = (a) => `rgba(245,230,192,${a})`;
const banner = ({ colores, borde, etiqueta, color, grad, conEmoji }) => ({
  fondo: { ...FONDO_BASE },
  elementos: [
    { id: "tarjeta", tipo: "forma", nombre: "Tarjeta", x: 0, y: 0, w: 390, h: 110,
      relleno: { color: colores[0], degradado: { colores, angulo: 160 } }, borde: { color: borde, ancho: 1 }, radio: 14 },
    { id: "etiqueta", tipo: "texto", nombre: "Etiqueta", texto: etiqueta, x: 14, y: 12, w: 320, h: 16,
      estilo: { fuente: "dmsans", tamano: 10, peso: 700, color, espaciado: 0.1, alinear: "left" } },
    ...(conEmoji ? [{ id: "emoji", tipo: "dato", dato: "placaEmoji", nombre: "Emoji de la promo", x: 14, y: 34, w: 38, h: 38,
      estilo: { fuente: "dmsans", tamano: 30, peso: 400, interlineado: 1, alinear: "left" } }] : []),
    { id: "texto", tipo: "dato", dato: "placaTexto", nombre: "Texto del operador", x: conEmoji ? 58 : 14, y: 34, w: conEmoji ? 318 : 362, h: 30,
      estilo: { fuente: "syne", tamano: 18, peso: 900, interlineado: 1.2, alinear: "left", degradado: { colores: grad, angulo: 135 } } },
    { id: "subtitulo", tipo: "dato", dato: "placaSubtitulo", nombre: "Subtítulo", x: 14, y: 72, w: 362, h: 30,
      estilo: { fuente: "dmsans", tamano: 12, peso: 400, color: CREMA(0.6), alinear: "left", interlineado: 1.4 } },
    { id: "cerrar", tipo: "dato", dato: "placaCerrar", nombre: "Botón cerrar", x: 352, y: 4, w: 30, h: 30,
      estilo: { fuente: "dmsans", tamano: 18, peso: 400, color: CREMA(0.45) } },
  ],
});

Object.assign(PLACAS_POR_DEFECTO, {
  "cel-mensaje": banner({ colores: ["#1A0600", "#2D1000"], borde: "rgba(255,214,0,.33)", etiqueta: "📣 MENSAJE DEL BAR",
    color: "#FFD600", grad: MENSAJE }),
  "cel-promo": banner({ colores: ["#001A1A", "#001A2E"], borde: "rgba(0,229,255,.33)", etiqueta: "🍺 PROMO",
    color: "#00E5FF", grad: PROMO, conEmoji: true }),
});
