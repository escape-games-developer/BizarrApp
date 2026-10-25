import { useEffect, useRef, useState } from "react";
import { portada, conSigno, colorScore, mensajeAmigable } from "../../components/pantalla/pantallaUi";
import Icono from "../../components/iconos/Icono";
import djVotingCss from "./djVotingStyles";
import { marcaDelEvento, hayMarca, rgba } from "../../constants/marcaEvento";
import { esKickDual } from "../../constants/kickModos";
import { useCierreVotacion } from "../../hooks/useCierreVotacion";

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

// ─── Amor y Odio / Guns & Roses ──────────────────────────────────────────────
// Un voto por tema, a favor (flor, +1) o en contra (tomate / bala, −1), que no
// se cambia. El medidor va del umbral negativo (se corta) al positivo (a salvo).

function IconoKick({ url, emoji }) {
  return url
    ? <img src={url} alt="" style={{ width: 22, height: 22, objectFit: "contain" }} />
    : <span style={{ fontSize: 20, lineHeight: 1 }}>{emoji}</span>;
}

function KickDual({ kick, onVote, puedeVotar }) {
  const guns = kick.style === "guns_roses";
  const neg  = Math.min(-1, kick.negative_threshold ?? -10);
  const pos  = Math.max(1, kick.positive_threshold ?? 10);
  const valor = Math.max(neg, Math.min(pos, kick.meter ?? 0));
  // El cero queda donde corresponde entre los dos umbrales (no siempre al medio).
  const cero = (-neg / (pos - neg)) * 100;
  const punta = ((valor - neg) / (pos - neg)) * 100;
  const verde = valor >= 0;
  const yaVoto = kick.my_vote === 1 || kick.my_vote === -1;

  const botones = [
    { value: 1, texto: guns ? (kick.flower_text || "Salvar el Tema") : "Salvar",
      icono: <IconoKick url={kick.assets?.flower_icon} emoji="🌹" />, color: "#34D399" },
    { value: -1, texto: guns ? (kick.shoot_text || "Matar el Tema") : (kick.button_text || "Sacar Tema"),
      icono: <IconoKick url={guns ? kick.assets?.shoot_icon : null} emoji={guns ? "🔫" : "🍅"} />, color: "#F87171" },
  ];

  return (
    <div style={{ marginTop: 10 }}>
      {kick.saved ? (
        <div style={{ textAlign: "center", fontSize: 13, fontWeight: 800, color: "#34D399", padding: "6px 0" }}>
          🌹 ¡Este tema quedó a salvo!
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          {botones.map((b) => {
            const mio = kick.my_vote === b.value;
            return (
              <button key={b.value} type="button" onClick={() => onVote(b.value)}
                disabled={!puedeVotar || yaVoto}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  minHeight: 40, padding: "6px 10px", borderRadius: 14, font: "inherit", fontSize: 13, fontWeight: 800,
                  cursor: !puedeVotar || yaVoto ? "default" : "pointer",
                  background: mio ? `${b.color}26` : "#000000",
                  border: `1.5px solid ${mio ? b.color : "rgba(245,230,192,.14)"}`,
                  color: mio ? b.color : "rgba(245,230,192,.75)",
                  opacity: yaVoto && !mio ? .45 : 1, WebkitTapHighlightColor: "transparent",
                }}>
                {b.icono}{mio ? `✓ ${b.texto}` : b.texto}
              </button>
            );
          })}
        </div>
      )}
      {/* Medidor: del umbral negativo (izquierda) al positivo (derecha). */}
      <div style={{ position: "relative", height: 8, marginTop: 9, borderRadius: 999, background: "rgba(245,230,192,.1)" }}>
        <div style={{ position: "absolute", top: 0, bottom: 0, borderRadius: 999,
          left: `${Math.min(cero, punta)}%`, width: `${Math.abs(punta - cero)}%`,
          background: verde ? "#34D399" : "#F87171", transition: "all .4s ease" }} />
        <div style={{ position: "absolute", top: -3, bottom: -3, width: 2, left: `calc(${cero}% - 1px)`,
          background: "rgba(245,230,192,.45)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, marginTop: 4,
        color: "rgba(245,230,192,.45)" }}>
        <span>{guns ? "🔫" : "🍅"} {neg}</span>
        <span style={{ color: verde ? "#34D399" : "#F87171", fontWeight: 800 }}>{valor > 0 ? `+${valor}` : valor}</span>
        <span>🌹 +{pos}</span>
      </div>
    </div>
  );
}

// ─── Sonando ahora + Sacar tema ──────────────────────────────────────────────
function SonandoAhora({ current, kick, onKick, onKickFijo, puedeVotar, conPortada, logo = null }) {
  const pct = kick?.needed > 0 ? Math.min(100, (kick.votes / kick.needed) * 100) : 0;
  const dual = esKickDual(kick?.style);
  const mostrarKick = !!(current && kick?.enabled && kick.visible !== false);
  // La portada sólo la dibujan los temas que la piden (Vista Original va sin).
  const cover = conPortada && current ? portada(current) : null;

  return (
    <div className="djv-ahora">
      {/* La etiqueta va en la columna del texto: así el botón queda centrado
          verticalmente contra todo el bloque. */}
      <div className="djv-ahora-row">
        {cover && <img className="djv-ahora-cover" src={cover} alt="" decoding="async" />}
        {/* Logo del evento (Editor → Personalización visual), si no hay portada. */}
        {!cover && logo && (
          <img src={logo} alt="" decoding="async"
            style={{ width: 44, height: 44, objectFit: "contain", flexShrink: 0 }} />
        )}
        <div className="djv-ahora-info">
          <div className="djv-ahora-lbl">🎵 SONANDO AHORA</div>
          <div className="djv-ahora-tit">{current ? current.title : "Esperando al DJ…"}</div>
          <div className="djv-ahora-art">
            {current ? (current.artist || "—") : "En un rato arranca la música"}
          </div>
        </div>
        {/* Con menos invitados activos que el mínimo de conectados, el servidor
            dice visible: false y el botón no aparece. */}
        {mostrarKick && !dual && (
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

      {mostrarKick && dual && <KickDual kick={kick} onVote={onKickFijo} puedeVotar={puedeVotar} />}

      {/* Progreso del kick: franja fina sobre el borde inferior del bloque. */}
      {current && kick?.enabled && !dual && (
        <div className="djv-kick-barra"><div className="djv-kick-fill" style={{ width: `${pct}%` }} /></div>
      )}
    </div>
  );
}

// ─── Card de candidata ───────────────────────────────────────────────────────
function TemaCard({
  item, index, miVoto, puedeUp, pesoUp, puedeDown, pesoDown,
  puedeSuper, pesoSuper, puedeHate, pesoHate, superLeft, superEnTema,
  ocupado, onVote, onSuper,
}) {
  const cover = portada(item);
  const caliente = item.hot_until && new Date(item.hot_until) > new Date();

  const clase = ["djv-tema"];
  if (index === 0)          clase.push("djv-tema-1");
  if (miVoto === "up")      clase.push("djv-tema-votado");
  if (miVoto === "down")    clase.push("djv-tema-contra");
  const conAcciones = puedeUp || puedeDown || puedeSuper || puedeHate;
  // Súper Voto y Súper Hate comparten el cupo. Un tema ya súper-votado no
  // acepta otro súper (el servidor no le sumaría peso y gastaría el cupo).
  const superAgotado = superLeft <= 0 || !!superEnTema;

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

        {/* Orden fijo: 👍 | 🔥 | 💀 | 👎. El +N / -N de arriba de cada botón es
            el valor real del voto para el rol (powerOf), sólo informativo.
            Cada botón aparece sólo si el rol tiene ese poder encendido. */}
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
                className={`djv-voto djv-super${superAgotado && superEnTema !== "super_up" ? " djv-super-usado" : ""}${superEnTema === "super_up" ? " djv-super-on" : ""}`}
                onClick={() => onSuper(item.id, "super_up")} disabled={ocupado || superAgotado}
                aria-label={superEnTema === "super_up" ? "Ya le diste un Súper Voto a este tema"
                  : superLeft <= 0 ? "No te quedan súper votos" : "Usar un Súper Voto"}>
                <span className="djv-valor djv-valor-super" aria-hidden="true">+{pesoSuper}</span>
                🔥
                {/* Súper votos que le quedan (compartidos con el Súper Hate). */}
                <span className="djv-valor djv-valor-super djv-valor-abajo" aria-hidden="true">
                  x{superLeft}
                </span>
              </button>
            )}

            {puedeHate && (
              <button
                className={`djv-voto djv-hate${superAgotado && superEnTema !== "super_down" ? " djv-super-usado" : ""}${superEnTema === "super_down" ? " djv-hate-on" : ""}`}
                onClick={() => onSuper(item.id, "super_down")} disabled={ocupado || superAgotado}
                aria-label={superEnTema === "super_down" ? "Ya le diste un Súper Hate a este tema"
                  : superLeft <= 0 ? "No te quedan súper votos" : "Usar un Súper Hate"}>
                <span className="djv-valor djv-valor-hate" aria-hidden="true">-{pesoHate}</span>
                💀
                <span className="djv-valor djv-valor-hate djv-valor-abajo" aria-hidden="true">
                  x{superLeft}
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

// ─── Personalización visual del evento ───────────────────────────────────────
// Editor → «Personalización visual»: acento en «Sonando ahora», texto en los
// títulos de los temas y fondo detrás de la vista. Va ANTES del tema del
// Diseñador Cliente: con un tema activo, lo que el tema define gana.
function cssDeMarca(m) {
  const r = [];
  if (m.acento) r.push(`.djv-marca .djv-ahora-lbl{color:${m.acento};}`,
    `.djv-marca .djv-ahora{border-color:${rgba(m.acento, .4)};}`);
  if (m.texto) r.push(`.djv-marca .djv-ahora-tit,.djv-marca .djv-tema-tit{color:${m.texto};}`);
  if (m.fondo || m.fondoImagen) {
    const img = m.fondoImagen
      ? `background-image:linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.55)),url("${m.fondoImagen.replace(/"/g, "%22")}");background-size:cover;background-position:center;`
      : "";
    // El fondo ocupa toda la sección: se come el padding de .app-content.
    r.push(`.djv-marca{${m.fondo ? `background-color:${m.fondo};` : ""}${img}
      margin:-14px -16px -16px;padding:14px 16px 16px;box-sizing:border-box;}`,
      `.djv-marca.djv-vista{height:calc(100% + 30px);}`);
  }
  return r.join("");
}

// ─── Lienzo: CSS base + tema activo del Diseñador Cliente ───────────────────
// Sin tema (Vista Original) es el mismo marcado de siempre. Con tema, todo va
// dentro de su clase raíz, así su CSS no sale de la vista (ni al logo ni a la
// navegación inferior, que son del shell).
function Lienzo({ theme, marca = null, className = "", children }) {
  const conMarca = hayMarca(marca);
  const clases = [className, conMarca && "djv-marca", theme?.className].filter(Boolean).join(" ");
  return (
    <div className={clases || undefined}>
      <style>{djVotingCss}</style>
      {conMarca && <style>{cssDeMarca(marca)}</style>}
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
  // Últimos segundos de la canción: la votación se cierra sola (la base
  // rechaza los votos) mientras se prepara la próxima.
  const cierre = useCierreVotacion(event);

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

  const marca = marcaDelEvento(event);
  const up    = cli.powerOf("up");
  const down  = cli.powerOf("down");
  const super_ = cli.powerOf("super_up");
  const hate  = cli.powerOf("super_down");
  // El invitado vota: su sesión anónima tiene un auth.uid() propio, que es lo
  // que la votación necesita para contar un voto por persona. `registered`
  // sigue en false y así queda — no le escribimos nada a la base para esto.
  const puedeVotar = !isRestricted && (Boolean(user?.registered) || isGuest)
                     && !event.voting_disabled;
  // Reacciones y Sacar tema siguen; lo que cierra es el voto de los temas.
  const puedeVotarTemas = puedeVotar && !cierre.cerrada;

  const aviso = isGuest
    ? null
    : !user?.registered
      ? { txt: "Registrate para votar. La votación usa tu cuenta, así cada persona vota una sola vez.", cta: "👤 Registrarme" }
      : isRestricted
        ? { txt: "Verificá tu ubicación en el bar para poder votar.", cta: "📍 Verificar ubicación" }
        : null;

  // Todo hasta el título "Top" queda fijo; sólo scrollea la lista de temas.
  return (
    <Lienzo theme={theme} marca={marca} className="djv-vista">
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

        <SonandoAhora current={current} kick={cli.kick} onKick={cli.toggleKick} onKickFijo={cli.voteKickFijo}
          puedeVotar={puedeVotar}
          logo={marca.logo}
          conPortada={Boolean(theme?.nowPlayingCover)} />

        <div className="djv-seccion">
          <div className="djv-seccion-tit">
            <Icono nombre="trophy" size={16} strokeWidth={2.2} className="djv-copa" /> Top - Votá lo que suena después
          </div>
        </div>

        {event.voting_disabled && (
          <div className="djv-aviso djv-aviso-info">El DJ pausó la votación por un rato.</div>
        )}
        {!event.voting_disabled && cierre.cerrada && (
          <div className="djv-aviso djv-aviso-info" role="status">
            ❄ Votación cerrada — preparando la próxima canción
            {cierre.restante > 0 && ` · ${Math.ceil(cierre.restante)}s`}
          </div>
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
            puedeUp={up.enabled && puedeVotarTemas}
            pesoUp={up.value}
            puedeDown={down.enabled && puedeVotarTemas}
            pesoDown={down.value}
            puedeSuper={super_.enabled && puedeVotarTemas}
            pesoSuper={super_.value}
            puedeHate={hate.enabled && puedeVotarTemas}
            pesoHate={hate.value}
            superLeft={cli.superLeft ?? (cli.superUsed ? 0 : 1)}
            superEnTema={cli.superOn?.(item.id) ?? null}
            ocupado={cli.busy === item.id}
            onVote={cli.vote}
            onSuper={cli.superVote}
          />
        ))}

        {((super_.enabled || hate.enabled) || cli.role !== "guest") && (
          <div className="djv-pie">
            {(super_.enabled || hate.enabled) && (
              <div>{cli.superUsed
                ? "🔥 Ya usaste todos tus súper votos en este evento"
                : `🔥 Te ${cli.superLeft === 1 ? "queda" : "quedan"} ${cli.superLeft} súper ${cli.superLeft === 1 ? "voto" : "votos"}`}</div>
            )}
            {cli.role !== "guest" && <div>Estás votando como <strong>{cli.role.toUpperCase()}</strong></div>}
          </div>
        )}
      </div>
    </Lienzo>
  );
}
