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
import EventoHeader from "./EventoHeader";
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
function SonandoAhora({ event, current }) {
  const cover = portada(current);
  // El tiempo lo reporta la TV. Sin TV conectada no se inventa progreso: los
  // 421 temas tienen `duration_seconds` en NULL, así que no hay de dónde sacarlo.
  const hayTiempo = event.tv_duration > 0;
  const transcurrido = Number(event.tv_current_time) || 0;
  const restante = hayTiempo ? Math.max(0, event.tv_duration - transcurrido) : null;
  const progreso = hayTiempo ? Math.min(100, (transcurrido / event.tv_duration) * 100) : 0;

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
            <span>{tiempo(transcurrido)} transcurrido</span>
            <span>−{tiempo(restante)} restante</span>
          </div>
        </>
      )}
      {current && !hayTiempo && (
        <div style={{ fontSize: 10.5, color: P.tenue2, marginTop: 11 }}>
          La TV todavía no reporta tiempo, y los temas no tienen duración guardada:
          no hay transcurrido ni restante que mostrar.
        </div>
      )}
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
      {/* Misma cabecera que el Editor: el DJ ve el estado del evento sin
          cambiar de vista ni abrir ningún acordeón. */}
      <EventoHeader
        event={event} items={shared.items} activos={stats.activos}
        onError={onError}
        irA={shared.goTo ? { label: "✏️ Ir al Editor", onClick: () => shared.goTo("pantallaEditor") } : null}
      />

    <div className="pdj-shell">
      {/* ── Columna principal ──────────────────────────────────────── */}
      <div className="pdj-shell-main">
        <SonandoAhora event={event} current={current} />

        {/* El motor recién fija la próxima al avanzar: se muestra como quién
            va ganando, no como algo ya decidido. */}
        {siguiente && (
          <div className="pdj-next">
            {portada(siguiente) && (
              <img className="pdj-next-cover" src={portada(siguiente)} alt="" loading="lazy" />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 9.5, fontWeight: 800, letterSpacing: "1.4px",
                color: "rgba(0,229,255,.75)", marginBottom: 3,
              }}>A CONTINUACIÓN · LIDERANDO LA VOTACIÓN</div>
              <div className="pdj-rank-tit">{siguiente.title}</div>
              <div className="pdj-rank-art">{siguiente.artist || "—"}</div>
            </div>
            <div className="pdj-rank-score">
              <b style={{ color: colorScore(siguiente.score) }}>{conSigno(siguiente.score)}</b>
              <span>PTS</span>
            </div>
          </div>
        )}

        {/* ── Controles ──────────────────────────────────────────── */}
        <div className="pdj-card">
          <div className="pdj-card-titulo">
            <span style={{ fontSize: 15 }}>🎛</span><h4>Controles</h4>
            {!enVivo && <span className="pdj-hint">El evento no está en vivo</span>}
          </div>

          <div className="pdj-controles">
            <button className="pdj-btn pdj-btn-principal" disabled={ocupado || !enVivo}
              onClick={() => correr(() => advanceEvent(event.id, null, event.current_item_id))}>
              <span className="pdj-btn-ico">⏭</span>PASAR CANCIÓN
            </button>

            <button className={`pdj-btn${event.voting_frozen ? " pdj-btn-on" : ""}`} disabled={ocupado}
              onClick={() => correr(() => freezeVoting(event.id, !event.voting_frozen))}
              title="Congela el orden que se muestra. Los votos siguen entrando por detrás.">
              <span className="pdj-btn-ico">{event.voting_frozen ? "▶" : "⏸"}</span>
              {event.voting_frozen ? "REANUDAR RANKING" : "BLOQUEAR RANKING"}
            </button>

            <button className={`pdj-btn${event.voting_disabled ? " pdj-btn-on" : ""}`} disabled={ocupado}
              onClick={() => correr(() =>
                saveEventFields(event.id, { voting_disabled: !event.voting_disabled }))}
              title="Corta la votación entera: nadie puede votar hasta que se reactive.">
              <span className="pdj-btn-ico">{event.voting_disabled ? "🔓" : "🔒"}</span>
              {event.voting_disabled ? "ACTIVAR VOTACIÓN" : "PAUSAR VOTOS"}
            </button>

            <button className="pdj-btn pdj-btn-peligro" disabled={ocupado}
              onClick={() => {
                if (window.confirm(
                  "¿Reiniciar todos los votos del evento?\n\n" +
                  "Se borran los votos y los súper votos usados. La playlist no se toca.")) {
                  correr(() => resetVotes(event.id));
                }
              }}>
              <span className="pdj-btn-ico">↻</span>REINICIAR VOTOS
            </button>
          </div>

          {event.voting_frozen && (
            <div className="pdj-campo-hint" style={{ marginTop: 10 }}>
              Con el ranking bloqueado el orden que ven todos queda quieto, pero los votos se
              siguen registrando. Al reanudar, el ranking salta al estado real.
            </div>
          )}
          {event.voting_disabled && (
            <div className="pdj-campo-hint" style={{ marginTop: 6, color: P.amarillo }}>
              La votación está cortada: el servidor rechaza cualquier voto.
            </div>
          )}
        </div>

        {/* ── Top en vivo ────────────────────────────────────────── */}
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
                Cargá canciones desde el Editor; el servidor arma la ventana de candidatas solo.
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

        <SeccionQr {...shared} />
        <SeccionTvLink {...shared} />
        <SeccionInvitados {...shared} />
        <SeccionSorteos {...shared} />

        {/* El historial ya no tiene pestaña propia: vive como una sección más. */}
        <PanelSection id="historial" title="Historial de la noche" icon="🕘"
          badge={shared.history.length || null}>
          <HistorialTab {...shared} />
        </PanelSection>

        <SeccionesPendientesVivo event={event} />
      </aside>
    </div>
    </>
  );
}
