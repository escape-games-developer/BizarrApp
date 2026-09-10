import { useState } from "react";
import { resetEvent } from "../../../services/pantallaDj";
import PanelSection from "../PanelSection";

export default function SeccionReset({ event, refresh, refreshAdmin, onError }) {
  const [ocupado, setOcupado] = useState(false);

  const reiniciar = async () => {
    const ok = window.confirm(
      "¿Reiniciar el evento?\n\n" +
      "Se borran invitados, votos, reacciones, premios y progreso de logros, y se detiene la reproducción.\n\n" +
      "No se toca el orden de la playlist, los presets, el branding, los diseñadores ni la configuración."
    );
    if (!ok) return;

    setOcupado(true); onError?.(null);
    try {
      await resetEvent(event.id);
      await refresh();
      await refreshAdmin();
    } catch (err) { onError?.(err); }
    finally { setOcupado(false); }
  };

  return (
    <PanelSection id="reiniciar-evento" title="Reiniciar evento">
      <div style={{
        padding: "18px 20px", borderRadius: 18,
        border: "1px solid rgba(255,53,93,.55)", background: "rgba(255,53,93,.035)",
      }}>
        <div style={{ fontSize: 11.5, lineHeight: 1.6, color: "rgba(240,232,255,.72)", marginBottom: 14 }}>
          Deja el evento como recién creado: borra invitados, votos, reacciones, premios y progreso de logros,
          y detiene la reproducción. <strong>No toca</strong> el orden de la playlist, los presets, el branding,
          los diseñadores ni la configuración.
        </div>
        <button type="button" className="pdj-mini pdj-mini-r" disabled={ocupado}
          onClick={reiniciar} style={{ padding: "9px 14px" }}>
          {ocupado ? "Reiniciando…" : "↻ Reiniciar evento"}
        </button>
      </div>
      <div className="pdj-campo-hint" style={{ marginTop: 8 }}>
        Antes de usar este botón en producción, aplicar y auditar la migración 20260909130000_pantalla_limpieza_y_reset.sql.
      </div>
    </PanelSection>
  );
}
