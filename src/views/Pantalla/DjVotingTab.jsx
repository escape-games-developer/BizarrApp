import { useEffect, useRef, useState } from "react";
import { usePantallaEvent } from "../../hooks/realtime/usePantallaEvent";
import { usePantallaClient } from "../../hooks/realtime/usePantallaClient";
import { portada, conSigno, colorScore, mensajeAmigable } from "../../components/pantalla/pantallaUi";
import djVotingCss from "./djVotingStyles";

/**
 * Cliente — Pantalla › 🎧 Música.
 *
 * La experiencia del invitado de DJ Democracy trasladada a BizarrApp: reacciones,
 * qué suena ahora con el kick colectivo, y el ranking de candidatas para votar
 * lo que sigue. Mobile first, sin nada que parezca un panel administrativo.
 *
 * El cliente sólo vota lo que el admin curó: no busca, no pide ni agrega temas.
 */

const EMOJIS = ["❤️", "🔥", "🤘", "😂", "💃", "🕺"];

// ─── Reacciones ──────────────────────────────────────────────────────────────
function Reacciones({ onReact }) {
  const [pop, setPop] = useState(null);
  return (
    <div className="djv-reacciones">
      {EMOJIS.map((e) => (
        <button key={e} aria-label={`Reaccionar con ${e}`}
          className={`djv-reaccion${pop === e ? " djv-reaccion-pop" : ""}`}
          onClick={() => { onReact(e); setPop(e); setTimeout(() => setPop(null), 420); }}>
          {e}
        </button>
      ))}
    </div>
  );
}

// ─── Sonando ahora + Sacar tema ──────────────────────────────────────────────
function SonandoAhora({ current, kick, onKick, puedeVotar }) {
  const cover = portada(current);
  const pct = kick?.needed > 0 ? Math.min(100, (kick.votes / kick.needed) * 100) : 0;
  const faltan = kick ? Math.max(0, (kick.needed ?? 0) - (kick.votes ?? 0)) : 0;

  return (
    <div className="djv-ahora">
      <div className="djv-ahora-lbl">🎵 SONANDO AHORA</div>

      <div className="djv-ahora-row">
        {cover
          ? <img className="djv-ahora-cover" src={cover} alt="" loading="lazy" decoding="async" />
          : <div className="djv-ahora-vacia">🎵</div>}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="djv-ahora-tit">{current ? current.title : "Esperando al DJ…"}</div>
          <div className="djv-ahora-art">
            {current ? (current.artist || "—") : "En un rato arranca la música"}
          </div>
        </div>
      </div>

      {current && kick?.enabled && (
        <>
          <button
            className={`djv-kick${kick.voted ? " djv-kick-on" : ""}`}
            onClick={onKick}
            disabled={!puedeVotar}
            title={kick.voted ? "Tocá de nuevo para quitar tu voto" : "Pedí que se saltee este tema"}
          >
            {kick.voted ? "✓ PEDISTE SACAR ESTE TEMA" : `👎 ${kick.button_text || "SACAR TEMA"}`}
            <span className="djv-kick-info">
              {kick.votes} de {kick.needed} votos necesarios
              {faltan > 0 ? ` · faltan ${faltan}` : " · ¡se va!"}
            </span>
          </button>
          <div className="djv-kick-barra"><div className="djv-kick-fill" style={{ width: `${pct}%` }} /></div>
        </>
      )}
    </div>
  );
}

// ─── Card de candidata ───────────────────────────────────────────────────────
function TemaCard({
  item, index, miVoto, puedeUp, pesoUp, puedeDown, pesoDown,
  puedeSuper, superUsado, pesoSuper, ocupado, onVote, onSuper,
}) {
  const cover = portada(item);
  const caliente = item.hot_until && new Date(item.hot_until) > new Date();

  const clase = ["djv-tema"];
  if (index === 0)          clase.push("djv-tema-1");
  if (miVoto === "up")      clase.push("djv-tema-votado");
  if (miVoto === "down")    clase.push("djv-tema-contra");

  return (
    <div className={clase.join(" ")}>
      {miVoto === "up" && <span className="djv-chip-voto">TU VOTO</span>}

      <div className="djv-tema-row">
        <span className="djv-tema-pos">{index + 1}</span>
        {cover && <img className="djv-tema-cover" src={cover} alt="" loading="lazy" decoding="async" />}
        <div className="djv-tema-info">
          <div className="djv-tema-tit">
            {caliente && <span style={{ marginRight: 4 }}>🔥</span>}
            {item.title}
          </div>
          <div className="djv-tema-art">{item.artist || "—"}</div>
        </div>
        <div className="djv-tema-pts">
          <b style={{ color: colorScore(item.score) }}>{conSigno(item.score)}</b>
          <span>PTS</span>
        </div>
      </div>

      {(puedeUp || puedeDown || puedeSuper) && (
        <div className="djv-acciones">
          {puedeUp && (
            <button
              className={`djv-voto${miVoto === "up" ? " djv-voto-up-on" : ""}`}
              onClick={() => onVote(item.id, "up")} disabled={ocupado}
              aria-label={miVoto === "up" ? "Quitar mi voto" : "Votar a favor"}>
              {miVoto === "up" ? "✓ 👍" : "👍"}
              {pesoUp > 1 && <span className="djv-peso">×{pesoUp}</span>}
            </button>
          )}

          {puedeDown && (
            <button
              className={`djv-voto${miVoto === "down" ? " djv-voto-down-on" : ""}`}
              onClick={() => onVote(item.id, "down")} disabled={ocupado}
              aria-label={miVoto === "down" ? "Quitar mi voto en contra" : "Votar en contra"}>
              {miVoto === "down" ? "✓ 👎" : "👎"}
              {pesoDown > 1 && <span className="djv-peso">×{pesoDown}</span>}
            </button>
          )}

          {puedeSuper && (
            <button
              className={`djv-voto djv-super${superUsado ? " djv-super-usado" : ""}`}
              onClick={() => onSuper(item.id)} disabled={ocupado || superUsado}
              aria-label={superUsado ? "Super voto ya utilizado" : "Usar el super voto"}>
              {superUsado ? "🔥 USADO" : `🔥 SUPER ×${pesoSuper}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Vista ───────────────────────────────────────────────────────────────────
export default function DjVotingTab({ user, isRestricted = false, onGoProfile }) {
  const { event, candidates, current, loading } = usePantallaEvent({ discoverLive: true });
  const cli = usePantallaClient(event, user);
  const [flash, setFlash] = useState(null);
  const anterior = useRef(null);

  // Avisito cuando cambia el tema: hace visible el realtime.
  useEffect(() => {
    if (anterior.current && current?.id && anterior.current !== current.id) {
      setFlash(`🎵 Ahora suena: ${current.title}`);
      const t = setTimeout(() => setFlash(null), 3500);
      return () => clearTimeout(t);
    }
    anterior.current = current?.id ?? null;
  }, [current?.id, current?.title]);

  if (loading) {
    return (
      <>
        <style>{djVotingCss}</style>
        <div className="djv-skel" style={{ height: 46, marginBottom: 14 }} />
        <div className="djv-skel" style={{ height: 150 }} />
        <div className="djv-skel" style={{ height: 88 }} />
        <div className="djv-skel" style={{ height: 88 }} />
      </>
    );
  }

  if (!event) {
    return (
      <>
        <style>{djVotingCss}</style>
        <div className="djv-vacio">
          <div className="djv-vacio-ico">🎧</div>
          <div className="djv-vacio-tit">No hay música en votación ahora</div>
          <div className="djv-vacio-txt">
            Cuando el DJ inicie el evento vas a poder votar los próximos temas desde acá.
          </div>
        </div>
      </>
    );
  }

  const up    = cli.powerOf("up");
  const down  = cli.powerOf("down");
  const super_ = cli.powerOf("super_up");
  const puedeVotar = !isRestricted && Boolean(user?.registered) && !event.voting_disabled;

  const aviso = !user?.registered
    ? { txt: "Registrate para votar. La votación usa tu cuenta, así cada persona vota una sola vez.", cta: "👤 Registrarme" }
    : isRestricted
      ? { txt: "Verificá tu ubicación en el bar para poder votar.", cta: "📍 Verificar ubicación" }
      : null;

  return (
    <>
      <style>{djVotingCss}</style>

      {/* Estado */}
      <div style={{
        fontFamily: "Syne, sans-serif", fontSize: 17, fontWeight: 900,
        color: "#F5E6C0", marginBottom: 10, lineHeight: 1.2,
      }}>{event.name}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 13 }}>
        <span className="djv-estado"><i />EN VIVO</span>
        <span className="djv-meta">{candidates.length} temas para votar</span>
        {event.voting_frozen && <span className="djv-meta">❄️ ranking congelado</span>}
      </div>

      {flash && <div className="djv-aviso djv-aviso-ok">{flash}</div>}

      {cli.error && (
        <div className="djv-aviso djv-aviso-error" onClick={cli.clearError}
          role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && cli.clearError()}>
          {mensajeAmigable(cli.error)}
        </div>
      )}

      {aviso && (
        <div className="djv-aviso djv-aviso-info">
          {aviso.txt}
          {onGoProfile && (
            <div><button className="djv-aviso-cta" onClick={onGoProfile}>{aviso.cta}</button></div>
          )}
        </div>
      )}

      {puedeVotar && <Reacciones onReact={cli.react} />}

      <SonandoAhora current={current} kick={cli.kick} onKick={cli.toggleKick} puedeVotar={puedeVotar} />

      <div className="djv-seccion">
        <div className="djv-seccion-tit"><span>🔥</span> Votá lo que suena después</div>
        <div className="djv-seccion-sub">Elegí el próximo tema del bar.</div>
      </div>

      {event.voting_disabled && (
        <div className="djv-aviso djv-aviso-info">El DJ pausó la votación por un rato.</div>
      )}

      {candidates.length === 0 ? (
        <div className="djv-vacio">
          <div className="djv-vacio-ico">🎵</div>
          <div className="djv-vacio-tit">Estamos preparando los próximos temas</div>
          <div className="djv-vacio-txt">En un momento aparecen las canciones para votar.</div>
        </div>
      ) : candidates.map((item, i) => (
        <TemaCard
          key={item.id}
          item={item}
          index={i}
          miVoto={cli.voteOn(item.id)}
          puedeUp={up.enabled && puedeVotar}
          pesoUp={up.value}
          puedeDown={down.enabled && puedeVotar}
          pesoDown={down.value}
          puedeSuper={super_.enabled && puedeVotar}
          pesoSuper={super_.value}
          superUsado={cli.superUsed}
          ocupado={cli.busy === item.id}
          onVote={cli.vote}
          onSuper={cli.superVote}
        />
      ))}

      {(cli.superUsed || cli.role !== "guest") && (
        <div className="djv-pie">
          {cli.superUsed && <div>🔥 Ya usaste tu Super Voto en este evento</div>}
          {cli.role !== "guest" && <div>Estás votando como <strong>{cli.role.toUpperCase()}</strong></div>}
        </div>
      )}
    </>
  );
}
