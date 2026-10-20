import QRCode from "react-qr-code";
import { guestUrl } from "../../services/pantallaDj";
import PlaylistPanel from "./playlist/PlaylistPanel";
import SeccionContenido from "./sections/SeccionContenido";
import SeccionVotacion from "./sections/SeccionVotacion";
import SeccionCiclo from "./sections/SeccionCiclo";

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
 * El ciclo de vida del evento (Iniciar / Finalizar / Duplicar, SeccionCiclo)
 * va arriba de todo, acá y en la consola en vivo: sin él no había forma de
 * poner un evento en vivo ni de cerrarlo desde el Admin.
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
          <SeccionCiclo {...shared} />
          <AccesoEvento event={event} />
          <SeccionContenido {...shared} />
          <SeccionVotacion {...shared} />
          {secciones}
        </aside>
      </div>
    </div>
  );
}
