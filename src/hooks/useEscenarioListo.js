import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseAnon } from "../lib/supabase";
import { normalizarEscenarioListo as normalizar, ESCENARIO_LISTO_POR_DEFECTO, TEXTO_LISTO_MAX } from "../constants/escenarioListo";

// Forma, rangos y valores por defecto viven en constants/escenarioListo.js
// (sin Supabase, para la vista previa); se re-exportan acá por compatibilidad.
export {
  TEXTO_LISTO_MAX, FUENTES_LISTO, POSICIONES_LISTO, fuenteListo, RANGOS_BARO, ESCENARIO_LISTO_POR_DEFECTO,
} from "../constants/escenarioListo";

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
