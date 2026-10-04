import ClientPreviewFrame from "./ClientPreviewFrame";

/**
 * Área central del Diseñador Cliente.
 *
 * Con un diseño de una sección que tiene preview (hoy, Perfil) muestra el
 * Cliente real dentro de un iframe aislado (ClientPreviewFrame): mismo shell,
 * mismo CSS y mismo renderer, con datos de prueba y acciones inertes. El
 * renderer nunca se monta directamente en el Admin.
 */
const box = {
  minHeight: 420, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  textAlign: "center", padding: 28, borderRadius: 18,
  background: "rgba(240,232,255,.02)", border: "1px dashed rgba(240,232,255,.14)",
};

/** Secciones cuya ruta de preview sabe dibujar diseños nativos. */
const SECCIONES_CON_PREVIEW = new Set(["profile"]);

export default function ClientDesignerWorkspace({ section, design }) {
  if (!design) {
    return (
      <div style={box}>
        <div style={{ fontSize: 30, marginBottom: 12, opacity: .7 }}>🎨</div>
        <div style={{ fontSize: 13, color: "rgba(240,232,255,.6)" }}>
          Seleccioná o creá un diseño para comenzar.
        </div>
      </div>
    );
  }

  const conPreview = design.rendererKind === "native" && SECCIONES_CON_PREVIEW.has(section.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 10px" }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: .6, textTransform: "uppercase",
          color: "rgba(240,232,255,.45)" }}>{section.label}</span>
        <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 900, color: "#F0E8FF" }}>
          {design.name}
        </span>
        <span style={{ fontSize: 10.5, color: "rgba(240,232,255,.4)", fontFamily: "ui-monospace,Consolas,monospace" }}>
          {design.id}
        </span>
        {design.isActive && (
          <span style={{ fontSize: 11.5, color: "#00F5A0" }}>· Es el diseño que hoy ve la app Cliente.</span>
        )}
      </div>

      {conPreview
        ? <ClientPreviewFrame request={{ kind: "native", section: section.id, rendererKey: design.rendererKey }}/>
        : <div style={box}>
            <div style={{ fontSize: 12.5, color: "rgba(240,232,255,.55)" }}>
              Esta sección todavía no tiene vista previa.
            </div>
          </div>}
    </div>
  );
}
