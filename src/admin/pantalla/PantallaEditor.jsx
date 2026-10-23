import QRCode from "react-qr-code";
import { guestUrl } from "../../services/pantallaDj";
import PlaylistPanel from "./playlist/PlaylistPanel";
import SeccionContenido from "./sections/SeccionContenido";
import SeccionVotacion from "./sections/SeccionVotacion";
import EventoFueraDeVivo from "./sections/EventoFueraDeVivo";

function AccesoEvento({ event }) {
  const url = guestUrl(event.code);
  return (
    <section className="pdj-overview-card pdj-access-card">
      <div className="pdj-overview-label">CÓDIGO DEL EVENTO</div>
      <div className="pdj-codigo pdj-access-code">{event.code}</div>
      <div className="pdj-qr pdj-access-qr"><QRCode value={url} size={190} /></div>
      <button className="pdj-access-link" type="button"
        onClick={() => navigator.clipboard?.writeText(url)} title="Copiar link del evento">
        {url}
      </button>
    </section>
  );
}

/**
 * Editor DJ Democracy. La composición replica el editor original observado:
 * playlist a la izquierda y, a la derecha, acceso fijo + dos selectores fijos
 * (contenido / votación) y luego los acordeones de configuración.
 *
 * BizarrApp tiene un único evento, siempre en vivo: no hay ciclo de vida que
 * administrar. Arriba de todo sólo aparece, si hiciera falta, el aviso para
 * volver a ponerlo en vivo (EventoFueraDeVivo), acá y en la consola en vivo.
 */
export default function PantallaEditor({ shared, secciones }) {
  const { event } = shared;

  return (
    <div className="pdj-editor-page">
      <div className="pdj-shell">
        <div className="pdj-shell-main">
          <PlaylistPanel {...shared} />
        </div>

        <aside className="pdj-shell-side">
          <EventoFueraDeVivo {...shared} />
          <AccesoEvento event={event} />
          <SeccionContenido {...shared} />
          <SeccionVotacion {...shared} />
          {secciones}
        </aside>
      </div>
    </div>
  );
}
