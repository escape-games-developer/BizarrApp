import { EFECTOS_DUELO } from "./efectosPantalla";

/**
 * Forma y valores por defecto de la pantalla «participante listo» y del
 * barómetro de FTL / PT (fila `escenario_listo`, ver hooks/useEscenarioListo.js).
 * Sin Supabase a propósito: lo usa también la vista previa del Diseño de
 * juegos (ver src/main.jsx).
 */

export const TEXTO_LISTO_MAX = 40;

export const FUENTES_LISTO = [
  { id: "syne",    nombre: "Syne",          css: "Syne, sans-serif",            peso: 800 },
  { id: "grotesk", nombre: "Space Grotesk", css: "'Space Grotesk', sans-serif", peso: 700 },
  { id: "sans",    nombre: "Sistema",       css: "system-ui, sans-serif",       peso: 800 },
];
export const POSICIONES_LISTO = [
  { id: "arriba", nombre: "Arriba del avatar" },
  { id: "abajo",  nombre: "Debajo del nombre" },
];
export const fuenteListo = (id) => FUENTES_LISTO.find((f) => f.id === id) || FUENTES_LISTO[0];

const POR_JUEGO = {
  ftl: "LISTO PARA FOLLOW THE LEADER",
  pt:  "LISTO PARA PERSONAL TRAINER",
};
/**
 * Barómetro de la TV durante la performance (migración 20261022160000).
 * Todo sobre la pantalla entera: ancho (% del tamaño base), alto (% del alto),
 * x / y (% — dónde queda su centro). Por defecto, el margen izquierdo de hoy.
 */
export const RANGOS_BARO = Object.freeze({ ancho: [50, 200], alto: [20, 90], x: [3, 97], y: [10, 90] });
export const BARO_POR_DEFECTO = Object.freeze({ ancho: 100, alto: 70, x: 8, y: 61 });

const juegoPorDefecto = (tipo) => ({
  previa: true, centro: "texto", texto: POR_JUEGO[tipo], imagen: null,
  efecto: "ninguno", zoom: 0, posicion: "abajo", fuente: "syne", color: "#FFD600",
  barometro: { ...BARO_POR_DEFECTO },
});

const enRango = (n, [min, max], def) => (Number.isInteger(n) ? Math.max(min, Math.min(max, n)) : def);
const normalizarBaro = (b) => Object.fromEntries(Object.keys(RANGOS_BARO).map((k) =>
  [k, enRango(b?.[k], RANGOS_BARO[k], BARO_POR_DEFECTO[k])]));
export const ESCENARIO_LISTO_POR_DEFECTO = Object.freeze({ ftl: juegoPorDefecto("ftl"), pt: juegoPorDefecto("pt") });

const EFECTOS = EFECTOS_DUELO.map((e) => e.id);
function normalizarJuego(j, tipo) {
  const d = juegoPorDefecto(tipo);
  const imagen = typeof j?.imagen === "string" && j.imagen ? j.imagen : null;
  return {
    previa:   typeof j?.previa === "boolean" ? j.previa : d.previa,
    centro:   j?.centro === "imagen" && imagen ? "imagen" : "texto",
    texto:    typeof j?.texto === "string" && j.texto.trim() ? j.texto : d.texto,
    imagen,
    efecto:   EFECTOS.includes(j?.efecto) ? j.efecto : d.efecto,
    zoom:     Number.isInteger(j?.zoom) ? Math.max(-100, Math.min(100, j.zoom)) : d.zoom,
    posicion: POSICIONES_LISTO.some((p) => p.id === j?.posicion) ? j.posicion : d.posicion,
    fuente:   FUENTES_LISTO.some((f) => f.id === j?.fuente) ? j.fuente : d.fuente,
    color:    typeof j?.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(j.color) ? j.color : d.color,
    barometro: normalizarBaro(j?.barometro),
  };
}
export const normalizarEscenarioListo = (v) => ({ ftl: normalizarJuego(v?.ftl, "ftl"), pt: normalizarJuego(v?.pt, "pt") });
