import PanelSection from "../PanelSection";

/** Los dos accesos aparecen como secciones independientes en el editor original. */
export default function SeccionDisenadores({ event, goTo }) {
  const tvGuardado = !!event.tv_canvas_config;
  const guestGuardado = !!event.guest_canvas_config;

  return (
    <>
      <PanelSection id="disenador-tv" title="Diseñador de pantalla TV">
        <div className="pdj-sub" style={{ marginBottom: 10 }}>
          Editor visual libre: posicioná, redimensioná y estilizá cada bloque de la vista TV.
          {tvGuardado ? " Hay un diseño personalizado guardado." : ""}
        </div>
        <button type="button" className="pdj-mini pdj-mini-p" disabled={!goTo}
          onClick={() => goTo?.("designerTv")} style={{ padding: "9px 14px" }}>
          Abrir diseñador
        </button>
        <div className="pdj-campo-hint" style={{ marginTop: 9 }}>
          El diseño se aplica en la vista TV apenas guardás. Usá “Restablecer todo” para volver al layout original.
        </div>
      </PanelSection>

      <PanelSection id="disenador-invitado" title="Diseñador de pantalla del invitado"
        status="pendiente"
        aviso="El acceso ya tiene su lugar definitivo, pero el diseñador móvil todavía no está construido.">
        <div className="pdj-sub" style={{ marginBottom: 10 }}>
          Editor visual del celular: reordená los bloques y ajustá fondo, borde, sombra y tipografía.
          {guestGuardado ? " Hay un diseño personalizado guardado." : ""}
        </div>
        <button type="button" className="pdj-mini pdj-mini-p" disabled style={{ padding: "9px 14px" }}>
          Abrir diseñador
        </button>
        <div className="pdj-campo-hint" style={{ marginTop: 9 }}>
          Si no configurás un diseño, se usa el diseño por defecto del canvas.
        </div>
      </PanelSection>
    </>
  );
}
