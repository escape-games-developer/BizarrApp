import { useState } from "react";
import { resetEvent } from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";

/**
 * Reiniciar el evento — la única acción destructiva del panel.
 *
 * Dos pasos a propósito: el primer botón no borra nada, sólo despliega el
 * detalle textual de qué se va y qué se queda. Recién el segundo llama a
 * `pantalla_reset_event`. Lo que dice el cartel es exactamente lo que hace la
 * RPC, no una aproximación.
 */

const SE_BORRA = [
  "Todos los votos y súper votos del evento",
  "Los votos de Sacar Tema",
  "Las reacciones enviadas",
  "El historial de reproducción",
  "Todos los invitados y sus roles",
  "Los contadores de cada tema: score, 👍, 👎 y veces sonada",
  "La canción actual y el estado de reproducción",
];

const SE_CONSERVA = [
  "La playlist completa: temas, orden y posiciones",
  "Recortes de inicio y fin, y el volumen de cada tema",
  "Fijados, bloqueados y activados/desactivados",
  "Toda la configuración del evento: código, reglas, poderes y Sacar Tema",
  "El resto de BizarrApp: no se toca nada fuera de este evento",
];

function Lista({ titulo, color, items, ico }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color, letterSpacing: .6, marginBottom: 5 }}>
        {ico} {titulo}
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10.5, lineHeight: 1.65, color: P.tenue }}>
        {items.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </div>
  );
}

export default function SeccionReset({ event, refresh, refreshAdmin, onError }) {
  const [paso,    setPaso]    = useState(0);   // 0 = cerrado, 1 = confirmando
  const [ocupado, setOcupado] = useState(false);

  const reiniciar = async () => {
    setOcupado(true); onError?.(null);
    try {
      await resetEvent(event.id);
      await refresh();
      await refreshAdmin();
      setPaso(0);
    } catch (err) { onError?.(err); }
    finally { setOcupado(false); }
  };

  return (
    <PanelSection id="reiniciar-evento" title="Reiniciar evento" icon="⚠️">
      <div className="pdj-sub" style={{ marginBottom: 11 }}>
        Deja el evento como recién creado, pero con la playlist intacta. Sirve para probar toda
        la noche y arrancar limpio antes de que llegue la gente.
      </div>

      {paso === 0 ? (
        <button type="button" className="pdj-mini pdj-mini-r" style={{ padding: "10px 16px" }}
          onClick={() => setPaso(1)}>
          ↺ Reiniciar «{event.name}»…
        </button>
      ) : (
        <div style={{
          borderRadius: 12, padding: "11px 12px",
          background: "rgba(255,45,120,.07)", border: "1px solid rgba(255,45,120,.32)",
        }}>
          <div style={{
            fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 12,
            color: "#FCA5A5", marginBottom: 9,
          }}>
            Esto no se puede deshacer
          </div>

          <Lista titulo="SE BORRA" ico="✕" color="#FCA5A5" items={SE_BORRA} />
          <Lista titulo="SE CONSERVA" ico="✓" color={P.verde} items={SE_CONSERVA} />

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            <button type="button" className="pdj-mini pdj-mini-r" disabled={ocupado}
              style={{ padding: "10px 16px" }} onClick={reiniciar}>
              {ocupado ? "Reiniciando…" : `Sí, reiniciar «${event.name}»`}
            </button>
            <button type="button" className="pdj-mini" disabled={ocupado}
              onClick={() => setPaso(0)}>Cancelar</button>
          </div>
        </div>
      )}
    </PanelSection>
  );
}
