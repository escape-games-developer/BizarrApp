import { FONDO_BASE } from "../modelo";
import { ESCENARIO_JUEGOS } from "../../constants/escenarioJuegos";
import { CREMA, LOGO_APP, celTitulo, qr, txt } from "./piezas";

/**
 * Diseño de fábrica de Follow the Leader y Personal Trainer en el editor
 * (filas `lienzo_ftl` / `lienzo_pt`): calca FtlStandbyVista (convocatoria y
 * participante listo), FtlOverlay (la performance, transparente sobre el
 * video) y JuegoEscenarioView (celular), con los colores de cada juego.
 */

export const PANTALLAS_ESCENARIO = [
  { id: "convocatoria", nombre: "Convocatoria",       vista: "convocatoria" },
  { id: "listo",        nombre: "Participante listo", vista: "listo" },
  { id: "performance",  nombre: "Performance",        vista: "performance" },
];
export const PANTALLAS_ESCENARIO_CEL = [
  { id: "cel-postulacion",  nombre: "Postulación" },
  { id: "cel-anotado",      nombre: "Anotado" },
  { id: "cel-en-escenario", nombre: "En el escenario" },
  { id: "cel-votando",      nombre: "Votando" },
];

const FONDO_ESCENARIO = { ...FONDO_BASE, tipo: "radial", colores: ["#1A0D2E", "#08040F"] };
const dato = (id, d, nombre, x, y, w, h, extra = {}) => ({ id, tipo: "dato", dato: d, nombre, x, y, w, h, ...extra });
const videoEntero = () => dato("video", "escVideo", "Video del desafío", 0, 0, 1920, 1080);

/**
 * Performance guardada antes de que existiera «Video del desafío»: era
 * transparente sobre el video a pantalla completa, así que se le agrega ése,
 * al fondo de la lista. El editor lo hace al abrir.
 */
export function conVideo(p) {
  if (!p?.elementos || p.elementos.some((e) => e.tipo === "dato" && e.dato === "escVideo")) return p;
  return { ...p, elementos: [videoEntero(), ...p.elementos] };
}

function diseno(tipo) {
  const j = ESCENARIO_JUEGOS[tipo];
  const titulo = () => celTitulo(`${j.icon} ${j.label}`);
  const tarjeta = (id, y, h, extra = {}) => ({ id, tipo: "forma", nombre: "Tarjeta", x: 0, y, w: 390, h,
    relleno: { color: j.bgCliente }, borde: { color: j.bordeCliente, ancho: 2 }, radio: 16, ...extra });

  return {
    convocatoria: { fondo: { ...FONDO_ESCENARIO }, elementos: [
      { id: "logo", tipo: "imagen", nombre: "Logo del juego", src: j.placa, ajuste: "contain", x: 384, y: 205, w: 1152, h: 670 },
      { id: "logo-app", tipo: "imagen", nombre: "Logo de BizarrApp", src: LOGO_APP, ajuste: "contain", x: 64, y: 64, w: 200, h: 130, efecto: "campana" },
      qr(),
    ] },
    listo: { fondo: { ...FONDO_ESCENARIO }, elementos: [
      dato("avatar", "escAvatar", "Avatar del participante", 873, 356, 173, 173,
        { estilo: { tamano: 86 }, ficha: { fondo: "rgba(240,232,255,.06)", borde: "#FFD600" } }),
      dato("nombre", "escNombre", "Nombre del participante", 192, 561, 1536, 90,
        { estilo: { fuente: "syne", tamano: 76, peso: 900, color: "#F0E8FF", sombra: { color: "rgba(0,0,0,.8)", x: 0, y: 4, blur: 22 } } }),
      dato("listo", "escListo", "Cartel «Listo para…»", 192, 683, 1536, 60, { estilo: { tamano: 30 } }),
    ] },
    // El video del participante (área) a pantalla completa; el resto, encima.
    performance: { fondo: { ...FONDO_BASE }, elementos: [
      videoEntero(),
      dato("avatar", "escAvatar", "Avatar del participante", 81, 32, 144, 144,
        { estilo: { tamano: 81 }, ficha: { fondo: "rgba(8,4,15,.6)", borde: "#FFD600" } }),
      dato("nombre", "escNombre", "Nombre del participante", 38, 189, 230, 84,
        { estilo: { fuente: "syne", tamano: 35, peso: 900, color: "#F0E8FF", interlineado: 1.1, sombra: { color: "#000", x: 0, y: 2, blur: 12 } } }),
      dato("barometro", "escBarometro", "Barómetro", 124, 281, 60, 756),
    ] },

    // ── Celular ───────────────────────────────────────────────────────────
    "cel-postulacion": { fondo: { ...FONDO_BASE }, elementos: [
      titulo(),
      dato("vestuario", "escVestuario", "Vestuario", 0, 46, 390, 116, {
        estilo: { fuente: "dmsans", tamano: 12, peso: 400, color: CREMA(0.7), alinear: "left" },
        ficha: { fondo: j.bgCliente, borde: j.bordeCliente, acento: j.textoCliente } }),
      tarjeta("tarjeta", 176, 404, { radio: 18, borde: { color: j.bordeCliente, ancho: 1 } }),
      { id: "logo", tipo: "imagen", nombre: "Logo del juego", src: j.placa, ajuste: "contain", x: 110, y: 200, w: 170, h: 170 },
      txt("titulo-juego", "Título", j.titulo, 388, 50, { fuente: "dmsans", tamano: 17, peso: 700, color: j.textoCliente, interlineado: 1.35 }),
      dato("postular", "escPostular", "Botón «Quiero participar»", 16, 456, 358, 52, {
        texto: j.botonPostular, estilo: { fuente: "syne", tamano: 14, peso: 800, color: "#FFFFFF" },
        ficha: { fondo: j.colorCliente, borde: "transparent" } }),
    ] },
    "cel-anotado": { fondo: { ...FONDO_BASE }, elementos: [
      tarjeta("tarjeta", 0, 196),
      txt("icono", "Ícono", "🎟️", 22, 44, { fuente: "dmsans", tamano: 36, peso: 400 }),
      txt("titulo-anotado", "¡Estás anotado!", "🎟️ ¡Estás anotado!", 74, 26, { fuente: "dmsans", tamano: 16, peso: 700, color: j.textoCliente }),
      txt("mensaje", "Mensaje", "Esperá que el staff te llame al escenario.", 104, 20, { fuente: "dmsans", tamano: 11, peso: 400, color: CREMA(0.35) }),
      dato("salir", "escSalir", "Botón «Salir de la cola»", 125, 138, 140, 30, {
        texto: "Salir de la cola", estilo: { fuente: "dmsans", tamano: 10, peso: 700, color: "#FCA5A5" },
        ficha: { fondo: "rgba(239,68,68,.1)", borde: "rgba(239,68,68,.22)" } }),
    ] },
    "cel-en-escenario": { fondo: { ...FONDO_BASE }, elementos: [
      tarjeta("tarjeta", 0, 176, { relleno: { color: "rgba(255,149,0,.12)" }, borde: { color: "rgba(255,149,0,.45)", ancho: 2 } }),
      txt("icono", "Ícono", "🎤", 22, 44, { fuente: "dmsans", tamano: 36, peso: 400 }),
      txt("titulo-escenario", "Estás en el escenario", "🎤 Estás en el escenario", 74, 26, { fuente: "dmsans", tamano: 16, peso: 700, color: "#FDBA74" }),
      dato("desafio", "escDesafio", "Canción del desafío", 16, 104, 358, 20,
        { texto: "Canción: {}", estilo: { fuente: "dmsans", tamano: 12, peso: 400, color: CREMA(0.5) } }),
      txt("mensaje", "Mensaje", "Esperá las indicaciones del conductor.", 130, 20, { fuente: "dmsans", tamano: 11, peso: 400, color: CREMA(0.35) }),
    ] },
    "cel-votando": { fondo: { ...FONDO_BASE }, elementos: [
      titulo(),
      tarjeta("tarjeta", 46, 76, { radio: 14, borde: { color: j.bordeCliente, ancho: 1 } }),
      dato("avatar", "escAvatar", "Avatar del participante", 12, 60, 48, 48,
        { estilo: { tamano: 26 }, ficha: { fondo: "rgba(255,255,255,.05)", borde: j.colorCliente } }),
      txt("en-escenario", "EN EL ESCENARIO", "EN EL ESCENARIO", 62, 16,
        { fuente: "dmsans", tamano: 10.5, peso: 700, color: CREMA(0.4), espaciado: 0.1, alinear: "left" }, 72, 300),
      dato("nombre", "escNombre", "Nombre del participante", 72, 80, 300, 26,
        { estilo: { fuente: "dmsans", tamano: 17, peso: 700, color: j.textoCliente, alinear: "left" } }),
      dato("votacion", "escVotacion", "Votación del público", 0, 138, 390, 300),
    ] },
  };
}

export const ESCENARIO_POR_DEFECTO = { ftl: diseno("ftl"), pt: diseno("pt") };
