import { useId, useState } from "react";

/**
 * Sección desplegable del panel izquierdo. Hoy la usa Diseños Guardados; las
 * próximas (Capas, Componentes, Componentes del sistema, Biblioteca) se suman
 * como otras instancias, sin tocar el layout.
 */
export default function DesignerPanelSection({ title, count = null, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <div style={{ background: "rgba(240,232,255,.035)", border: "1px solid rgba(240,232,255,.1)",
      borderRadius: 14, overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        aria-expanded={open} aria-controls={bodyId}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "11px 14px",
          background: "none", border: "none", cursor: "pointer", color: "#F0E8FF", textAlign: "left",
          fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: .4,
          textTransform: "uppercase" }}>
        <span aria-hidden="true" style={{ fontSize: 10, color: "rgba(240,232,255,.55)", width: 10,
          display: "inline-block", transition: "transform .15s", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>
          ▼
        </span>
        <span style={{ flex: 1 }}>{title}</span>
        {count != null && (
          <span style={{ fontSize: 10.5, color: "rgba(240,232,255,.45)", fontWeight: 700 }}>{count}</span>
        )}
      </button>
      {open && (
        <div id={bodyId} style={{ padding: "0 10px 12px" }}>
          {children}
        </div>
      )}
    </div>
  );
}
