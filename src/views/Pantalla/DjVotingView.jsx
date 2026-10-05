import { useEffect, useRef, useState } from "react";
import { portada, conSigno, colorScore, mensajeAmigable } from "../../components/pantalla/pantallaUi";
import Icono from "../../components/iconos/Icono";
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

// ─── Reacciones ──────────────────────────────────────────────────────────────
//
// Los emojis salen del pack que el admin configuró para el rol de esta persona
// («Paquetes de emojis por rol» en el editor). Antes eran una lista fija acá:
// el panel guardaba packs que nadie leía y el VIP veía lo mismo que el invitado.
//
// Un pack vacío es una decisión válida del admin —«este rol no reacciona»—, así
// que en ese caso no se dibuja la fila en vez de caer a una lista por defecto.
function Reacciones({ onReact, emojis }) {
  const [pop, setPop] = useState(null);
  if (!emojis?.length) return null;
  return (
    <div className="djv-reacciones">
      {emojis.map((e) => (
        <button key={e} aria-label={`Reaccionar con ${e}`}
          className={`djv-reaccion${pop === e ? " djv-reaccion-pop" : ""}`}
          onClick={() => { onReact(e); setPop(e); setTimeout(() => setPop(null), 420); }}>
          {e}
        </button>
      ))}
    </div>
  );
}

// El texto del botón lo configura el admin («Texto del botón en el cliente»).
// Se parte en dos renglones por el espacio más cercano a la mitad:
// "Voltear tema" → Voltear / tema; "Voltear este tema" → Voltear / este tema.
function dosRenglones(texto) {
  const palabras = texto.trim().split(/\s+/);
  if (palabras.length < 2) return texto;
  let corte = 1, mejor = Infinity;
  for (let i = 1; i < palabras.length; i++) {
    const dif = Math.abs(palabras.slice(0, i).join(" ").length - palabras.slice(i).join(" ").length);
    if (dif < mejor) { mejor = dif; corte = i; }
  }
  return <>{palabras.slice(0, corte).join(" ")}<br />{palabras.slice(corte).join(" ")}</>;
}

// ─── Sonando ahora + Sacar tema ──────────────────────────────────────────────
function SonandoAhora({ current, kick, onKick, puedeVotar, conPortada }) {
  const pct = kick?.needed > 0 ? Math.min(100, (kick.votes / kick.needed) * 100) : 0;
  // La portada sólo la dibujan los temas que la piden (Vista Original va sin).
  const cover = conPortada && current ? portada(current) : null;

  return (
    <div className="djv-ahora">
      {/* La etiqueta va en la columna del texto: así el botón queda centrado
          verticalmente contra todo el bloque. */}
      <div className="djv-ahora-row">
        {cover && <img className="djv-ahora-cover" src={cover} alt="" decoding="async" />}
        <div className="djv-ahora-info">
          <div className="djv-ahora-lbl">🎵 SONANDO AHORA</div>
          <div className="djv-ahora-tit">{current ? current.title : "Esperando al DJ…"}</div>
          <div className="djv-ahora-art">
            {current ? (current.artist || "—") : "En un rato arranca la música"}
          </div>
        </div>
        {current && kick?.enabled && (
          <button
            className={`djv-kick${kick.voted ? " djv-kick-on" : ""}`}
            onClick={onKick}
            disabled={!puedeVotar}
            title={kick.voted ? "Tocá de nuevo para quitar tu voto" : "Pedí que se saltee este tema"}
          >
            {dosRenglones(kick.voted ? "✓ PEDISTE SACAR ESTE TEMA" : (kick.button_text || "SACAR TEMA"))}
          </button>
        )}
      </div>

      {/* Progreso del kick: franja fina sobre el borde inferior del bloque. */}
      {current && kick?.enabled && (
        <div className="djv-kick-barra"><div className="djv-kick-fill" style={{ width: `${pct}%` }} /></div>
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
  const conAcciones = puedeUp || puedeDown || puedeSuper;

  return (
    <div className={clase.join(" ")}>
      {miVoto === "up" && <span className="djv-chip-voto">TU VOTO</span>}

      <div className={`djv-tema-grid${conAcciones ? "" : " djv-tema-grid-solo"}`}>
        <span className="djv-tema-pos">{index + 1}</span>
        {/* Sin portada queda el recuadro vacío: mantiene la lista alineada. */}
        {cover
          ? <img className="djv-tema-cover" src={cover} alt="" loading="lazy" decoding="async" />
          : <div className="djv-tema-cover" />}
        <div className="djv-tema-info">
          <div className="djv-tema-tit">
            {caliente && <span style={{ marginRight: 4 }}>🔥</span>}
            {item.title}
          </div>
          <div className="djv-tema-art">{item.artist || "—"}</div>
        </div>
        <div className="djv-tema-pts">
          <b style={{ color: colorScore(item.score) }}>{conSigno(item.score)}</b>
        </div>

        {/* Orden fijo: 👍 | 🔥 | 👎. El +N / -N de arriba de cada botón es
            el valor real del voto para el rol (powerOf), sólo informativo. */}
        {conAcciones && (
          <div className="djv-acciones">
            {puedeUp && (
              <button
                className={`djv-voto djv-voto-up${miVoto === "up" ? " djv-voto-up-on" : ""}`}
                onClick={() => onVote(item.id, "up")} disabled={ocupado}
                aria-label={miVoto === "up" ? "Quitar mi voto" : "Votar a favor"}>
                <span className="djv-valor djv-valor-up" aria-hidden="true">+{pesoUp}</span>
                {miVoto === "up" ? "✓ 👍" : "👍"}
              </button>
            )}

            {puedeSuper && (
              <button
                className={`djv-voto djv-super${superUsado ? " djv-super-usado" : ""}`}
                onClick={() => onSuper(item.id)} disabled={ocupado || superUsado}
                aria-label={superUsado ? "Super voto ya utilizado" : "Usar el super voto"}>
                <span className="djv-valor djv-valor-super" aria-hidden="true">+{pesoSuper}</span>
                🔥
                {/* Super votos disponibles: uno por evento. */}
                <span className="djv-valor djv-valor-super djv-valor-abajo" aria-hidden="true">
                  x{superUsado ? 0 : 1}
                </span>
              </button>
            )}

            {puedeDown && (
              <button
                className={`djv-voto djv-voto-down${miVoto === "down" ? " djv-voto-down-on" : ""}`}
                onClick={() => onVote(item.id, "down")} disabled={ocupado}
                aria-label={miVoto === "down" ? "Quitar mi voto en contra" : "Votar en contra"}>
                <span className="djv-valor djv-valor-down" aria-hidden="true">-{pesoDown}</span>
                {miVoto === "down" ? "✓ 👎" : "👎"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Lienzo: CSS base + tema activo del Diseñador Cliente ───────────────────
// Sin tema (Vista Original) es el mismo marcado de siempre. Con tema, todo va
// dentro de su clase raíz, así su CSS no sale de la vista (ni al logo ni a la
// navegación inferior, que son del shell).
function Lienzo({ theme, className = "", children }) {
  const clases = [className, theme?.className].filter(Boolean).join(" ");
  return (
    <div className={clases || undefined}>
      <style>{djVotingCss}</style>
      {theme && <style>{theme.fontsCss}</style>}
      {theme && <style>{theme.css}</style>}
      {theme?.tvStripe && (
        <div className="djv-tv-franja" aria-hidden="true">
          {theme.tvStripe.map((c, i) => <span key={i} style={{ background: c }} />)}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Vista ───────────────────────────────────────────────────────────────────
// Sólo presentación: recibe el evento y las acciones (`cli`) ya resueltos. La
// usa también el preview del Diseñador Cliente, con datos de prueba.
export default function DjVotingView({
  event, candidates, current, loading, cli,
  user, isRestricted = false, isGuest = false, onGoProfile, theme = null,
}) {
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
      <Lienzo theme={theme}>
        <div className="djv-skel" style={{ height: 32, marginBottom: 8 }} />
        <div className="djv-skel" style={{ height: 84 }} />
        <div className="djv-skel" style={{ height: 80 }} />
        <div className="djv-skel" style={{ height: 80 }} />
      </Lienzo>
    );
  }

  if (!event) {
    return (
      <Lienzo theme={theme}>
        <div className="djv-vacio">
          <div className="djv-vacio-ico">🎧</div>
          <div className="djv-vacio-tit">No hay música en votación ahora</div>
          <div className="djv-vacio-txt">
            Cuando el DJ inicie el evento vas a poder votar los próximos temas desde acá.
          </div>
        </div>
      </Lienzo>
    );
  }

  const up    = cli.powerOf("up");
  const down  = cli.powerOf("down");
  const super_ = cli.powerOf("super_up");
  // El invitado vota: su sesión anónima tiene un auth.uid() propio, que es lo
  // que la votación necesita para contar un voto por persona. `registered`
  // sigue en false y así queda — no le escribimos nada a la base para esto.
  const puedeVotar = !isRestricted && (Boolean(user?.registered) || isGuest)
                     && !event.voting_disabled;

  const aviso = isGuest
    ? null
    : !user?.registered
      ? { txt: "Registrate para votar. La votación usa tu cuenta, así cada persona vota una sola vez.", cta: "👤 Registrarme" }
      : isRestricted
        ? { txt: "Verificá tu ubicación en el bar para poder votar.", cta: "📍 Verificar ubicación" }
        : null;

  // Todo hasta el título "Top" queda fijo; sólo scrollea la lista de temas.
  return (
    <Lienzo theme={theme} className="djv-vista">
      <div className="djv-fijo">
        {event.voting_frozen && (
          <div className="djv-meta" style={{ marginBottom: 13 }}>❄️ ranking congelado</div>
        )}

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

        {puedeVotar && <Reacciones onReact={cli.react} emojis={cli.emojis} />}

        <SonandoAhora current={current} kick={cli.kick} onKick={cli.toggleKick} puedeVotar={puedeVotar}
          conPortada={Boolean(theme?.nowPlayingCover)} />

        <div className="djv-seccion">
          <div className="djv-seccion-tit">
            <Icono nombre="trophy" size={16} strokeWidth={2.2} className="djv-copa" /> Top - Votá lo que suena después
          </div>
        </div>

        {event.voting_disabled && (
          <div className="djv-aviso djv-aviso-info">El DJ pausó la votación por un rato.</div>
        )}
      </div>

      <div className="djv-lista">
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
      </div>
    </Lienzo>
  );
}
