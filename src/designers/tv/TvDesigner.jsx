import { useEffect, useState } from "react";
import { cloneConfig, DEFAULT_TV_CONFIG } from "../defaults";
import { loadTvConfig, normalizeTvConfig, resetTvConfig, saveTvConfig } from "../lib/persistence";
import { fetchCanvasConfig, saveCanvasConfig } from "../../services/pantallaConfig";
import { fetchLiveEvent, fetchEvent } from "../../services/pantallaDj";
import { designerTheme as T } from "../theme";
import TvPropertiesPanel from "./TvPropertiesPanel";
import TvStage from "./TvStage";

const button = { alignItems: "center", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, color: T.foreground, cursor: "pointer", display: "inline-flex", fontSize: 11, fontWeight: 700, gap: 6, padding: "8px 11px" };

// Misma clave que usa el panel de Pantalla para recordar el evento elegido.
const LS_EVENTO = "bizarrapp_pantalla_event";

/**
 * Resuelve contra qué evento trabaja el diseñador: el que esté elegido en el
 * panel de Pantalla, y si no, el que esté en vivo. Sin evento no hay dónde
 * guardar, y se dice en pantalla en vez de guardar en el vacío.
 */
async function resolverEvento() {
  const guardado = (() => {
    try { return localStorage.getItem(LS_EVENTO); } catch { return null; }
  })();
  if (guardado) {
    const ev = await fetchEvent(guardado).catch(() => null);
    if (ev) return ev;
  }
  return fetchLiveEvent().catch(() => null);
}

export default function TvDesigner({ sessionId = "default" }) {
  const [config, setConfig] = useState(() => loadTvConfig(sessionId));
  const [selectedId, setSelectedId] = useState("video");
  const [fullscreen, setFullscreen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [evento, setEvento] = useState(undefined); // undefined = resolviendo
  const [guardando, setGuardando] = useState(false);

  // El diseño vive en `pantalla_events.tv_canvas_config`. Si esa columna todavía
  // está vacía se usa lo que haya en localStorage: es el diseño que este
  // navegador venía guardando, y el primer Guardar lo sube a la base.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const ev = await resolverEvento();
      if (cancelado) return;
      setEvento(ev);
      if (!ev) return;
      try {
        const remoto = await fetchCanvasConfig(ev.id, "tv");
        if (cancelado) return;
        if (remoto) setConfig(normalizeTvConfig(remoto));
      } catch (error) {
        if (!cancelado) setSaveError(`No se pudo leer el diseño guardado: ${error.message}`);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  const changeBlock = (id, block) => setConfig(current => current.customBlocks?.[id]
    ? { ...current, customBlocks: { ...current.customBlocks, [id]: block } }
    : { ...current, blocks: { ...current.blocks, [id]: block } });
  /**
   * Guarda en los dos lados a propósito:
   *  - `pantalla_events.tv_canvas_config` es la fuente de verdad y lo que hace
   *    que el diseño viaje a cualquier máquina;
   *  - el localStorage queda como espejo local porque la vista `/tv` de hoy
   *    sigue leyendo de ahí y escucha el evento `bizarr-tv-config-saved`. Si el
   *    espejo falla no se pierde nada: en la base ya quedó guardado.
   */
  const persistir = async (siguiente) => {
    if (!evento) {
      setSaveError("No hay ningún evento de Pantalla seleccionado: elegí uno en Pantalla › Editor.");
      return false;
    }
    setGuardando(true);
    try {
      await saveCanvasConfig(evento.id, "tv", siguiente);
    } catch (error) {
      setGuardando(false);
      setSaved(false);
      setSaveError(error.message === "rls_sin_filas"
        ? "No se guardó: la base rechazó el cambio. Revisá que tu usuario tenga permisos sobre este evento."
        : `No se pudo guardar el diseño: ${error.message}`);
      return false;
    }
    const espejo = saveTvConfig(sessionId, siguiente);
    setGuardando(false);
    setSaveError(espejo.ok ? "" : (espejo.error === "quota"
      ? "Guardado en la base, pero no en este navegador: el diseño supera el espacio local. La TV de esta máquina puede seguir mostrando el anterior."
      : "Guardado en la base, pero no en este navegador."));
    return true;
  };

  const save = async () => {
    if (!await persistir(config)) return;
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const reset = async () => {
    if (!window.confirm("¿Restablecer todos los bloques al diseño original? Se pierde la configuración actual.")) return;
    const limpio = cloneConfig(DEFAULT_TV_CONFIG);
    if (!await persistir(limpio)) return;
    resetTvConfig(sessionId);
    setConfig(limpio);
    setSelectedId("video");
  };

  if (preview) return <div style={{ background: "#050505", inset: 0, padding: 18, position: "fixed", zIndex: 10000 }}>
    <button type="button" onClick={() => setPreview(false)} style={{ ...button, background: "rgba(0,0,0,.75)", position: "absolute", right: 24, top: 24, zIndex: 11000 }}>✕ Salir de vista previa</button>
    <div style={{ alignItems: "center", display: "flex", height: "100%", justifyContent: "center", margin: "auto", maxWidth: 1600 }}><TvStage config={config} selectedId={null} onSelect={() => {}} onBlockChange={() => {}}/></div>
  </div>;

  return <div style={{ background: T.background, color: T.foreground, display: "flex", flexDirection: "column", height: fullscreen ? "100vh" : "100%", inset: fullscreen ? 0 : undefined, minHeight: 0, position: fullscreen ? "fixed" : "relative", zIndex: fullscreen ? 10000 : 1 }}>
    <header style={{ alignItems: "center", borderBottom: `1px solid ${T.border}`, display: "flex", flexShrink: 0, justifyContent: "space-between", padding: "12px 16px" }}>
      <div><h2 style={{ fontSize: 16, margin: 0 }}>Diseñador de pantalla TV</h2><p style={{ color: T.mutedForeground, fontSize: 10, margin: "3px 0 0" }}>
        {evento === undefined ? "Buscando el evento…"
          : evento ? <>Se guarda en el evento <strong>{evento.name}</strong> · {evento.code}</>
          : "Sin evento de Pantalla seleccionado: no hay dónde guardar el diseño."}
      </p></div>
      <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "flex-end", maxWidth: "72%" }}>
        {saveError && <span role="alert" style={{ color: "#fca5a5", fontSize: 10, lineHeight: 1.35, maxWidth: 430 }}>{saveError}</span>}
        {saved && <span style={{ color: T.success, fontSize: 10 }}>✓ Guardado</span>}
        <button type="button" onClick={reset} disabled={!evento || guardando} style={button}>↻ Restablecer todo</button>
        <button type="button" onClick={() => setPreview(true)} style={button}>◉ Vista previa TV</button>
        <button type="button" onClick={() => setFullscreen(value => !value)} style={button}>{fullscreen ? "⊙ Salir de pantalla completa" : "⛶ Pantalla completa"}</button>
        <button type="button" onClick={save} disabled={!evento || guardando} style={{ ...button, background: T.gradientPrimary, borderColor: T.primary, color: "#160b04", opacity: (!evento || guardando) ? .5 : 1 }}>{guardando ? "Guardando…" : "▣ Guardar"}</button>
      </div>
    </header>
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <main style={{ alignItems: "center", display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", minWidth: 0, overflow: "auto", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 1400 }}><TvStage config={config} selectedId={selectedId} onSelect={setSelectedId} onBlockChange={changeBlock}/></div>
        <p style={{ color: T.mutedForeground, fontSize: 10, lineHeight: 1.4, margin: "10px 0 0", width: "100%", maxWidth: 1400 }}>Consejo: hacé clic en un bloque para seleccionarlo, arrastralo desde el centro para moverlo o desde las esquinas para redimensionarlo. Código del evento: {evento?.code || "XXXXXX"}.</p>
      </main>
      <TvPropertiesPanel config={config} selectedId={selectedId} onSelect={setSelectedId} onScreenChange={screen => setConfig(current => ({ ...current, screen }))} onBlockChange={changeBlock} onCustomBlocksChange={customBlocks => setConfig(current => ({ ...current, customBlocks }))}/>
    </div>
  </div>;
}

export function createDefaultTvConfig() {
  return cloneConfig(DEFAULT_TV_CONFIG);
}
