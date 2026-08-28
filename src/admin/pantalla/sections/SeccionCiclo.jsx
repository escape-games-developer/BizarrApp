import { useState } from "react";
import { startEvent, endEvent, duplicateEvent } from "../../../services/pantallaDj";
import { P, ESTADO_EVENTO } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";

/**
 * Ciclo de vida del evento: ponerlo en vivo, finalizarlo y duplicarlo.
 *
 * Duplicar copia configuración y playlist en un evento nuevo — sin votos, sin
 * historial y sin invitados — que es como se arma la noche siguiente sin volver
 * a pegar 400 links.
 *
 * Iniciar vive acá y no sólo en la consola: el editor tiene que poder poner el
 * evento en vivo sin obligar a cambiar de pantalla.
 */
export default function SeccionCiclo({ event, items, refresh, refreshEvents, setEventId, onError }) {
  const [ocupado, setOcupado] = useState(false);

  const correr = async (fn) => {
    setOcupado(true); onError?.(null);
    try { await fn(); await refresh(); await refreshEvents?.(); }
    catch (err) { onError?.(err); }
    finally { setOcupado(false); }
  };

  const est = ESTADO_EVENTO[event.status] || ESTADO_EVENTO.draft;
  const sinTemas = items.length === 0;

  return (
    <PanelSection id="ciclo-evento" title="Estado del evento" icon="🎬" defaultOpen>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
        <span className="pdj-chip" style={{
          background: est.bg, color: est.color, border: `1px solid ${est.borde}`,
        }}>{est.label}</span>
        <span style={{ fontSize: 10.5, color: P.tenue }}>
          {items.filter((i) => i.enabled).length} de {items.length} temas habilitados
        </span>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {event.status !== "live" && (
          <button type="button" className="pdj-mini pdj-mini-p" style={{ padding: "10px 18px" }}
            disabled={ocupado || sinTemas} onClick={() => correr(() => startEvent(event.id))}>
            ▶ Iniciar evento
          </button>
        )}

        {event.status === "live" && (
          <button type="button" className="pdj-mini pdj-mini-r" style={{ padding: "10px 18px" }}
            disabled={ocupado}
            onClick={() => {
              if (window.confirm(
                "¿Finalizar el evento?\n\nLos invitados dejan de votar al instante. " +
                "La playlist, los votos y el historial quedan tal como están.")) {
                correr(() => endEvent(event.id));
              }
            }}>
            ■ Finalizar evento
          </button>
        )}

        <button type="button" className="pdj-mini" disabled={ocupado}
          title="Copia config y playlist en un evento nuevo, sin votos ni historial"
          onClick={() => {
            const nombre = window.prompt("Nombre del evento duplicado:", `${event.name} (copia)`);
            if (nombre === null) return;
            correr(async () => {
              const id = await duplicateEvent(event.id, nombre.trim() || null);
              setEventId?.(id);
            });
          }}>
          ⧉ Duplicar
        </button>
      </div>

      {sinTemas && (
        <div className="pdj-campo-hint" style={{ marginTop: 9, color: P.amarillo }}>
          Cargá al menos una canción antes de iniciar el evento.
        </div>
      )}
      {event.status === "ended" && (
        <div className="pdj-campo-hint" style={{ marginTop: 9 }}>
          El evento está finalizado. Duplicalo para armar la próxima noche, o reiniciarlo y
          volver a iniciarlo con la misma playlist.
        </div>
      )}
    </PanelSection>
  );
}
