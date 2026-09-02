import { useCallback, useEffect, useState } from "react";
import {
  advanceEvent, freezeVoting, resetVotes, saveEventFields, getKickStatus,
} from "../../services/pantallaDj";
import { P, portada, tiempo, conSigno, colorScore } from "../../components/pantalla/pantallaUi";
import SeccionEstadisticas from "./sections/SeccionEstadisticas";
import SeccionQr from "./sections/SeccionQr";
import SeccionTvLink from "./sections/SeccionTvLink";
import SeccionInvitados from "./sections/SeccionInvitados";
import SeccionSorteos from "./sections/SeccionSorteos";
import SeccionesPendientesVivo from "./sections/SeccionesPendientesVivo";
import HistorialTab from "./HistorialTab";
import PanelSection from "./PanelSection";

/**
 * Consola «En vivo» — la vista de cabina.
 *
 * Misma arquitectura que el editor: a la izquierda lo que el DJ mira toda la
 * noche (qué suena, qué viene, los controles y el ranking) y a la derecha las
 * secciones plegables, cada una con su estado guardado.
 *
 * No abre ninguna suscripción propia: los datos llegan del panel, que mantiene
 * un solo canal de Realtime para todo el módulo.
 */

// ─── Sonando ahora ───────────────────────────────────────────────────────────
function SonandoAhora({ event, current, siguiente, children }) {
  const cover = portada(current);
  // El tiempo lo reporta la TV. Sin TV conectada no se inventa progreso: los
  // 421 temas tienen `duration_seconds` en NULL, así que no hay de dónde sacarlo.
  const hayTiempo = event.tv_duration > 0;
  const transcurrido = Number(event.tv_current_time) || 0;
  const restante = hayTiempo ? Math.max(0, event.tv_duration - transcurrido) : null;
  const progreso = hayTiempo ? Math.min(100, (transcurrido / event.tv_duration) * 100) : 0;

  return (
    <div className="pdj-ahora">
      <div className="pdj-ahora-row">
        {cover
          ? <img className="pdj-ahora-cover" src={cover} alt="" loading="lazy" decoding="async" />
          : <div className="pdj-ahora-cover-vacia">🎵</div>}

        <div className="pdj-ahora-body">
          <div className="pdj-ahora-label">
            {event.is_playing ? "SONANDO AHORA" : "EN PAUSA"}
          </div>
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

          {siguiente && (
            <div className="pdj-ahora-next">
              A continuación · <strong>{siguiente.title}</strong>
              <span> — {siguiente.artist || "—"}</span>
            </div>
          )}

          {current && hayTiempo && (
            <>
              <div className="pdj-barra"><div className="pdj-barra-fill" style={{ width: `${progreso}%` }} /></div>
              <div className="pdj-tiempos">
                <span>{tiempo(transcurrido)}</span>
                <span>−{tiempo(restante)}</span>
              </div>
            </>
          )}
          {current && !hayTiempo && (
            <div className="pdj-tiempo-sin-tv">La TV todavía no reporta el tiempo.</div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Vista ───────────────────────────────────────────────────────────────────
export default function PantallaConsola({ shared }) {
  const {
    event, candidates, current, stats, refresh, refreshAdmin, onError,
  } = shared;

  const [ocupado, setOcupado] = useState(false);
  const [kick,    setKick]    = useState(null);

  // El kick se mide por canción: se relee cuando cambia la que suena.
  const cargarKick = useCallback(async () => {
    if (!event?.id) return;
    try { setKick(await getKickStatus(event.id)); }
    catch (err) { console.error("[PantallaConsola] kick:", err); }
  }, [event?.id]);

  useEffect(() => { cargarKick(); }, [cargarKick, event?.current_item_id, stats.positivos, stats.negativos]);

  const correr = useCallback(async (fn) => {
    setOcupado(true); onError(null);
    try { await fn(); await refresh(); await refreshAdmin(); await cargarKick(); }
    catch (err) { onError(err); }
    finally { setOcupado(false); }
  }, [refresh, refreshAdmin, cargarKick, onError]);

  const siguiente = candidates[0] || null;
  const enVivo    = event.status === "live";

  return (
    <>
    <div className="pdj-live-page">
    <div className="pdj-shell pdj-live-shell">
      {/* ── Columna principal ──────────────────────────────────────── */}
      <div className="pdj-shell-main">
        <SonandoAhora event={event} current={current} siguiente={siguiente}>
          <div className="pdj-live-player-controls">
            <button className="pdj-btn pdj-live-round" disabled title="No hay una operación segura para reabrir un tema archivado">|◀</button>
            <button className="pdj-btn pdj-btn-principal pdj-live-round" disabled={ocupado || !current}
              aria-label={event.is_playing ? "Pausar" : "Reproducir"}
              onClick={() => correr(() => saveEventFields(event.id, { is_playing: !event.is_playing }))}>
              {event.is_playing ? "Ⅱ" : "▶"}
            </button>
            <button className="pdj-btn pdj-live-round" disabled={ocupado || !enVivo}
              onClick={() => correr(() => advanceEvent(event.id, null, event.current_item_id))}>
              ▶|
            </button>
            <button className="pdj-btn pdj-live-round" disabled={ocupado || !enVivo || candidates.length === 0}
              aria-label="Lanzar una canción aleatoria"
              onClick={() => {
                const pool = candidates.filter((item) => item.id !== event.current_item_id);
                const item = pool[Math.floor(Math.random() * pool.length)];
                if (item) correr(() => advanceEvent(event.id, item.id, event.current_item_id));
              }}>⤨</button>
            <button className={`pdj-btn${event.voting_frozen ? " pdj-btn-on" : ""}`} disabled={ocupado}
              onClick={() => correr(() => freezeVoting(event.id, !event.voting_frozen))}>
              <span className="pdj-btn-ico">▦</span>
              {event.voting_frozen ? "REANUDAR RANKING" : "BLOQUEAR"}
            </button>
            <button className={`pdj-btn${event.voting_disabled ? " pdj-btn-on" : ""}`} disabled={ocupado}
              onClick={() => correr(() => saveEventFields(event.id, { voting_disabled: !event.voting_disabled }))}>
              <span className="pdj-btn-ico">{event.voting_disabled ? "🔓" : "🔒"}</span>
              {event.voting_disabled ? "ACTIVAR VOTOS" : "PAUSAR VOTOS"}
            </button>
            <button className="pdj-btn pdj-btn-peligro" disabled={ocupado}
              onClick={() => {
                if (window.confirm("¿Reiniciar todos los votos del evento?\n\nSe borran los votos y los súper votos usados. La playlist no se toca.")) {
                  correr(() => resetVotes(event.id));
                }
              }}>
              <span className="pdj-btn-ico">↻</span>REINICIAR VOTOS
            </button>
          </div>
          <button className={`pdj-live-voting-toggle${event.voting_disabled ? " is-off" : ""}`}
            disabled={ocupado}
            onClick={() => correr(() => saveEventFields(event.id, { voting_disabled: !event.voting_disabled }))}>
            {event.voting_disabled ? "Activar votación" : "Desactivar votación"}
          </button>
          {event.voting_frozen && <div className="pdj-campo-hint">El ranking visible está bloqueado; los votos siguen entrando.</div>}
          {event.voting_disabled && <div className="pdj-campo-hint" style={{ color: P.amarillo }}>La votación está desactivada.</div>}
        </SonandoAhora>

        {/* ── Top en vivo ────────────────────────────────────────── */}
        <div className="pdj-card pdj-live-ranking">
          <div className="pdj-card-titulo">
            <span style={{ fontSize: 15 }}>🔥</span><h4>Top 15</h4>
            <span className="pdj-hint">En vivo · {candidates.length} candidatas</span>
          </div>

          {candidates.length === 0 ? (
            <div className="pdj-vacio">
              <div className="pdj-vacio-ico">🎵</div>
              <div className="pdj-vacio-tit">Estamos preparando los próximos temas</div>
              <div className="pdj-vacio-txt">
                Cargá canciones desde el Editor; el servidor arma la ventana de candidatas solo.
              </div>
            </div>
          ) : candidates.slice(0, 15).map((item, i) => (
            <div key={item.id} className={`pdj-rank${i < 3 ? " pdj-rank-podio" : ""}${i === 0 ? " pdj-rank-1" : ""}`}>
              <span className="pdj-rank-pos">{i + 1}</span>
              {portada(item) && (
                <img className="pdj-rank-cover" src={portada(item)} alt="" loading="lazy" decoding="async" />
              )}
              <div className="pdj-rank-info">
                <div className="pdj-rank-tit">{item.title}</div>
                <div className="pdj-rank-art">{item.artist || "—"}</div>
                <div className="pdj-rank-votos">
                  <span style={{ color: P.verde }}>+{item.pos_votes}</span>
                  <span style={{ color: P.fucsia }}>−{item.neg_votes}</span>
                </div>
              </div>
              <div className="pdj-rank-score">
                <b style={{ color: colorScore(item.score) }}>{conSigno(item.score)}</b>
                <span>SCORE</span>
              </div>
              <button className="pdj-mini" disabled={ocupado || !enVivo}
                title="Lanzar este tema ahora"
                onClick={() => correr(() => advanceEvent(event.id, item.id, event.current_item_id))}>
                ⏏ Lanzar
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Columna lateral ────────────────────────────────────────── */}
      <aside className="pdj-shell-side">
        <div className="pdj-shell-side-tit">Cabina</div>

        <SeccionQr {...shared} />
        <SeccionesPendientesVivo event={event} onlyRoles />
        <SeccionEstadisticas stats={stats} />

        {/* Sacar tema: estado en vivo de la votación para voltear. */}
        <PanelSection id="sacar-tema-vivo" title="Sacar tema" icon="👎" defaultOpen>
          {!kick?.enabled ? (
            <div style={{ fontSize: 11, color: P.tenue2 }}>
              Sacar Tema está deshabilitado en este evento.
            </div>
          ) : !current ? (
            <div style={{ fontSize: 11, color: P.tenue2 }}>
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
                <div className="pdj-kick-fill" style={{
                  width: `${kick.needed > 0 ? Math.min(100, (kick.votes / kick.needed) * 100) : 0}%`,
                }} />
              </div>
              <div className="pdj-campo-hint">
                Hace falta el {kick.threshold_pct}% de {kick.active} activos. Al llegar, el
                servidor saltea la canción solo.
              </div>
            </>
          )}
        </PanelSection>

        <SeccionTvLink {...shared} />
        <SeccionInvitados {...shared} />
        <SeccionSorteos {...shared} />

        {/* El historial ya no tiene pestaña propia: vive como una sección más. */}
        <PanelSection id="historial" title="Historial de la noche" icon="🕘"
          badge={shared.history.length || null}>
          <HistorialTab {...shared} />
        </PanelSection>

        <SeccionesPendientesVivo event={event} excludeRoles />
      </aside>
    </div>
    </div>
    </>
  );
}
