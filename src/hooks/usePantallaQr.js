import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseAnon } from "../lib/supabase";

/**
 * Visibilidad del QR y del logo de BizarrApp en las pantallas de cada juego.
 * Dos filas de `admin_ui_config` con la misma forma:
 *   key='pantalla_qr'   (migraciones 20261019230000 y 20261020010000)
 *   key='pantalla_logo' (migración 20261020030000)
 *   value = { version: 1, <juego>: bool, ... }  (ver JUEGOS_CON_QR)
 * Por defecto, todo visible. Cada juego manda en sus tres pantallas: la placa
 * de anuncio, la convocatoria y el juego en pantalla.
 *
 * `usePantallaQr` / `usePantallaLogo` los lee la TV (RPC pública, cliente
 * anónimo), con una sola consulta compartida cada 3 s (ver «Lectura
 * compartida»): un cambio en Ajustes se ve en la pantalla en ≤ 3 s.
 * `usePantallaVisibilidadAdmin(tipo)` lee y guarda Ajustes con el control de
 * concurrencia de siempre (updated_at).
 */

export const JUEGOS_CON_QR = [
  { id: "rey",     seccion: "Juegos",    nombre: "Rey del Orto",       icono: "🎰" },
  { id: "trivia",  seccion: "Juegos",    nombre: "Desafío Demente",    icono: "🧠" },
  { id: "suma",    seccion: "Juegos",    nombre: "Sumate que sumamos", icono: "🔢" },
  { id: "palabra", seccion: "Juegos",    nombre: "Arma la palabra",    icono: "🔤" },
  { id: "duelo",   seccion: "Juegos",    nombre: "Duelo de Talentos",  icono: "🎤" },
  { id: "ftl",     seccion: "Escenario", nombre: "Follow the Leader",  icono: "💃" },
  { id: "pt",      seccion: "Escenario", nombre: "Personal Trainer",   icono: "🏋️" },
];

export const QR_POR_DEFECTO = Object.freeze(Object.fromEntries(JUEGOS_CON_QR.map(({ id }) => [id, true])));

/** `game_state.active_game` → id de juego. */
export const QR_DE_JUEGO = Object.freeze({
  "rey del orto": "rey", trivia: "trivia", suma: "suma", palabra: "palabra",
});

/** Placa de anuncio (`active_placa`) → id de juego y a dónde lleva su QR. */
export const PLACA_DE_JUEGO = Object.freeze({
  game_rey:      { id: "rey",     vista: "games" },
  game_trivia:   { id: "trivia",  vista: "games" },
  game_suma:     { id: "suma",    vista: "games" },
  game_palabra:  { id: "palabra", vista: "games" },
  duelo:         { id: "duelo",   vista: "games&game=duelo" },
  escenario_ftl: { id: "ftl",     vista: "escenario" },
  escenario_pt:  { id: "pt",      vista: "escenario" },
});

const TIPOS = {
  qr:   { clave: "pantalla_qr",   rpc: "pantalla_qr_config",   que: "el QR",
          migracion: "20261019230000_pantalla_qr" },
  logo: { clave: "pantalla_logo", rpc: "pantalla_logo_config", que: "el logo",
          migracion: "20261020030000_pantalla_logo" },
};

const TABLA = "admin_ui_config";
const VERSION = 1;

const normalizar = (v) => Object.fromEntries(JUEGOS_CON_QR.map(({ id }) =>
  [id, typeof v?.[id] === "boolean" ? v[id] : QR_POR_DEFECTO[id]]));

// ── Lectura compartida ──────────────────────────────────────────────────────
// Una pantalla monta varios componentes que leen lo mismo (placa, QR del
// juego, convocatoria, Duelo…). En vez de que cada uno consulte por su lado,
// hay UNA consulta por tipo cada CADA_MS, compartida por todos los que están
// suscriptos; arranca con el primero y se apaga con el último. La tabla no
// está en Realtime (y la TV no tiene sesión), por eso se consulta.
const CADA_MS = 3000;
const stores = {};   // tipo → { valor, subs: Set, timer }

function leerStore(tipo) {
  const s = stores[tipo];
  // RPC pública: el cliente anónimo sirve en la TV y en el Admin.
  return supabaseAnon.rpc(TIPOS[tipo].rpc).then(({ data, error }) => {
    if (error) { console.error(`[usePantallaVisibilidad:${tipo}]`, error); return; }
    const nuevo = normalizar(data);
    if (JSON.stringify(nuevo) === JSON.stringify(s.valor)) return;
    s.valor = nuevo;
    s.subs.forEach((fn) => fn(nuevo));
  });
}

function suscribir(tipo, fn) {
  const s = stores[tipo] ||= { valor: QR_POR_DEFECTO, subs: new Set(), timer: null };
  s.subs.add(fn);
  if (!s.timer) {
    leerStore(tipo);
    s.timer = setInterval(() => leerStore(tipo), CADA_MS);
  }
  return () => {
    s.subs.delete(fn);
    if (!s.subs.size) { clearInterval(s.timer); s.timer = null; }
  };
}

/** Relee ya (lo llama Ajustes después de guardar, para la vista previa). */
export function refrescarPantallaVisibilidad(tipo) {
  if (stores[tipo]?.subs.size) leerStore(tipo);
}

function usePantallaVisibilidad(tipo) {
  const [config, setConfig] = useState(() => stores[tipo]?.valor || QR_POR_DEFECTO);
  useEffect(() => suscribir(tipo, setConfig), [tipo]);
  return config;
}

/** `{ <juego>: bool }` → true = se muestra el QR. */
export const usePantallaQr   = () => usePantallaVisibilidad("qr");
/** `{ <juego>: bool }` → true = se muestra el logo de BizarrApp. */
export const usePantallaLogo = () => usePantallaVisibilidad("logo");

/** Admin (Ajustes): lee la fila de `tipo` ('qr' | 'logo') y la guarda. */
export function usePantallaVisibilidadAdmin(tipo) {
  const { clave, que, migracion } = TIPOS[tipo];
  const [config, setConfig] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    const { data, error: e } = await supabase
      .from(TABLA).select("value, updated_at").eq("key", clave).maybeSingle();
    if (e || !data) {
      if (e) console.error("[usePantallaVisibilidadAdmin]", e);
      setConfig(null);
      setError(e
        ? `No se pudo cargar la configuración de ${que}.`
        : `Falta aplicar en Supabase la migración ${migracion}.`);
      return;
    }
    setConfig(normalizar(data.value));
    setUpdatedAt(data.updated_at);
  }, [clave, que, migracion]);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = useCallback(async (nueva) => {
    const { data, error: e } = await supabase
      .from(TABLA).update({ value: { version: VERSION, ...normalizar(nueva) } })
      .eq("key", clave).eq("updated_at", updatedAt)
      .select("value, updated_at");
    if (e) {
      throw new Error(e.code === "42501"
        ? `Tu usuario no tiene permisos para cambiar ${que}.`
        : `No se pudo guardar la configuración de ${que}.`);
    }
    if (!data?.length) {
      await cargar();
      throw new Error("Otra persona cambió esta configuración recién. Se recargó lo vigente: revisalo y probá de nuevo.");
    }
    setConfig(normalizar(data[0].value));
    setUpdatedAt(data[0].updated_at);
    refrescarPantallaVisibilidad(tipo);
  }, [clave, que, updatedAt, cargar, tipo]);

  return { config, error, guardar, recargar: cargar };
}
