import PlaylistPanel from "./playlist/PlaylistPanel";
import QRCode from "react-qr-code";
import { guestUrl } from "../../services/pantallaDj";
import SeccionContenido from "./sections/SeccionContenido";
import SeccionVotacion from "./sections/SeccionVotacion";

function AccesoEvento({ event }) {
  const url = guestUrl(event.code);
  return (
    <section className="pdj-overview-card pdj-access-card">
      <div className="pdj-overview-label">Código del evento</div>
      <div className="pdj-codigo pdj-access-code">{event.code}</div>
      <div className="pdj-qr pdj-access-qr"><QRCode value={url} size={190} /></div>
      <button className="pdj-access-link" type="button" onClick={() => navigator.clipboard?.writeText(url)}
        title="Copiar link del evento">{url}</button>
    </section>
  );
}

/**
 * Editor del evento — la arquitectura de uso del admin de DJ Democracy.
 *
 * Dos columnas: a la izquierda la playlist (que es donde el DJ pasa el 90% del
 * tiempo) y a la derecha la configuración, en secciones plegables e
 * independientes. Cada sección guarda lo suyo; no hay «Guardar todo».
 *
 * Debajo de 1100px las dos columnas se apilan y la playlist queda primero: en
 * una tablet lo que se necesita a mano es la lista, no los ajustes.
 */
export default function PantallaEditor({ shared, secciones }) {
  const { event } = shared;

  return (
    <div className="pdj-editor-page">
    <div className="pdj-shell">
      {/* ── Columna principal: playlist ──────────────────────────────── */}
      <div className="pdj-shell-main">
        {/* El nombre y el estado del evento ya los muestra la cabecera común,
            que además deja editarlos. Acá queda sólo el conteo de la playlist,
            que es el título real de esta columna. */}
        <PlaylistPanel {...shared} />
      </div>

      {/* ── Columna lateral: configuración ───────────────────────────── */}
      <aside className="pdj-shell-side">
        <AccesoEvento event={event} />
        <SeccionContenido {...shared} />
        <SeccionVotacion {...shared} />
        {secciones}
      </aside>
    </div>
    </div>
  );
}
