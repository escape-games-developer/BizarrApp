import { useCallback, useMemo, useState } from "react";
import ClientDesignerLayout from "./ClientDesignerLayout";
import ClientPreviewFrame from "./ClientPreviewFrame";
import LayersPanel from "./LayersPanel";
import PropertiesPanel from "./PropertiesPanel";
import { useDesignDraft } from "./useDesignDraft";
import { clientDesignRegistry } from "../../client/design/clientDesignRegistry";
import { validateDocument } from "../../design-engine/validateDocument";
import { findNode } from "../../design-engine/documentTree";

/**
 * Editor de un diseño con DesignDocument (motor V1). Genérico: no sabe de qué
 * sección es; todo sale del registro y del documento.
 *
 *   izquierda  Diseños Guardados + Capas (árbol del documento)
 *   centro     preview real en iframe (modo documento o renderer nativo)
 *   derecha    propiedades del nodo seleccionado, según capabilities
 *
 * Las ediciones viven en un borrador de sesión: no se guardan en ningún lado.
 */
const pill = (on) => ({
  padding: "5px 10px", borderRadius: 8, fontSize: 11.5, cursor: "pointer",
  border: `1px solid ${on ? "rgba(155,47,255,.6)" : "rgba(240,232,255,.12)"}`,
  background: on ? "rgba(155,47,255,.18)" : "transparent", color: on ? "#F0E8FF" : "rgba(240,232,255,.55)",
});

export default function ClientDesignerEditor({ design, section, tabs, savedDesigns, tabpanelProps }) {
  const registry = clientDesignRegistry;
  const { draft, isDirty, setField, reset } = useDesignDraft(design.document);
  const [selectedId, setSelectedId] = useState(draft.root.id);
  const [mode, setMode] = useState("document");   // "document" (motor) | "native" (Cliente actual)
  const validation = useMemo(() => validateDocument(draft, registry), [draft, registry]);
  const [lastValid, setLastValid] = useState(draft);
  if (validation.ok && lastValid !== draft) setLastValid(draft);

  const selectNode = useCallback((id) => { if (findNode(draft.root, id)) setSelectedId(id); }, [draft]);
  const selected = findNode(draft.root, selectedId);

  // Al preview sólo viaja un documento válido: si el borrador queda inválido, sigue el último válido.
  const request = useMemo(() => mode === "native"
    ? { kind: "native", section: section.id, rendererKey: design.rendererKey }
    : { kind: "document", sceneId: design.scene, document: lastValid, selectedId },
  [mode, section.id, design.rendererKey, design.scene, lastValid, selectedId]);

  const center = (
    <div {...tabpanelProps} style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 10px" }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: .6, textTransform: "uppercase", color: "rgba(240,232,255,.45)" }}>{section.label}</span>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 17, fontWeight: 700, color: "#F0E8FF" }}>{design.name}</span>
        <span style={{ fontSize: 10.5, color: "rgba(240,232,255,.4)", fontFamily: "ui-monospace,Consolas,monospace" }}>{design.id}</span>
        {design.isActive && <span style={{ fontSize: 11.5, color: "#00F5A0" }}>· Es el diseño que hoy ve la app Cliente.</span>}
        <span style={{ flex: 1 }}/>
        <div role="radiogroup" aria-label="Qué se ve en el preview" style={{ display: "flex", gap: 4 }}>
          <button type="button" role="radio" aria-checked={mode === "document"} style={pill(mode === "document")} onClick={() => setMode("document")}>Documento · motor V1</button>
          <button type="button" role="radio" aria-checked={mode === "native"} style={pill(mode === "native")} onClick={() => setMode("native")}>Nativo · Cliente actual</button>
        </div>
      </div>

      <div role="status" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 11.5 }}>
        {isDirty
          ? <span data-dirty="true" style={{ color: "#FFD600", fontWeight: 700 }}>● Cambios sin guardar</span>
          : <span data-dirty="false" style={{ color: "rgba(240,232,255,.45)" }}>Sin cambios</span>}
        <button type="button" onClick={reset} disabled={!isDirty} style={{ ...pill(false), opacity: isDirty ? 1 : .4 }}>Descartar cambios</button>
        <button type="button" disabled title="Persistencia pendiente: los cambios no se guardan todavía" style={{ ...pill(false), opacity: .4, cursor: "not-allowed" }}>
          Guardar (persistencia pendiente)
        </button>
        {mode === "native" && <span style={{ color: "rgba(240,232,255,.45)" }}>El modo nativo muestra el Cliente actual: las ediciones se ven en «Documento».</span>}
      </div>
      {!validation.ok && (
        <div role="alert" style={{ fontSize: 11.5, color: "#FCA5A5", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 10, padding: "8px 10px" }}>
          El borrador tiene un valor no válido; el preview muestra la última versión válida. {validation.errors[0]}
        </div>
      )}

      <ClientPreviewFrame request={request} onNodeSelected={selectNode}/>
    </div>
  );

  return (
    <ClientDesignerLayout
      tabs={tabs}
      left={<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {savedDesigns}
        <LayersPanel document={draft} registry={registry} selectedId={selectedId} onSelect={selectNode}/>
      </div>}
      center={center}
      right={<PropertiesPanel document={draft} registry={registry} node={selected} onChange={setField}/>}
    />
  );
}
