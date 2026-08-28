import PlaylistPanel from "./playlist/PlaylistPanel";
import EventNameEditor from "./EventNameEditor";
import { P, ESTADO_EVENTO } from "../../components/pantalla/pantallaUi";

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
  const est = ESTADO_EVENTO[event.status] || ESTADO_EVENTO.draft;
  const enVivo = event.status === "live";

  return (
    <div className="pdj-shell">
      {/* ── Columna principal: playlist ──────────────────────────────── */}
      <div className="pdj-shell-main">
        <div style={{ marginBottom: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <EventNameEditor event={event} compact onError={shared.onError}
                onSaved={async () => { await shared.refresh(); await shared.refreshEvents(); }} />
            </div>
            <span className={`pdj-estado${enVivo ? " pdj-estado-live" : ""}`}
              style={{ color: est.color, background: est.bg, border: `1px solid ${est.borde}` }}>
              <span className="pdj-punto" />{est.label}
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: P.tenue, marginTop: 5 }}>
            <strong style={{ color: P.amarillo, fontWeight: 800 }}>{items.length}</strong>
            {items.length === 1 ? " canción en la playlist" : " canciones en la playlist"}
          </div>
        </div>

        <PlaylistPanel {...shared} />
      </div>

      {/* ── Columna lateral: configuración ───────────────────────────── */}
      <aside className="pdj-shell-side">
        <div className="pdj-shell-side-tit">Configuración del evento</div>
        {secciones}
      </aside>
    </div>
  );
}
