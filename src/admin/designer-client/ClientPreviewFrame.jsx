import { useCallback, useEffect, useRef, useState } from "react";
import { buildClientPreviewUrl, previewMessage, isPreviewMessage } from "../../preview/previewContract";
import { PREVIEW_VIEWPORT, clampToRange } from "./previewViewports";

/**
 * Preview real del Cliente dentro del Diseñador Cliente: un iframe a
 * /designer-preview/client, que dibuja el renderer real con datos de prueba.
 * Este componente no interpreta el diseño: sólo dice qué mostrar y controla
 * el viewport.
 *
 * Viewport lógico ≠ escala visual:
 *   - ancho/alto son los px CSS del iframe: lo que ven sus @media y su dvh;
 *   - la escala es un `transform: scale()` sobre el iframe, compensado por una
 *     caja de ancho·escala × alto·escala. Cambiarla no toca el layout interior.
 * El borde del marco va por fuera y no cuenta en el viewport.
 */
const toolbarBox = {
  display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 18px", padding: "10px 14px",
  borderRadius: 14, background: "rgba(240,232,255,.035)", border: "1px solid rgba(240,232,255,.1)",
};

function RangeControl({ id, label, unit, range, value, onChange, format = (v) => v }) {
  return (
    <label htmlFor={id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5,
      color: "rgba(240,232,255,.6)" }}>
      <span style={{ fontWeight: 800, letterSpacing: .4, textTransform: "uppercase", fontSize: 10 }}>{label}</span>
      <input id={id} type="range" min={range.min} max={range.max} step={range.step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} style={{ width: 120, accentColor: "#9B2FFF" }}/>
      <span style={{ minWidth: 52, textAlign: "right", color: "#F0E8FF", fontFamily: "ui-monospace,Consolas,monospace" }}>
        {format(value)}{unit}
      </span>
    </label>
  );
}

/** Mensaje para el iframe según el pedido actual (ver preview/previewContract.js). */
function messageFor(request) {
  return request.kind === "document"
    ? previewMessage("document", { document: request.document, fixtureId: request.fixtureId, selectedId: request.selectedId ?? null })
    : previewMessage("native", { section: request.section, rendererKey: request.rendererKey });
}

/**
 * @param request  { kind:"native", section, rendererKey }
 *               | { kind:"document", sceneId, document, fixtureId?, selectedId? }
 * @param onNodeSelected(nodeId)  click sobre un nodo en el preview (modo documento)
 */
export default function ClientPreviewFrame({ request, onNodeSelected }) {
  const [width,  setWidth]  = useState(PREVIEW_VIEWPORT.width.initial);
  const [height, setHeight] = useState(PREVIEW_VIEWPORT.height.initial);
  const [scale,  setScale]  = useState(PREVIEW_VIEWPORT.scale.initial);
  const frameRef = useRef(null);
  // La query sólo arma la carga inicial; los cambios viajan por postMessage.
  const [src] = useState(() => buildClientPreviewUrl(request));

  const send = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(messageFor(request), window.location.origin);
  }, [request]);
  useEffect(() => { send(); }, [send]);

  // Selección desde el preview: sólo mensajes del protocolo, mismo origen y de este iframe.
  useEffect(() => {
    if (!onNodeSelected) return undefined;
    const onMessage = (event) => {
      if (!isPreviewMessage(event, frameRef.current?.contentWindow)) return;
      if (event.data.kind === "node-selected" && typeof event.data.nodeId === "string") onNodeSelected(event.data.nodeId);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onNodeSelected]);

  const setW = (v) => setWidth(clampToRange(v, PREVIEW_VIEWPORT.width));
  const setH = (v) => setHeight(clampToRange(v, PREVIEW_VIEWPORT.height));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <div role="group" aria-label="Preview · dispositivo" style={toolbarBox}>
        <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: .6, color: "#00E5FF" }}>PREVIEW · DISPOSITIVO</span>
        <RangeControl id="cd-preview-width"  label="Ancho" unit=" px" range={PREVIEW_VIEWPORT.width}  value={width}  onChange={setW}/>
        <RangeControl id="cd-preview-height" label="Alto"  unit=" px" range={PREVIEW_VIEWPORT.height} value={height} onChange={setH}/>
        <RangeControl id="cd-preview-scale"  label="Escala" unit="%" range={PREVIEW_VIEWPORT.scale}  value={scale}
          onChange={setScale} format={(v) => Math.round(v * 100)}/>
      </div>

      {/* El área del Admin scrollea si el teléfono no entra; el iframe tiene su propio scroll (app-content). */}
      <div style={{ overflow: "auto", padding: "8px 0 4px", display: "flex", justifyContent: "center" }}>
        <div data-preview-frame style={{ flex: "0 0 auto", padding: 6, borderRadius: 22,
          background: "#05030A", border: "1px solid rgba(240,232,255,.16)", boxShadow: "0 12px 40px rgba(0,0,0,.45)" }}>
          <div data-preview-viewport style={{ width: width * scale, height: height * scale, overflow: "hidden",
            borderRadius: 4, position: "relative" }}>
            <iframe ref={frameRef} src={src} onLoad={send} title="Vista previa del Cliente"
              style={{ display: "block", border: 0, width, height,
                transform: `scale(${scale})`, transformOrigin: "top left" }}/>
          </div>
        </div>
      </div>
    </div>
  );
}
