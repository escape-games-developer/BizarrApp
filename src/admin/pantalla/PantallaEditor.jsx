import PlaylistPanel from "./playlist/PlaylistPanel";
import EventoHeader from "./EventoHeader";
import { P } from "../../components/pantalla/pantallaUi";

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
  const { event, items } = shared;

  return (
    <>
      {/* Cabecera común: evento, código, QR, estado del evento, modo de
          contenido, modo de votación, estado de la votación y de la TV. */}
      <EventoHeader
        event={event} items={items} activos={shared.stats.activos}
        onError={shared.onError}
        irA={shared.goTo ? { label: "🔴 Ir a En vivo", onClick: () => shared.goTo("pantallaLive") } : null}
      />

    <div className="pdj-shell">
      {/* ── Columna principal: playlist ──────────────────────────────── */}
      <div className="pdj-shell-main">
        {/* El nombre y el estado del evento ya los muestra la cabecera común,
            que además deja editarlos. Acá queda sólo el conteo de la playlist,
            que es el título real de esta columna. */}
        <div style={{ fontSize: 11.5, color: P.tenue, marginBottom: 13 }}>
          <strong style={{ color: P.amarillo, fontWeight: 800 }}>{items.length}</strong>
          {items.length === 1 ? " canción en la playlist" : " canciones en la playlist"}
        </div>

        <PlaylistPanel {...shared} />
      </div>

      {/* ── Columna lateral: configuración ───────────────────────────── */}
      <aside className="pdj-shell-side">
        <div className="pdj-shell-side-tit">Configuración del evento</div>
        {secciones}
      </aside>
    </div>
    </>
  );
}
