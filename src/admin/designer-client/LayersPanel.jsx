import { useState } from "react";
import DesignerPanelSection from "./DesignerPanelSection";

/**
 * Capas: el árbol del DesignDocument, generado recorriendo `document.root`.
 * Seleccionar una capa sólo cambia la selección del editor.
 */
const ICON = { container: "▣", text: "T", image: "🖼", button: "⏺", custom: "◆" };

function LayerRow({ node, depth, registry, selectedId, onSelect, collapsed, toggle }) {
  const def = registry.component(node.component);
  const kids = node.children ?? [];
  const isOpen = !collapsed.has(node.id);
  const selected = node.id === selectedId;
  const label = node.name || def?.label || node.component;
  return (
    <li role="treeitem" aria-selected={selected} aria-expanded={kids.length ? isOpen : undefined} style={{ listStyle: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, paddingLeft: depth * 12 }}>
        {kids.length
          ? <button type="button" onClick={() => toggle(node.id)} aria-label={isOpen ? "Contraer" : "Expandir"}
              style={{ width: 16, background: "none", border: "none", color: "rgba(240,232,255,.5)", cursor: "pointer", fontSize: 9, padding: 0 }}>
              {isOpen ? "▼" : "▶"}
            </button>
          : <span style={{ width: 16 }}/>}
        <button type="button" data-layer-id={node.id} onClick={() => onSelect(node.id)}
          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", borderRadius: 7,
            cursor: "pointer", textAlign: "left", fontSize: 11.5,
            border: `1px solid ${selected ? "rgba(0,229,255,.5)" : "transparent"}`,
            background: selected ? "rgba(0,229,255,.1)" : "transparent", color: "#F0E8FF" }}>
          <span aria-hidden="true" style={{ width: 14, textAlign: "center", color: "rgba(240,232,255,.5)", fontSize: 10 }}>{ICON[def?.primitive] ?? "•"}</span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
          {node.repeat && <span title="Se repite por cada ítem de una lista" style={{ fontSize: 10, color: "#00E5FF" }}>↻</span>}
          {node.visibleWhen && <span title="Visible según datos" style={{ fontSize: 10, color: "rgba(240,232,255,.5)" }}>◐</span>}
          {def?.kind === "system" && <span title="Componente de sistema" style={{ fontSize: 10 }}>🔒</span>}
        </button>
      </div>
      {kids.length > 0 && isOpen && (
        <ul role="group" style={{ margin: 0, padding: 0 }}>
          {kids.map((c) => (
            <LayerRow key={c.id} node={c} depth={depth + 1} registry={registry} selectedId={selectedId}
              onSelect={onSelect} collapsed={collapsed} toggle={toggle}/>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function LayersPanel({ document, registry, selectedId, onSelect }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const toggle = (id) => setCollapsed((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <DesignerPanelSection title="Capas" defaultOpen>
      <ul role="tree" aria-label="Capas del diseño" style={{ margin: 0, padding: 0 }}>
        <LayerRow node={document.root} depth={0} registry={registry} selectedId={selectedId}
          onSelect={onSelect} collapsed={collapsed} toggle={toggle}/>
      </ul>
    </DesignerPanelSection>
  );
}
