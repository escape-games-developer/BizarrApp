import { useRef } from "react";

/**
 * Pestañas de sección del Diseñador Cliente. Recibe las secciones (de
 * CLIENT_DESIGN_SECTIONS) y sólo avisa el cambio: el estado vive en el panel.
 * Si no entran a lo ancho, se desplazan horizontalmente.
 */
export default function ClientDesignerTabs({ sections, activeId, onChange, panelId }) {
  const refs = useRef({});

  const onKeyDown = (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = sections.findIndex((s) => s.id === activeId);
    const next = sections[(i + (e.key === "ArrowRight" ? 1 : -1) + sections.length) % sections.length];
    onChange(next.id);
    refs.current[next.id]?.focus();
  };

  return (
    <div role="tablist" aria-label="Secciones de la app Cliente" onKeyDown={onKeyDown}
      style={{ display: "flex", gap: 4, padding: 4, overflowX: "auto", scrollbarWidth: "thin",
        background: "rgba(240,232,255,.035)", border: "1px solid rgba(240,232,255,.1)", borderRadius: 14 }}>
      {sections.map((s) => {
        const active = s.id === activeId;
        return (
          <button key={s.id} type="button" role="tab" id={`cd-tab-${s.id}`}
            ref={(el) => { refs.current[s.id] = el; }}
            aria-selected={active} aria-controls={panelId} tabIndex={active ? 0 : -1}
            onClick={() => onChange(s.id)}
            style={{ flex: "0 0 auto", padding: "8px 16px", borderRadius: 10, cursor: "pointer",
              fontFamily: "'Syne',sans-serif", fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap",
              border: `1px solid ${active ? "rgba(155,47,255,.55)" : "transparent"}`,
              background: active ? "rgba(155,47,255,.18)" : "transparent",
              color: active ? "#F0E8FF" : "rgba(240,232,255,.5)" }}>
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
