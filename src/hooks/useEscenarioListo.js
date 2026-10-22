import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseAnon } from "../lib/supabase";
import { EFECTOS_DUELO } from "./useDueloPantalla";

/**
 * Pantalla «participante listo» de Follow the Leader / Personal Trainer en la
 * TV — `admin_ui_config` fila `key='escenario_listo'` (migración
 * 20261022140000_escenario_listo). Se ve cuando el operador llama al
 * participante y todavía no arrancó el video.
 *
 * `value = { version: 1, ftl: <juego>, pt: <juego> }`, cada <juego>:
 *   previa   → mostrar esta pantalla (apagada: la TV sigue en la convocatoria)
 *   centro/texto/imagen → «LISTO PARA …» como texto o como PNG/WEBP
 *   efecto, zoom        → los mismos efectos y tamaño que el logo del Duelo
 *   posicion            → 'arriba' del avatar o 'abajo' del nombre
 *   fuente, color       → tipografía y color del texto
 *   barometro           → ancho, alto, x, y del barómetro durante la performance
 *
 * La TV lo lee por RPC pública cada 3 s (una consulta compartida); el Admin
 * guarda con control de concurrencia sobre `updated_at`.
 */

const TABLA = "admin_ui_config";
const CLAVE = "escenario_listo";
const VERSION = 1;
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
const BARO_POR_DEFECTO = { ancho: 100, alto: 70, x: 8, y: 61 };

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
const normalizar = (v) => ({ ftl: normalizarJuego(v?.ftl, "ftl"), pt: normalizarJuego(v?.pt, "pt") });

// ── Lectura compartida (TV) ─────────────────────────────────────────────────
const CADA_MS = 3000;
const store = { valor: ESCENARIO_LISTO_POR_DEFECTO, subs: new Set(), timer: null };

function leer() {
  return supabaseAnon.rpc("escenario_listo_config").then(({ data, error }) => {
    if (error) { console.error("[useEscenarioListo]", error); return; }
    const nuevo = normalizar(data);
    if (JSON.stringify(nuevo) === JSON.stringify(store.valor)) return;
    store.valor = nuevo;
    store.subs.forEach((fn) => fn(nuevo));
  });
}

function suscribir(fn) {
  store.subs.add(fn);
  if (!store.timer) { leer(); store.timer = setInterval(leer, CADA_MS); }
  return () => {
    store.subs.delete(fn);
    if (!store.subs.size) { clearInterval(store.timer); store.timer = null; }
  };
}

/** TV: `{ ftl, pt }`, al día cada 3 s. */
export function useEscenarioListo() {
  const [config, setConfig] = useState(store.valor);
  useEffect(() => suscribir(setConfig), []);
  return config;
}

/** Admin: lee la fila y guarda la config de UN juego (`guardar(tipo, cambios)`). */
export function useEscenarioListoAdmin() {
  const [config, setConfig] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    const { data, error: e } = await supabase
      .from(TABLA).select("value, updated_at").eq("key", CLAVE).maybeSingle();
    if (e || !data) {
      if (e) console.error("[useEscenarioListoAdmin]", e);
      setConfig(null);
      setError(e ? "No se pudo cargar la pantalla del participante."
        : "Falta aplicar en Supabase la migración 20261022140000_escenario_listo.");
      return;
    }
    setConfig(normalizar(data.value));
    setUpdatedAt(data.updated_at);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = useCallback(async (tipo, cambios) => {
    const nuevo = normalizar({ ...config, [tipo]: { ...config[tipo], ...cambios } });
    nuevo[tipo].texto = nuevo[tipo].texto.trim().slice(0, TEXTO_LISTO_MAX);
    const { data, error: e } = await supabase
      .from(TABLA).update({ value: { version: VERSION, ...nuevo } })
      .eq("key", CLAVE).eq("updated_at", updatedAt)
      .select("value, updated_at");
    if (e) {
      throw new Error(e.code === "42501" ? "Tu usuario no tiene permisos para cambiar esta pantalla."
        : e.code === "23514" ? "Ese valor no es válido para la pantalla del participante."
        : "No se pudo guardar la pantalla del participante.");
    }
    if (!data?.length) {
      await cargar();
      throw new Error("Otra persona cambió esta configuración recién. Se recargó lo vigente: revisalo y probá de nuevo.");
    }
    setConfig(normalizar(data[0].value));
    setUpdatedAt(data[0].updated_at);
    if (store.subs.size) leer();
  }, [config, updatedAt, cargar]);

  return { config, error, guardar, recargar: cargar };
}
