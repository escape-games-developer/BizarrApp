import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseAnon } from "../lib/supabase";

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

/**
 * Efectos animados del centro (texto o imagen). Migración 20261021230000.
 * `anim` es la regla `animation` de CSS; los keyframes viven en EFECTOS_CSS.
 * `origen` es el transform-origin (la campana pivota desde arriba).
 */
export const EFECTOS_DUELO = [
  { id: "ninguno", nombre: "Sin efecto",     icono: "⏹",  anim: "none" },
  { id: "latido",  nombre: "Latido",         icono: "💓", anim: "dpLatido 1.3s ease-in-out infinite" },
  { id: "campana", nombre: "Campana",        icono: "🔔", anim: "dpCampana 2.4s ease-in-out infinite", origen: "50% 0" },
  { id: "flotar",  nombre: "Flotar",         icono: "🎈", anim: "dpFlotar 3s ease-in-out infinite" },
  { id: "neon",    nombre: "Neón titilante", icono: "💡", anim: "dpNeon 2.8s linear infinite" },
  { id: "glitch",  nombre: "Glitch",         icono: "📺", anim: "dpGlitch 2.2s steps(1,end) infinite" },
  { id: "giro",    nombre: "Giro 3D",        icono: "🔄", anim: "dpGiro 4s ease-in-out infinite" },
  { id: "rebote",  nombre: "Rebote",         icono: "🏀", anim: "dpRebote 1.6s cubic-bezier(.3,0,.4,1) infinite" },
];

export const EFECTOS_CSS = `
  @keyframes dpLatido{0%,100%{transform:scale(1)}14%{transform:scale(1.12)}28%{transform:scale(1)}42%{transform:scale(1.08)}70%{transform:scale(1)}}
  @keyframes dpCampana{0%{transform:rotate(0)}10%{transform:rotate(12deg)}22%{transform:rotate(-10deg)}34%{transform:rotate(7deg)}46%{transform:rotate(-5deg)}58%{transform:rotate(2.5deg)}70%{transform:rotate(-1deg)}80%,100%{transform:rotate(0)}}
  @keyframes dpFlotar{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-4.5%) rotate(1deg)}}
  @keyframes dpNeon{0%,18%,22%,25%,53%,57%,100%{opacity:1;filter:brightness(1.15)}20%,24%,55%{opacity:.35;filter:brightness(.6)}}
  @keyframes dpGlitch{0%,86%,100%{transform:translate(0);filter:none}88%{transform:translate(-1.5%,.6%) skewX(-6deg);filter:drop-shadow(-6px 0 #00E5FF) drop-shadow(6px 0 #FF2D78)}91%{transform:translate(1.5%,-.6%) skewX(5deg);filter:drop-shadow(6px 0 #00E5FF) drop-shadow(-6px 0 #FF2D78)}94%{transform:translate(-.6%,0);filter:none}}
  @keyframes dpGiro{0%,35%{transform:perspective(900px) rotateY(0)}65%,100%{transform:perspective(900px) rotateY(360deg)}}
  @keyframes dpRebote{0%,100%{transform:translateY(0) scale(1,1)}10%{transform:translateY(0) scale(1.08,.92)}35%{transform:translateY(-9%) scale(.96,1.04)}55%{transform:translateY(0) scale(1.05,.95)}65%{transform:translateY(-2.5%)}75%{transform:translateY(0)}}
`;

const IDS_EFECTO = EFECTOS_DUELO.map((e) => e.id);
export const efectoDuelo = (id) => EFECTOS_DUELO.find((e) => e.id === id) || EFECTOS_DUELO[0];

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

/**
 * Zoom del logo de duelo (-100..100, migración 20261022010000) → escala.
 * 0 = tamaño normal; 100 = el doble; -100 = un quinto.
 */
export const ZOOM_MIN = -100;
export const ZOOM_MAX = 100;
export const escalaDeZoom = (zoom) => (zoom >= 0 ? 1 + zoom / 100 : 1 + (zoom / 100) * 0.8);
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
