import { useCallback, useEffect, useState } from "react";
import { usePantallaEvent } from "../../hooks/realtime/usePantallaEvent";
import { usePantallaAdmin, usePantallaStats } from "../../hooks/realtime/usePantallaAdmin";
import { listEvents, createEvent } from "../../services/pantallaDj";
import { mensajeAmigable } from "../../components/pantalla/pantallaUi";
import pantallaCss from "./pantallaStyles";
import EventoHeader from "./EventoHeader";
import EventoTab from "./EventoTab";
import PlaylistTab from "./PlaylistTab";
import ReglasTab from "./ReglasTab";
import DjConsoleTab from "./DjConsoleTab";
import InvitadosTab from "./InvitadosTab";
import HistorialTab from "./HistorialTab";
import PantallaEditor from "./PantallaEditor";
import SeccionesConfig from "./sections/SeccionesConfig";

/**
 * Admin › Escenario › Pantalla / Escenario.
 *
 * Shell del módulo: selector de evento, cabecera común y pestañas. Los datos
 * pesados (evento + playlist, participantes + votos + historial) se cargan acá
 * una sola vez y bajan por props, así ninguna pestaña duplica suscripciones.
 */

const LS_KEY = "bizarrapp_pantalla_event";

const TABS = [
  { id: "dj",            label: "🎧 Consola DJ"    },
  { id: "evento",        label: "🎬 Evento"        },
  { id: "playlist",      label: "🎵 Playlist"      },
  { id: "reglas",        label: "⚙️ Reglas"        },
  { id: "participantes", label: "👥 Participantes" },
  { id: "historial",     label: "🕘 Historial"     },
];

// El sidebar entra por dos puertas distintas al mismo módulo: «Editor» abre la
// configuración del evento y «En vivo» la cabina del DJ.
const TAB_INICIAL = { editor: "evento", live: "dj" };

export default function PantallaDjPanel({ sec, sessionId, modo = "live", goTo = null }) {
  const [events,  setEvents]  = useState([]);
  const [eventId, setEventId] = useState(() => localStorage.getItem(LS_KEY) || null);
  const [tab,     setTab]     = useState(() => TAB_INICIAL[modo] || "dj");
  const [error,   setError]   = useState(null);
  const [busy,    setBusy]    = useState(false);

  const ev    = usePantallaEvent({ eventId });
  const admin = usePantallaAdmin(ev.event?.id ?? null, ev.event?.current_item_id ?? null);
  const stats = usePantallaStats({
    participants: admin.participants, votes: admin.votes,
    candidates: ev.candidates, event: ev.event,
  });

  const fallar = useCallback((e) => setError(e ? mensajeAmigable(e) : null), []);

  const refreshEvents = useCallback(async () => {
    try {
      const list = await listEvents();
      setEvents(list);

      const enVivo = list.find((e) => e.status === "live");
      setEventId((prev) => {
        if (prev && list.some((e) => e.id === prev)) return prev;
        return enVivo?.id || list[0]?.id || null;
      });
      // Con un evento en vivo lo primero es la cabina; si no, hay que
      // configurarlo, así que arranca en Evento.
      if (!enVivo) setTab((t) => (t === "dj" ? "evento" : t));
    } catch (err) { fallar(err); }
  }, [fallar]);

  useEffect(() => { refreshEvents(); }, [refreshEvents]);
  useEffect(() => { if (eventId) localStorage.setItem(LS_KEY, eventId); }, [eventId]);
  // El panel no se desmonta al saltar de Editor a En vivo desde el sidebar:
  // es el mismo componente con otra prop, así que la pestaña se reajusta acá.
  useEffect(() => { setTab(TAB_INICIAL[modo] || "dj"); }, [modo]);

  const nuevoEvento = async () => {
    const nombre = window.prompt("Nombre del evento:", "Pantalla Bizarren");
    if (nombre === null) return;
    setBusy(true); setError(null);
    try {
      const id = await createEvent(nombre, sessionId ?? null);
      await refreshEvents();
      setEventId(id);
      setTab("playlist");
    } catch (err) { fallar(err); }
    finally { setBusy(false); }
  };

  const shared = {
    event: ev.event, items: ev.items, candidates: ev.candidates, current: ev.current,
    participants: admin.participants, votes: admin.votes, history: admin.history,
    stats, refresh: ev.refresh, refreshAdmin: admin.refresh,
    refreshEvents, setEventId, setTab, onError: fallar, goTo,
  };

  return (
    <div style={{ "--sg": sec.grad, "--gw": sec.glow }}>
      <style>{pantallaCss}</style>

      {error && (
        <div className="pdj-card" style={{ borderColor: "rgba(255,45,120,.35)", background: "rgba(255,45,120,.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div style={{ flex: 1, fontSize: 12, color: "#FCA5A5", lineHeight: 1.5 }}>{error}</div>
            <button className="pdj-mini" onClick={() => setError(null)}>Cerrar</button>
          </div>
        </div>
      )}

      {/* Selector de evento */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <select className="pdj-input" style={{ flex: "1 1 200px" }}
          value={eventId || ""} onChange={(e) => setEventId(e.target.value || null)}>
          {events.length === 0 && <option value="">Sin eventos todavía</option>}
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.status === "live" ? "🔴 " : e.status === "ended" ? "⏹ " : "📝 "}{e.name} · {e.code}
            </option>
          ))}
        </select>
        <button className="pdj-mini pdj-mini-p" disabled={busy} onClick={nuevoEvento}
          style={{ padding: "10px 16px" }}>
          + Nuevo evento
        </button>
      </div>

      {!ev.event && ev.loading && (
        <>
          <div className="pdj-skel" style={{ height: 66 }} />
          <div className="pdj-skel" style={{ height: 190 }} />
        </>
      )}

      {!ev.event && !ev.loading && (
        <div className="pdj-card pdj-card-acento">
          <div className="pdj-vacio">
            <div className="pdj-vacio-ico">🎧</div>
            <div className="pdj-vacio-tit">Todavía no hay ningún evento de Pantalla/Escenario</div>
            <div className="pdj-vacio-txt">
              Creá uno, cargale la playlist desde YouTube o desde las playlists del bar,
              y ponelo en vivo. Recién ahí los clientes ven la votación en su celular.
            </div>
            <button className="pdj-mini pdj-mini-p" style={{ marginTop: 16, padding: "10px 18px" }}
              onClick={nuevoEvento}>
              + Crear el primer evento
            </button>
          </div>
        </div>
      )}

      {/* Editor: dos columnas, playlist + configuración plegable. */}
      {ev.event && modo === "editor" && (
        <PantallaEditor shared={shared} secciones={<SeccionesConfig {...shared} />} />
      )}

      {ev.event && modo !== "editor" && (
        <>
          <EventoHeader
            event={ev.event}
            items={ev.items}
            activos={stats.activos}
            onIrConsola={tab !== "dj" ? () => setTab("dj") : null}
            onError={fallar}
          />

          <div className="pdj-tabs">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`pdj-tab${tab === t.id ? " pdj-tab-on" : ""}`}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === "dj"            && <DjConsoleTab {...shared} />}
          {tab === "evento"        && <EventoTab    {...shared} />}
          {tab === "playlist"      && <PlaylistTab  {...shared} />}
          {tab === "reglas"        && <ReglasTab    {...shared} />}
          {tab === "participantes" && <InvitadosTab {...shared} />}
          {tab === "historial"     && <HistorialTab {...shared} />}
        </>
      )}
    </div>
  );
}
