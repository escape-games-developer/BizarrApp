import DesignerPanelSection from "./DesignerPanelSection";

/**
 * Diseños Guardados de la sección elegida.
 *
 * Muestra el nombre visible y, aparte, el id interno: son cosas distintas y el
 * id no cambia si el nombre cambia. `onRename` queda en la firma para cuando
 * exista backend; mientras no llegue, no hay UI de renombrado (sin backend
 * sería un estado falso que se pierde al recargar).
 *
 * Seleccionar un diseño sólo cambia lo que muestra el área central: no lo
 * activa ni guarda nada.
 */
// eslint-disable-next-line no-unused-vars -- onRename: ver comentario de arriba
export default function SavedDesignsPanel({ designs, selectedId, onSelect, onRename }) {
  return (
    <DesignerPanelSection title="Diseños Guardados" count={designs.length} defaultOpen>
      {designs.length === 0 ? (
        <div style={{ padding: "10px 6px 2px", fontSize: 11.5, color: "rgba(240,232,255,.45)", lineHeight: 1.5 }}>
          No hay diseños guardados todavía.
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {designs.map((d) => {
            const selected = d.id === selectedId;
            return (
              <li key={d.id}>
                <button type="button" onClick={() => onSelect(d.id)} aria-pressed={selected}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
                    borderRadius: 10, cursor: "pointer", textAlign: "left", color: "#F0E8FF",
                    border: `1px solid ${selected ? "rgba(155,47,255,.55)" : "rgba(240,232,255,.08)"}`,
                    background: selected ? "rgba(155,47,255,.14)" : "rgba(240,232,255,.02)" }}>
                  <span aria-hidden="true" style={{ fontSize: 12, color: d.isActive ? "#00F5A0" : "rgba(240,232,255,.35)" }}>
                    {d.isActive ? "●" : "○"}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.name}
                    </span>
                    <span style={{ display: "block", fontSize: 10, color: "rgba(240,232,255,.4)",
                      fontFamily: "ui-monospace,Consolas,monospace", marginTop: 2 }}>
                      {d.id}
                    </span>
                  </span>
                  {d.isActive && (
                    <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .4, textTransform: "uppercase",
                      padding: "3px 7px", borderRadius: 999, color: "#00F5A0",
                      background: "rgba(0,245,160,.1)", border: "1px solid rgba(0,245,160,.3)" }}>
                      Activo
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </DesignerPanelSection>
  );
}
