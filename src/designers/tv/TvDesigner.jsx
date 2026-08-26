import { useState } from "react";
import { cloneConfig, DEFAULT_TV_CONFIG } from "../defaults";
import { loadTvConfig, resetTvConfig, saveTvConfig } from "../lib/persistence";
import { designerTheme as T } from "../theme";
import TvPropertiesPanel from "./TvPropertiesPanel";
import TvStage from "./TvStage";

const button = { alignItems: "center", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, color: T.foreground, cursor: "pointer", display: "inline-flex", fontSize: 11, fontWeight: 700, gap: 6, padding: "8px 11px" };

export default function TvDesigner({ sessionId = "default" }) {
  const [config, setConfig] = useState(() => loadTvConfig(sessionId));
  const [selectedId, setSelectedId] = useState("video");
  const [fullscreen, setFullscreen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const changeBlock = (id, block) => setConfig(current => current.customBlocks?.[id]
    ? { ...current, customBlocks: { ...current.customBlocks, [id]: block } }
    : { ...current, blocks: { ...current.blocks, [id]: block } });
  const save = () => {
    const result = saveTvConfig(sessionId, config);
    if (!result.ok) {
      setSaved(false);
      setSaveError(result.error === "quota"
        ? "No se pudo guardar: la configuración supera el espacio disponible. Usá imágenes más chicas o pegá una URL en vez de subir el archivo."
        : "No se pudo guardar la configuración en este navegador.");
      return;
    }
    setSaveError("");
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };
  const reset = () => {
    if (!window.confirm("¿Restablecer todos los bloques al diseño original? Se pierde la configuración actual.")) return;
    const result = resetTvConfig(sessionId);
    if (!result.ok) {
      setSaveError(result.error === "quota"
        ? "No se pudo restablecer: la configuración supera el espacio disponible."
        : "No se pudo restablecer la configuración en este navegador.");
      return;
    }
    setConfig(result.config);
    setSelectedId("video");
    setSaveError("");
  };

  if (preview) return <div style={{ background: "#050505", inset: 0, padding: 18, position: "fixed", zIndex: 10000 }}>
    <button type="button" onClick={() => setPreview(false)} style={{ ...button, background: "rgba(0,0,0,.75)", position: "absolute", right: 24, top: 24, zIndex: 11000 }}>✕ Salir de vista previa</button>
    <div style={{ alignItems: "center", display: "flex", height: "100%", justifyContent: "center", margin: "auto", maxWidth: 1600 }}><TvStage config={config} selectedId={null} onSelect={() => {}} onBlockChange={() => {}}/></div>
  </div>;

  return <div style={{ background: T.background, color: T.foreground, display: "flex", flexDirection: "column", height: fullscreen ? "100vh" : "100%", inset: fullscreen ? 0 : undefined, minHeight: 0, position: fullscreen ? "fixed" : "relative", zIndex: fullscreen ? 10000 : 1 }}>
    <header style={{ alignItems: "center", borderBottom: `1px solid ${T.border}`, display: "flex", flexShrink: 0, justifyContent: "space-between", padding: "12px 16px" }}>
      <div><h2 style={{ fontSize: 16, margin: 0 }}>Diseñador de pantalla TV</h2><p style={{ color: T.mutedForeground, fontSize: 10, margin: "3px 0 0" }}>El diseño se aplica a la vista TV apenas guardes.</p></div>
      <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "flex-end", maxWidth: "72%" }}>
        {saveError && <span role="alert" style={{ color: "#fca5a5", fontSize: 10, lineHeight: 1.35, maxWidth: 430 }}>{saveError}</span>}
        {saved && <span style={{ color: T.success, fontSize: 10 }}>✓ Guardado</span>}
        <button type="button" onClick={reset} style={button}>↻ Restablecer todo</button>
        <button type="button" onClick={() => setPreview(true)} style={button}>◉ Vista previa TV</button>
        <button type="button" onClick={() => setFullscreen(value => !value)} style={button}>{fullscreen ? "⊙ Salir de pantalla completa" : "⛶ Pantalla completa"}</button>
        <button type="button" onClick={save} style={{ ...button, background: T.gradientPrimary, borderColor: T.primary, color: "#160b04" }}>▣ Guardar</button>
      </div>
    </header>
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <main style={{ alignItems: "center", display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", minWidth: 0, overflow: "auto", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 1400 }}><TvStage config={config} selectedId={selectedId} onSelect={setSelectedId} onBlockChange={changeBlock}/></div>
        <p style={{ color: T.mutedForeground, fontSize: 10, lineHeight: 1.4, margin: "10px 0 0", width: "100%", maxWidth: 1400 }}>Consejo: hacé clic en un bloque para seleccionarlo, arrastralo desde el centro para moverlo o desde las esquinas para redimensionarlo. Código del evento: {sessionId === "default" ? "XXXXXX" : sessionId}.</p>
      </main>
      <TvPropertiesPanel config={config} selectedId={selectedId} onSelect={setSelectedId} onScreenChange={screen => setConfig(current => ({ ...current, screen }))} onBlockChange={changeBlock} onCustomBlocksChange={customBlocks => setConfig(current => ({ ...current, customBlocks }))}/>
    </div>
  </div>;
}

export function createDefaultTvConfig() {
  return cloneConfig(DEFAULT_TV_CONFIG);
}
