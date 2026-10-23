import { useState } from "react";
import { startEvent } from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";

/**
 * BizarrApp tiene UN evento de DJ Democracy, siempre en vivo: no hay ciclo de
 * vida que administrar (Finalizar / Duplicar eran de la versión multi-evento).
 *
 * Esto es sólo la red de seguridad: si por algo el evento quedara fuera de vivo
 * (los invitados no podrían votar), aparece este aviso con el botón para
 * volver a ponerlo. Con el evento en vivo no se dibuja nada.
 */
export default function EventoFueraDeVivo({ event, items = [], refresh, refreshEvents, onError }) {
  const [ocupado, setOcupado] = useState(false);
  if (!event || event.status === "live") return null;

  const sinTemas = items.length === 0;
  const poner = async () => {
    setOcupado(true); onError?.(null);
    try { await startEvent(event.id); await refresh(); await refreshEvents?.(); }
    catch (err) { onError?.(err); }
    finally { setOcupado(false); }
  };

  return (
    <section className="pdj-overview-card" style={{ padding: 16, borderColor: "rgba(255,214,0,.45)" }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: P.amarillo }}>⚠️ El evento no está en vivo</div>
      <div className="pdj-campo-hint" style={{ marginTop: 4 }}>
        Mientras tanto los invitados no pueden votar ni la TV avanza sola.
        {sinTemas && " Cargá al menos una canción para ponerlo en vivo."}
      </div>
      <button type="button" className="pdj-mini pdj-mini-p" style={{ marginTop: 10, padding: "9px 16px" }}
        disabled={ocupado || sinTemas} onClick={poner}>
        {ocupado ? "Poniendo en vivo…" : "▶ Poner en vivo"}
      </button>
    </section>
  );
}
