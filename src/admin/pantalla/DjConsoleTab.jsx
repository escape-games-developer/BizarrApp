import { useCallback, useEffect, useState } from "react";
import QRCode from "react-qr-code";
import {
  advanceEvent, freezeVoting, resetVotes, updateEvent,
  getKickStatus, getTvLink, guestUrl, tvUrl,
} from "../../services/pantallaDj";
import {
  P, portada, tiempo, conSigno, colorScore,
} from "../../components/pantalla/pantallaUi";

/**
 * Consola del DJ — la vista operativa de cabina.
 *
 * Misma arquitectura que la consola de DJ Democracy: a la izquierda qué suena,
 * qué viene y el ranking en vivo; a la derecha el estado del evento, el kick y
 * los accesos (QR del cliente, link de TV). El DJ tiene que entender la noche
 * de un vistazo, sin navegar.
 *
 * Todos los datos vienen del panel (un solo canal Realtime). Acá no se abre
 * ninguna suscripción extra ni se hace polling.
 */

// ─── Estadística ─────────────────────────────────────────────────────────────
function Metrica({ v, l, c }) {
  return (
    <div className="pdj-metrica" style={{ background: `${c}12`, borderColor: `${c}30` }}>
      <div className="pdj-metrica-v" style={{ color: c }}>{v}</div>
      <div className="pdj-metrica-l">{l}</div>
    </div>
  );
}

// ─── Sonando ahora ───────────────────────────────────────────────────────────
function SonandoAhora({ event, current }) {
  const cover = portada(current);
  // El tiempo lo reporta la TV: si no está conectada, no inventamos progreso.
  const hayTiempo = event.tv_duration > 0;
  const progreso  = hayTiempo ? Math.min(100, (event.tv_current_time / event.tv_duration) * 100) : 0;

  return (
    <div className="pdj-ahora">
      <div style={{
        fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 10,
        letterSpacing: "2.2px", color: "rgba(255,45,120,.8)", marginBottom: 12,
      }}>
        {event.is_playing ? "● SONANDO AHORA" : "○ EN PAUSA"}
      </div>

      <div className="pdj-ahora-row">
        {cover
          ? <img className="pdj-ahora-cover" src={cover} alt="" loading="lazy" decoding="async" />
          : <div className="pdj-ahora-cover-vacia">🎵</div>}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pdj-ahora-tit">{current ? current.title : "Nada sonando"}</div>
          <div className="pdj-ahora-art">
            {current ? (current.artist || "—") : "Pasá a la primera canción para arrancar"}
          </div>
          {current?.won_with_score != null && (
            <div style={{ fontSize: 11, color: P.tenue, marginTop: 6 }}>
              Ganó la votación con{" "}
              <strong style={{ color: colorScore(current.won_with_score) }}>
                {conSigno(current.won_with_score)} pts
              </strong>
            </div>
          )}
        </div>
      </div>

      {current && hayTiempo && (
        <>
          <div className="pdj-barra"><div className="pdj-barra-fill" style={{ width: `${progreso}%` }} /></div>
          <div className="pdj-tiempos">
            <span>{tiempo(event.tv_current_time)}</span>
            <span>{tiempo(event.tv_duration)}</span>
          </div>
        </>
      )}
      {current && !hayTiempo && (
        <div style={{ fontSize: 10.5, color: P.tenue2, marginTop: 11 }}>
          La TV todavía no reporta tiempo. Abrila y tocá «Iniciar video del TV».
        </div>
      )}
    </div>
  );
}

// ─── Panel lateral ───────────────────────────────────────────────────────────
function Accesos({ event, onError }) {
  const [tv, setTv]           = useState(null);
  const [copiado, setCopiado] = useState(null);

  const copiar = (txt, clave) => {
    navigator.clipboard?.writeText(txt);
    setCopiado(clave); setTimeout(() => setCopiado(null), 1600);
  };

  const cargarTv = useCallback(async () => {
    try { const l = await getTvLink(event.id); setTv(l); return l; }
    catch (err) { onError(err); return null; }
  }, [event.id, onError]);

  return (
    <>
      <div className="pdj-card pdj-card-acento" style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 10.5,
          letterSpacing: "2px", color: P.amarillo, marginBottom: 12,
        }}>📱 ESCANEÁ PARA UNIRTE</div>

        <div className="pdj-qr"><QRCode value={guestUrl(event.code)} size={152} /></div>
        <div className="pdj-codigo" style={{ fontSize: 27, marginTop: 12 }}>{event.code}</div>

        <div className="pdj-lateral-cta" style={{ justifyContent: "center" }}>
          <button className="pdj-mini" onClick={() => copiar(event.code, "c")}>
            {copiado === "c" ? "✓" : "⧉ Código"}
          </button>
          <button className="pdj-mini" onClick={() => copiar(guestUrl(event.code), "l")}>
            {copiado === "l" ? "✓" : "⧉ Link"}
          </button>
          <button className="pdj-mini" onClick={() => window.open(guestUrl(event.code), "_blank", "noopener")}>
            Abrir
          </button>
        </div>
      </div>

      <div className="pdj-card">
        <div className="pdj-card-titulo">
          <span style={{ fontSize: 15 }}>📺</span><h4>Pantalla TV</h4>
        </div>
        <div className="pdj-sub">
          La TV es la única salida de audio del evento. El DJ controla, la TV reproduce.
        </div>
        <div className="pdj-lateral-cta" style={{ marginTop: 0 }}>
          <button className="pdj-mini pdj-mini-p" onClick={async () => {
            const l = tv || await cargarTv();
            if (l) window.open(tvUrl(event.code, l.token), "_blank", "noopener");
          }}>📺 Abrir TV</button>
          <button className="pdj-mini" onClick={async () => {
            const l = tv || await cargarTv();
            if (l) copiar(tvUrl(event.code, l.token), "tv");
          }}>{copiado === "tv" ? "✓ Copiado" : "⧉ Link TV"}</button>
        </div>
      </div>

      {/* Fase 2: los efectos todavía no tienen soporte en el motor. */}
      <div className="pdj-card">
        <div className="pdj-card-titulo">
          <span style={{ fontSize: 15 }}>🎆</span><h4>Efectos de TV</h4>
          <span className="pdj-chip" style={{
            background: "rgba(240,232,255,.06)", color: P.tenue2, border: "1px solid rgba(240,232,255,.1)",
          }}>PRÓXIMAMENTE</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["🎉", "Confetti"], ["✨", "Destellos"], ["⚡", "Láser"]].map(([ico, txt]) => (
            <button key={txt} className="pdj-mini" disabled title="Todavía no implementado">
              {ico} {txt}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Vista ───────────────────────────────────────────────────────────────────
export default function DjConsoleTab({
  event, candidates, current, stats, refresh, refreshAdmin, onError,
}) {
  const [busy, setBusy] = useState(false);
  const [kick, setKick] = useState(null);

  // El kick se mide por canción: se relee cuando cambia la que suena.
  const cargarKick = useCallback(async () => {
    if (!event?.id) return;
    try { setKick(await getKickStatus(event.id)); }
    catch (err) { console.error("[DjConsole] kick:", err); }
  }, [event?.id]);

  useEffect(() => { cargarKick(); }, [cargarKick, event?.current_item_id, stats.positivos, stats.negativos]);

  const run = useCallback(async (fn) => {
    setBusy(true); onError(null);
    try { await fn(); await refresh(); await refreshAdmin(); await cargarKick(); }
    catch (err) { onError(err); }
    finally { setBusy(false); }
  }, [refresh, refreshAdmin, cargarKick, onError]);

  const siguiente = candidates[0] || null;
  const enVivo    = event.status === "live";
  const tvViva    = event.tv_connected_at &&
    Date.now() - new Date(event.tv_connected_at).getTime() < 20_000;

  return (
    <div className="pdj-consola">
      {/* ── Columna principal ───────────────────────────────────────────── */}
      <div className="pdj-consola-col">
        <SonandoAhora event={event} current={current} />

        {/* A continuación: el motor recién lo fija al avanzar, así que se
            muestra como quién va ganando, no como algo ya decidido. */}
        {siguiente && (
          <div className="pdj-next">
            {portada(siguiente) && (
              <img className="pdj-next-cover" src={portada(siguiente)} alt="" loading="lazy" />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 9.5, fontWeight: 800, letterSpacing: "1.4px",
                color: "rgba(0,229,255,.75)", marginBottom: 3,
              }}>LIDERANDO LA VOTACIÓN</div>
              <div className="pdj-rank-tit">{siguiente.title}</div>
              <div className="pdj-rank-art">{siguiente.artist || "—"}</div>
            </div>
            <div className="pdj-rank-score">
              <b style={{ color: colorScore(siguiente.score) }}>{conSigno(siguiente.score)}</b>
              <span>PTS</span>
            </div>
          </div>
        )}

        {/* Controles */}
        <div className="pdj-card">
          <div className="pdj-card-titulo">
            <span style={{ fontSize: 15 }}>🎛</span><h4>Controles</h4>
            {!enVivo && <span className="pdj-card-titulo pdj-hint" style={{ margin: 0 }}>
              El evento no está en vivo
            </span>}
          </div>

          <div className="pdj-controles">
            <button className="pdj-btn pdj-btn-principal" disabled={busy || !enVivo}
              onClick={() => run(() => advanceEvent(event.id, null, event.current_item_id))}>
              <span className="pdj-btn-ico">⏭</span>PASAR CANCIÓN
            </button>

            <button className={`pdj-btn${event.voting_frozen ? " pdj-btn-on" : ""}`} disabled={busy}
              onClick={() => run(() => freezeVoting(event.id, !event.voting_frozen))}
              title="Congela el orden que se muestra. Los votos siguen entrando.">
              <span className="pdj-btn-ico">{event.voting_frozen ? "▶" : "⏸"}</span>
              {event.voting_frozen ? "REANUDAR ORDEN" : "CONGELAR ORDEN"}
            </button>

            <button className={`pdj-btn${event.voting_disabled ? " pdj-btn-on" : ""}`} disabled={busy}
              onClick={() => run(() => updateEvent(event.id, { voting_disabled: !event.voting_disabled }))}>
              <span className="pdj-btn-ico">{event.voting_disabled ? "🔓" : "🔒"}</span>
              {event.voting_disabled ? "ACTIVAR VOTACIÓN" : "CORTAR VOTACIÓN"}
            </button>

            <button className="pdj-btn pdj-btn-peligro" disabled={busy}
              onClick={() => {
                if (window.confirm("¿Reiniciar todos los votos del evento?\n\nSe borran los votos y los super votos usados. La playlist no se toca."))
                  run(() => resetVotes(event.id));
              }}>
              <span className="pdj-btn-ico">↻</span>REINICIAR VOTOS
            </button>
          </div>

          {event.voting_frozen && (
            <div className="pdj-campo-hint" style={{ marginTop: 10 }}>
              Con el orden congelado el ranking que ven todos queda quieto, pero los votos
              se siguen registrando por detrás. Al reanudar, el ranking salta al estado real.
            </div>
          )}
        </div>

        {/* Ranking */}
        <div className="pdj-card">
          <div className="pdj-card-titulo">
            <span style={{ fontSize: 15 }}>🔥</span><h4>Top en vivo</h4>
            <span className="pdj-hint">{candidates.length} candidatas</span>
          </div>

          {candidates.length === 0 ? (
            <div className="pdj-vacio">
              <div className="pdj-vacio-ico">🎵</div>
              <div className="pdj-vacio-tit">Estamos preparando los próximos temas</div>
              <div className="pdj-vacio-txt">
                Cargá canciones en la pestaña Playlist; el servidor arma la ventana de candidatas solo.
              </div>
            </div>
          ) : candidates.map((item, i) => (
            <div key={item.id} className={`pdj-rank${i === 0 ? " pdj-rank-1" : ""}`}>
              <span className="pdj-rank-pos">{i + 1}</span>
              {portada(item) && (
                <img className="pdj-rank-cover" src={portada(item)} alt="" loading="lazy" decoding="async" />
              )}
              <div className="pdj-rank-info">
                <div className="pdj-rank-tit">{item.title}</div>
                <div className="pdj-rank-art">{item.artist || "—"}</div>
                <div className="pdj-rank-votos">
                  <span>👍 {item.pos_votes}</span>
                  <span>👎 {item.neg_votes}</span>
                </div>
              </div>
              <div className="pdj-rank-score">
                <b style={{ color: colorScore(item.score) }}>{conSigno(item.score)}</b>
                <span>PTS</span>
              </div>
              <button className="pdj-mini" disabled={busy || !enVivo}
                title="Lanzar este tema ahora"
                onClick={() => run(() => advanceEvent(event.id, item.id, event.current_item_id))}>
                ⏏ Lanzar
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Columna lateral ─────────────────────────────────────────────── */}
      <div className="pdj-consola-col">
        <div className="pdj-card pdj-card-acento">
          <div className="pdj-card-titulo">
            <span style={{ fontSize: 15 }}>📊</span><h4>Estado en vivo</h4>
            <span className="pdj-chip" style={{
              background: tvViva ? "rgba(0,245,160,.12)" : "rgba(240,232,255,.06)",
              color: tvViva ? P.verde : P.tenue2,
              border: `1px solid ${tvViva ? "rgba(0,245,160,.3)" : "rgba(240,232,255,.1)"}`,
            }}>{tvViva ? "TV OK" : "TV OFF"}</span>
          </div>

          <div className="pdj-metricas">
            <Metrica v={stats.activos}    l="Activos"     c={P.amarillo} />
            <Metrica v={stats.positivos}  l="👍 A favor"  c={P.verde} />
            <Metrica v={stats.negativos}  l="👎 En contra" c={P.fucsia} />
            <Metrica v={stats.supers}     l="🔥 Súper"    c={P.naranja} />
          </div>

          <div style={{ marginTop: 11, display: "flex", flexDirection: "column", gap: 6 }}>
            {stats.masVotada && (
              <div style={{ fontSize: 11, color: P.tenue }}>
                🏆 Más votada: <strong style={{ color: P.texto }}>{stats.masVotada.title}</strong>
              </div>
            )}
            {stats.masRechazada && (
              <div style={{ fontSize: 11, color: P.tenue }}>
                💀 Más rechazada: <strong style={{ color: P.texto }}>{stats.masRechazada.title}</strong>
              </div>
            )}
            {stats.masActivoVotos > 0 && (
              <div style={{ fontSize: 11, color: P.tenue }}>
                ⚡ Más activo: <strong style={{ color: P.texto }}>{stats.masActivoVotos} votos</strong>
              </div>
            )}
          </div>
        </div>

        {/* Sacar tema */}
        <div className="pdj-kick">
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
            <span style={{ fontSize: 15 }}>👎</span>
            <h4 style={{
              fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 12.5,
              color: P.texto, margin: 0, flex: 1,
            }}>Sacar tema</h4>
          </div>

          {!kick?.enabled ? (
            <div style={{ fontSize: 11.5, color: P.tenue2 }}>
              Sacar Tema está deshabilitado en este evento.
            </div>
          ) : !current ? (
            <div style={{ fontSize: 11.5, color: P.tenue2 }}>
              No hay ninguna canción sonando para voltear.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                <span className="pdj-kick-num">{kick.votes}</span>
                <span style={{ fontSize: 13, color: P.tenue }}>/ {kick.needed} votos</span>
                <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800, color: P.fucsia }}>
                  {kick.needed > 0 ? Math.round((kick.votes / kick.needed) * 100) : 0}%
                </span>
              </div>
              <div className="pdj-kick-barra">
                <div className="pdj-kick-fill"
                  style={{ width: `${kick.needed > 0 ? Math.min(100, (kick.votes / kick.needed) * 100) : 0}%` }} />
              </div>
              <div className="pdj-campo-hint" style={{ marginTop: 8 }}>
                Hace falta el {kick.threshold_pct}% de {kick.active} activos. Al llegar,
                el servidor saltea la canción solo.
              </div>
            </>
          )}
        </div>

        <Accesos event={event} onError={onError} />
      </div>
    </div>
  );
}
