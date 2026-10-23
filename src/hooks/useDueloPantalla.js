import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseAnon } from "../lib/supabase";
import { EFECTOS_DUELO, EFECTOS_CSS, efectoDuelo, ZOOM_MIN, ZOOM_MAX, escalaDeZoom } from "../constants/efectosPantalla";

/**
 * Pantalla del Duelo de Talentos — `admin_ui_config` fila `key='duelo_pantalla'`
 * (migración 20261021210000_duelo_pantalla).
 *
 * `value = { version: 1, centro: 'texto'|'imagen', texto, imagen, porcentajes, efecto }`:
 *   centro/texto/imagen → qué va en el centro de la votación cuando no hay video.
 *   porcentajes         → 👍 + % debajo de cada duelista.
 *   efecto              → animación del centro (ver EFECTOS_DUELO).
 *   zoom                → tamaño del logo de duelo (texto o imagen), -100..100.
 *   fondo               → imagen de fondo cuando la ronda no tiene video.
 *   logoPos             → arriba / centro / abajo del logo de duelo.
 *   panelIzq/panelDer/barometro → layout de la máscara (ver RANGOS).
 *
 * La votación es FONDO (video a pantalla completa, o `fondo`, o negro) +
 * MÁSCARA siempre encima (paneles, barómetros, avatares, logos).
 *
 * La TV lo lee con la RPC pública (sin sesión), con una sola consulta
 * compartida cada 3 s — mismo esquema que usePantallaQr: un cambio del Admin
 * se ve en la pantalla en ≤ 3 s. El Admin guarda con el control de
 * concurrencia de siempre (updated_at).
 */

const TABLA = "admin_ui_config";
const CLAVE = "duelo_pantalla";
const VERSION = 1;
export const TEXTO_MAX = 24;

// Efectos y zoom viven en constants/efectosPantalla.js (sin Supabase, para la
// vista previa del Diseño de juegos); se re-exportan acá por compatibilidad.
export { EFECTOS_DUELO, EFECTOS_CSS, efectoDuelo, ZOOM_MIN, ZOOM_MAX, escalaDeZoom };
const IDS_EFECTO = EFECTOS_DUELO.map((e) => e.id);

/**
 * Layout editable (migración 20261022040000). Rangos = los CHECK de la base.
 *   panelIzq / panelDer → ancho (% del ancho de pantalla) y alto (% del alto,
 *                         centrado vertical), cada lado por separado.
 *   barometro           → ancho (% del tamaño base), alto (% del panel),
 *                         y (% — altura de su centro en el panel) y
 *                         x (% — espejado: 10 borde exterior, 50 centro del
 *                         panel, 90 hacia el centro de la pantalla).
 */
export const RANGOS = Object.freeze({
  panelAncho: [8, 35], panelAlto: [30, 100],
  baroAncho: [50, 200], baroAlto: [20, 90], baroY: [10, 90], baroX: [10, 90],
});
export const POSICIONES_LOGO = [
  { id: "arriba", nombre: "Arriba" }, { id: "centro", nombre: "Centro" }, { id: "abajo", nombre: "Abajo" },
];

export const DUELO_PANTALLA_POR_DEFECTO = Object.freeze({
  centro: "texto", texto: "DUELO", imagen: null, porcentajes: true, efecto: "ninguno", zoom: 0,
  fondo: null, logoPos: "centro",
  panelIzq: { ancho: 15, alto: 100 }, panelDer: { ancho: 15, alto: 100 },
  barometro: { ancho: 100, alto: 60, y: 64, x: 50 },
});

const entero = (n, [min, max], def) => (Number.isInteger(n) ? Math.max(min, Math.min(max, n)) : def);
const panel = (p, def) => ({
  ancho: entero(p?.ancho, RANGOS.panelAncho, def.ancho),
  alto:  entero(p?.alto,  RANGOS.panelAlto,  def.alto),
});

const zoomValido = (z) => (Number.isInteger(z) ? Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)) : 0);

function normalizar(v) {
  const d = DUELO_PANTALLA_POR_DEFECTO;
  const imagen = typeof v?.imagen === "string" && v.imagen ? v.imagen : null;
  return {
    centro:      v?.centro === "imagen" && imagen ? "imagen" : "texto",
    texto:       typeof v?.texto === "string" && v.texto.trim() ? v.texto : d.texto,
    imagen,
    porcentajes: typeof v?.porcentajes === "boolean" ? v.porcentajes : d.porcentajes,
    efecto:      IDS_EFECTO.includes(v?.efecto) ? v.efecto : d.efecto,
    zoom:        zoomValido(v?.zoom),
    fondo:       typeof v?.fondo === "string" && v.fondo ? v.fondo : null,
    logoPos:     POSICIONES_LOGO.some((p) => p.id === v?.logoPos) ? v.logoPos : d.logoPos,
    panelIzq:    panel(v?.panelIzq, d.panelIzq),
    panelDer:    panel(v?.panelDer, d.panelDer),
    barometro: {
      ancho: entero(v?.barometro?.ancho, RANGOS.baroAncho, d.barometro.ancho),
      alto:  entero(v?.barometro?.alto,  RANGOS.baroAlto,  d.barometro.alto),
      y:     entero(v?.barometro?.y,     RANGOS.baroY,     d.barometro.y),
      x:     entero(v?.barometro?.x,     RANGOS.baroX,     d.barometro.x),
    },
  };
}

// ── Lectura compartida (TV) ─────────────────────────────────────────────────
const CADA_MS = 3000;
const store = { valor: DUELO_PANTALLA_POR_DEFECTO, subs: new Set(), timer: null };

function leer() {
  return supabaseAnon.rpc("duelo_pantalla_config").then(({ data, error }) => {
    if (error) { console.error("[useDueloPantalla]", error); return; }
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

/** Relee ya (la vista previa del Diseñador, después de un guardado). */
export function refrescarDueloPantalla() {
  if (store.subs.size) leer();
}

/** Pantalla: `{ centro, texto, imagen, porcentajes }`, al día cada 3 s. */
export function useDueloPantalla() {
  const [config, setConfig] = useState(store.valor);
  useEffect(() => suscribir(setConfig), []);
  return config;
}

/** Admin: lee la fila y la guarda. */
export function useDueloPantallaAdmin() {
  const [config, setConfig] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    const { data, error: e } = await supabase
      .from(TABLA).select("value, updated_at").eq("key", CLAVE).maybeSingle();
    if (e || !data) {
      if (e) console.error("[useDueloPantallaAdmin]", e);
      setConfig(null);
      setError(e ? "No se pudo cargar la configuración de la pantalla del Duelo."
        : "Falta aplicar en Supabase la migración 20261021210000_duelo_pantalla.");
      return;
    }
    setConfig(normalizar(data.value));
    setUpdatedAt(data.updated_at);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = useCallback(async (nueva) => {
    const n = normalizar(nueva);
    const value = { version: VERSION, centro: n.centro, texto: n.texto.trim().slice(0, TEXTO_MAX),
      imagen: n.imagen, porcentajes: n.porcentajes, efecto: n.efecto, zoom: n.zoom,
      fondo: n.fondo, logoPos: n.logoPos, panelIzq: n.panelIzq, panelDer: n.panelDer, barometro: n.barometro };
    const { data, error: e } = await supabase
      .from(TABLA).update({ value }).eq("key", CLAVE).eq("updated_at", updatedAt)
      .select("value, updated_at");
    if (e) {
      throw new Error(e.code === "42501" ? "Tu usuario no tiene permisos para cambiar la pantalla del Duelo."
        : e.code === "23514" ? "Ese valor no es válido para la pantalla del Duelo."
        : "No se pudo guardar la configuración de la pantalla del Duelo.");
    }
    if (!data?.length) {
      await cargar();
      throw new Error("Otra persona cambió esta configuración recién. Se recargó lo vigente: revisalo y probá de nuevo.");
    }
    setConfig(normalizar(data[0].value));
    setUpdatedAt(data[0].updated_at);
    if (store.subs.size) leer();
  }, [updatedAt, cargar]);

  return { config, error, guardar, recargar: cargar };
}
