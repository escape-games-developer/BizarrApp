import { useCallback, useEffect, useState } from "react";
import QRCode from "react-qr-code";
import {
  startEvent, endEvent, resetEvent, duplicateEvent,
  getTvLink, regenerateTvToken, guestUrl, tvUrl,
} from "../../services/pantallaDj";
import { P, portada, ESTADO_EVENTO } from "../../components/pantalla/pantallaUi";
import EventNameEditor from "./EventNameEditor";

/**
 * Centro de control del evento: estado, accesos del cliente y de la TV.
 * Tres cards bien separadas en vez de un formulario largo.
 */

function Copiable({ label, value }) {
  const [copiado, setCopiado] = useState(false);
  if (!value) return null;
  return (
    <div className="pdj-campo">
      <span className="pdj-campo-lbl">{label}</span>
      <div style={{ display: "flex", gap: 6 }}>
        <input className="pdj-input" readOnly value={value} style={{ fontSize: 11 }}
          onFocus={(e) => e.target.select()} />
        <button className="pdj-mini" style={{ padding: "10px 14px" }} onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopiado(true); setTimeout(() => setCopiado(false), 1600);
        }}>{copiado ? "✓" : "⧉"}</button>
      </div>
    </div>
  );
}

export default function EventoTab({
  event, items, current, stats, refresh, refreshEvents, setEventId, setTab, onError,
}) {
  const [busy, setBusy] = useState(false);
  const [tv,   setTv]   = useState(null);

  useEffect(() => { setTv(null); }, [event.id]);

  const run = useCallback(async (fn) => {
    setBusy(true); onError(null);
    try { await fn(); await refresh(); await refreshEvents(); }
    catch (err) { onError(err); }
    finally { setBusy(false); }
  }, [refresh, refreshEvents, onError]);

  const est = ESTADO_EVENTO[event.status] || ESTADO_EVENTO.draft;
  const habilitados = items.filter((i) => i.enabled).length;
  const sinTemas = items.length === 0;

  return (
    <>
      {/* ── Estado ────────────────────────────────────────────────────── */}
      <div className="pdj-card pdj-card-acento">
        <div className="pdj-card-titulo">
          <span style={{ fontSize: 15 }}>🎬</span><h4>Estado del evento</h4>
          <span className="pdj-chip" style={{
            background: est.bg, color: est.color, border: `1px solid ${est.borde}`,
          }}>{est.label}</span>
        </div>

        <div className="pdj-campo">
          <span className="pdj-campo-lbl">Nombre</span>
          <EventNameEditor event={event} onError={onError}
            onSaved={async () => { await refresh(); await refreshEvents(); }} />
        </div>

        <div className="pdj-metricas" style={{ marginBottom: 13 }}>
          {[
            { v: items.length,       l: "Canciones",   c: P.amarillo },
            { v: habilitados,        l: "Habilitadas", c: P.verde },
            { v: stats.activos,      l: "Activos",     c: P.cyan },
            { v: stats.participantes, l: "Participantes", c: P.violeta },
          ].map((m) => (
            <div key={m.l} className="pdj-metrica" style={{ background: `${m.c}12`, borderColor: `${m.c}30` }}>
              <div className="pdj-metrica-v" style={{ color: m.c }}>{m.v}</div>
              <div className="pdj-metrica-l">{m.l}</div>
            </div>
          ))}
        </div>

        {/* Canción actual */}
        <div style={{
          display: "flex", gap: 11, alignItems: "center", padding: "10px 12px",
          borderRadius: 13, background: "rgba(240,232,255,.035)",
          border: "1px solid rgba(240,232,255,.07)", marginBottom: 13,
        }}>
          {current && portada(current)
            ? <img src={portada(current)} alt="" width={40} height={40} loading="lazy"
                style={{ width: 40, height: 40, borderRadius: 9, objectFit: "cover", flexShrink: 0 }} />
            : <span style={{ fontSize: 22, opacity: .3, width: 40, textAlign: "center" }}>🎵</span>}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 9, letterSpacing: 1.2, color: P.tenue2, fontWeight: 800 }}>
              CANCIÓN ACTUAL
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: P.texto, marginTop: 2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {current ? current.title : "Nada sonando"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {event.status !== "live" && (
            <button className="pdj-mini pdj-mini-p" style={{ padding: "12px 22px", fontSize: 12 }}
              disabled={busy || sinTemas} onClick={() => run(() => startEvent(event.id))}>
              ▶ INICIAR EVENTO
            </button>
          )}
          {event.status === "live" && (
            <button className="pdj-mini pdj-mini-r" style={{ padding: "12px 22px", fontSize: 12 }}
              disabled={busy}
              onClick={() => {
                if (window.confirm("¿Finalizar el evento?\n\nLos clientes dejan de votar al instante."))
                  run(() => endEvent(event.id));
              }}>
              ■ FINALIZAR EVENTO
            </button>
          )}
          <button className="pdj-mini" disabled={busy}
            onClick={() => run(async () => { const id = await duplicateEvent(event.id); setEventId(id); })}
            title="Copia config y playlist en un evento nuevo, sin votos ni historial">
            ⧉ Duplicar
          </button>
          <button className="pdj-mini pdj-mini-r" disabled={busy}
            onClick={() => {
              if (window.confirm(
                `¿Reiniciar "${event.name}"?\n\nBorra votos, reacciones, historial y participantes de ESTE evento. ` +
                "La playlist se conserva y no se toca ninguna otra parte de BizarrApp.")) {
                run(() => resetEvent(event.id));
              }
            }}>↺ Reiniciar</button>
        </div>

        {sinTemas && (
          <div className="pdj-campo-hint" style={{ marginTop: 10, color: "rgba(255,214,0,.55)" }}>
            Cargá al menos una canción en la pestaña Playlist antes de iniciar.
          </div>
        )}
        {event.status === "ended" && (
          <div className="pdj-campo-hint" style={{ marginTop: 10 }}>
            El evento está finalizado. Podés duplicarlo para armar la próxima noche, o
            reiniciarlo y volver a iniciarlo con la misma playlist.
          </div>
        )}
      </div>

      {/* ── Acceso del cliente ────────────────────────────────────────── */}
      <div className="pdj-card">
        <div className="pdj-card-titulo">
          <span style={{ fontSize: 15 }}>📱</span><h4>Acceso del cliente</h4>
        </div>

        <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <div className="pdj-qr"><QRCode value={guestUrl(event.code)} size={132} /></div>
          <div style={{ flex: "1 1 190px", minWidth: 0 }}>
            <div className="pdj-codigo" style={{ fontSize: 34, marginBottom: 10 }}>{event.code}</div>
            <div className="pdj-sub" style={{ marginBottom: 10 }}>
              La votación vive en la app del cliente, dentro de <strong>Pantalla › 🎧 Música</strong>.
              El QR es un atajo directo a esa pestaña.
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button className="pdj-mini" onClick={() => navigator.clipboard?.writeText(event.code)}>
                ⧉ Copiar código
              </button>
              <button className="pdj-mini" onClick={() => navigator.clipboard?.writeText(guestUrl(event.code))}>
                ⧉ Copiar link
              </button>
              <button className="pdj-mini pdj-mini-p"
                onClick={() => window.open(guestUrl(event.code), "_blank", "noopener")}>
                Abrir Cliente
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── TV ────────────────────────────────────────────────────────── */}
      <div className="pdj-card">
        <div className="pdj-card-titulo">
          <span style={{ fontSize: 15 }}>📺</span><h4>Pantalla TV</h4>
          <span className="pdj-chip" style={{
            background: tv ? "rgba(0,245,160,.12)" : "rgba(240,232,255,.06)",
            color: tv ? P.verde : P.tenue2,
          }}>{tv ? "ACCESO LISTO" : "SIN GENERAR"}</span>
        </div>

        <div className="pdj-sub">
          La TV es el motor de reproducción y la única salida de audio. Abrila en la máquina
          conectada al proyector: el DJ controla, la TV reproduce.
        </div>

        {!tv ? (
          <button className="pdj-mini pdj-mini-a" style={{ padding: "11px 18px" }}
            onClick={async () => {
              try { setTv(await getTvLink(event.id)); } catch (err) { onError(err); }
            }}>
            🔑 Generar / mostrar acceso de TV
          </button>
        ) : (
          <>
            <Copiable label="Link de TV (no requiere sesión)" value={tvUrl(event.code, tv.token)} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button className="pdj-mini pdj-mini-p"
                onClick={() => window.open(tvUrl(event.code, tv.token), "_blank", "noopener")}>
                📺 Abrir TV
              </button>
              <button className="pdj-mini" onClick={() => {
                if (window.confirm("¿Regenerar el acceso?\n\nEl link anterior deja de funcionar al instante."))
                  regenerateTvToken(event.id).then(setTv).catch(onError);
              }}>Regenerar acceso</button>
              <button className="pdj-mini" onClick={() => setTab("dj")}>🎧 Ir a la consola</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
