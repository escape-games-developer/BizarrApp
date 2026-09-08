import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { supabaseAnon } from "../lib/supabase";
import { usePantallaEvent } from "../hooks/realtime/usePantallaEvent";
import { useGameState } from "../hooks/realtime/useGameState";
import { BIGSCREEN_CSS, PlacaScreen, RaffleScreen, TriviaScreen } from "../bigscreen/BizarrApp PantallaGigante Festival";
import DueloBigscreen from "../bigscreen/DueloBigscreen";
import FtlOverlay from "./FtlOverlay";
import FtlStandby from "./FtlStandby";
import { useFollowLeaderVotes } from "../hooks/realtime/useFollowLeaderVotes";
import { resolveTv, guestUrl, ytThumb } from "../services/pantallaDj";
import { useContinuousTvPlayers } from "./useContinuousTvPlayers";
import { loadTvConfig } from "../designers/lib/persistence";

/**
 * MODO TV — el motor de reproducción del módulo Pantalla/Escenario.
 *
 * Es la única salida de audio: ni el DJ ni el cliente reproducen nada. La TV
 * carga la YouTube IFrame API, reproduce la canción marcada como actual en la
 * base, reporta su progreso y, cuando el video termina, pide el avance ella
 * misma pasando el id de la canción como guard de concurrencia.
 *
 * Entra sin sesión: /tv?code=XXXXXX&key=<token>. El token se valida server-side
 * con `pantalla_resolve_tv`; nunca se expone por REST.
 */

const C = {
  bg: "#08040F", gold: "#FFD600", cyan: "#00E5FF",
  pink: "#FF2D78", green: "#00F5A0", white: "#F0E8FF",
};

// ─── Reacciones flotantes ────────────────────────────────────────────────────
function Reacciones({ eventId, size = "medium" }) {
  const [burbujas, setBurbujas] = useState([]);
  // Sufijo propio de esta instancia: dos componentes con el mismo nombre de
  // canal reusarian el de Supabase y el segundo .on() falla tras subscribe().
  const canalId = useRef(Math.random().toString(36).slice(2, 8));

  useEffect(() => {
    if (!eventId) return;
    const channel = supabaseAnon
      .channel(`pantalla-tv-reactions-${eventId}-${canalId.current}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "pantalla_reactions", filter: `event_id=eq.${eventId}` },
        (payload) => {
          const burbuja = {
            key:   payload.new.id,
            emoji: payload.new.emoji,
            left:  8 + Math.random() * 84,
            dur:   3 + Math.random() * 1.5,
          };
          setBurbujas((prev) => [...prev.slice(-24), burbuja]);
          setTimeout(() => {
            setBurbujas((prev) => prev.filter((b) => b.key !== burbuja.key));
          }, burbuja.dur * 1000);
        })
      .subscribe();
    return () => { supabaseAnon.removeChannel(channel); };
  }, [eventId]);

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 90, overflow: "hidden" }}>
      {burbujas.map((b) => (
        <span key={b.key} style={{
          position: "absolute", bottom: -60, left: `${b.left}%`, fontSize: { small: 34, medium: 52, large: 72 }[size] || 52,
          animation: `tvFloat ${b.dur}s ease-out forwards`,
          filter: "drop-shadow(0 4px 14px rgba(0,0,0,.7))",
        }}>{b.emoji}</span>
      ))}
    </div>
  );
}

// ─── Panel lateral: QR + próximas ────────────────────────────────────────────
function QrPanel({ code, block }) {
  const content = block.content || {};
  const align = block.font?.align || "center";
  const label = <div style={{
    fontFamily: fontFamily(content.labelFont), fontWeight: content.bold ? 900 : 400,
    fontSize: content.labelSize ? `${content.labelSize}px` : "min(8cqw,12cqh)",
    letterSpacing: ".08em", color: content.labelColor || content.textColor || C.gold,
  }}>{content.text}</div>;
  return (
      <div style={{ alignItems: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center", display: "flex", flexDirection: "column", gap: "3cqh", height: "100%", justifyContent: "center", textAlign: align, width: "100%" }}>
        {content.textPosition !== "bottom" && label}
        <div style={{ background: "#fff", padding: "2cqw", borderRadius: "3cqw", display: "flex", maxHeight: "62cqh", maxWidth: "78cqw" }}>
          <QRCode value={guestUrl(code)} style={{ height: "100%", width: "100%" }} />
        </div>
        {content.showSubtitle && <span style={{ color: content.labelColor || C.gold, fontFamily: fontFamily(content.labelFont), fontSize: `max(8px,${Number(content.labelSize || 18) * .72}px)` }}>{content.subtitle || "Entrá y votá…"}</span>}
        {content.showCode && <b style={{ color: content.codeColor || C.gold, fontFamily: fontFamily(content.codeFont), fontSize: content.codeSize ? `${content.codeSize}px` : "min(11cqw,18cqh)" }}>{code}</b>}
        {content.textPosition === "bottom" && label}
      </div>
  );
}

function UpcomingPanel({ candidates }) {
  return (
      <div style={{ width: "100%", height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{
          fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: "min(7cqw,10cqh)",
          letterSpacing: ".08em", color: C.cyan, marginBottom: "3cqh",
        }}>PRÓXIMAS CANCIONES</div>

        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          {candidates.length === 0 && (
            <div style={{ fontSize: "min(6cqw,8cqh)", color: "rgba(240,232,255,.3)" }}>
              Esperando que el DJ cargue la lista…
            </div>
          )}
          {candidates.slice(0, 8).map((item, i) => (
            <div key={item.id} style={{
              display: "flex", alignItems: "center", gap: "3cqw", padding: "2cqh 2cqw", marginBottom: "2cqh",
              borderRadius: "2cqw", background: i === 0 ? "rgba(255,214,0,.09)" : "rgba(240,232,255,.03)",
              border: `1px solid ${i === 0 ? "rgba(255,214,0,.28)" : "rgba(240,232,255,.06)"}`,
            }}>
              <span style={{
                width: "8cqw", textAlign: "center", flexShrink: 0,
                fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: "min(6cqw,9cqh)",
                color: i === 0 ? C.gold : "rgba(240,232,255,.28)",
              }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: "min(6cqw,9cqh)", fontWeight: 700, color: C.white,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{item.title}</div>
                <div style={{
                  fontSize: "min(5cqw,7cqh)", color: "rgba(240,232,255,.35)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{item.artist || "—"}</div>
              </div>
              <span style={{
                flexShrink: 0, fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: "min(6cqw,9cqh)",
                color: item.score > 0 ? C.green : item.score < 0 ? C.pink : "rgba(240,232,255,.25)",
              }}>{item.score > 0 ? `+${item.score}` : item.score}</span>
            </div>
          ))}
        </div>
      </div>
  );
}

const fontFamily = value => ({ inter: "Inter, sans-serif", poppins: "Poppins, sans-serif", space: "'Space Grotesk', sans-serif", system: "system-ui, sans-serif" }[value] || "inherit");
const shadow = { soft: "0 6px 18px rgba(0,0,0,.3)", medium: "0 10px 28px rgba(0,0,0,.5)", strong: "0 16px 42px rgba(0,0,0,.75)" };

/**
 * El mismo bloque, forzado a ocupar la pantalla entera y sin adornos.
 *
 * Durante Follow the Leader la TV es el video del participante y nada más, pero
 * el bloque de video se sigue renderizando con `ConfiguredBlock` a propósito:
 * los players A/B viven adentro y moverlos a otro contenedor los desmontaría,
 * matando la reproducción. Se cambian las props, no el árbol.
 */
const aPantallaCompleta = (block) => ({
  ...block,
  visible: true, x: 0, y: 0, w: 100, h: 100, z: 1, opacity: 1, radius: 0,
  bg:     { ...block.bg, mode: "none", image: null, opacity: 0 },
  border: { ...block.border, enabled: false },
  shadow: { ...block.shadow, enabled: false },
});

function ConfiguredBlock({ id, block, children, contentStyle }) {
  if (!block?.visible) return null;
  return (
    <div data-tv-live-block={id} style={{
      position: "absolute", left: `${block.x}%`, top: `${block.y}%`, width: `${block.w}%`, height: `${block.h}%`,
      zIndex: block.z, opacity: block.opacity, border: `${block.border.enabled ? block.border.width : 0}px solid ${block.border.color}`,
      borderRadius: block.radius, boxShadow: block.shadow.enabled ? shadow[block.shadow.strength] : "none",
      containerType: "size", fontFamily: fontFamily(block.font.family), textAlign: block.font.align, overflow: "hidden",
    }}>
      <span style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: "inherit",
        opacity: block.bg.opacity, backgroundColor: block.bg.mode === "color" ? block.bg.color : "transparent",
        backgroundImage: block.bg.mode === "image" && block.bg.image ? `url(${block.bg.image})` : "none",
        backgroundSize: id === "logo" || id.startsWith("custom-") ? "contain" : "cover", backgroundRepeat: "no-repeat", backgroundPosition: "center" }}/>
      <div style={{ position: "relative", width: "100%", height: "100%", ...contentStyle }}>{children}</div>
    </div>
  );
}

function EditableOverlayText({ block }) {
  if (!block.content?.text) return null;
  return <div style={{ bottom: block.content.textPosition === "bottom" ? "3cqh" : "auto", color: block.content.textColor, fontSize: `min(${block.content.textSize / 2}cqw,${block.content.textSize / 2}cqh)`, fontWeight: block.content.bold ? 800 : 400, left: "4cqw", position: "absolute", right: "4cqw", textAlign: "center", textShadow: "0 2px 6px #000", top: block.content.textPosition === "top" ? "3cqh" : "auto" }}>{block.content.text}</div>;
}

/**
 * `zIndex` sube la lluvia por encima de TODO durante una transición de modo de
 * Follow the Leader. La clase la deja en z 100, que alcanza para el cruce de
 * canciones del DJ pero no para tapar la imagen de overlay del diseñador ni un
 * bloque al que le hayan puesto un z alto a mano: por ahí se colaba el video.
 * Fuera de una transición de FTL no se pasa nada y el comportamiento de Trivia,
 * Duelo y Rey del Orto queda igual que siempre.
 */
function TvStatic({ phase, waiting, zIndex }) {
  if (phase === "idle" && !waiting) return null;
  return (
    <div className={`tv-static tv-static-${phase === "idle" ? "static" : phase}`} aria-hidden="true"
      style={zIndex ? { zIndex } : undefined}>
      <div className="tv-static-noise" />
      <div className="tv-static-scanlines" />
      <div className="tv-static-band" />
    </div>
  );
}

// ─── Vista principal ─────────────────────────────────────────────────────────
export default function PantallaTV() {
  const params = new URLSearchParams(window.location.search);
  const code   = (params.get("code") || "").trim().toUpperCase();
  const token  = params.get("key") || "";

  const [eventId,  setEventId]  = useState(null);
  const [authErr,  setAuthErr]  = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [canvasConfig, setCanvasConfig] = useState(() => loadTvConfig("default"));
  const [transicion, setTransicion] = useState(null);   // { destino, desde } — sólo visual
  const [modoPrevio, setModoPrevio] = useState("dj");   // para detectar el cambio de modo
  const { gameState, session } = useGameState();
  const screenAudioOn = gameState?.screen_audio_enabled ?? false;

  const { event, candidates, current, loading } =
    usePantallaEvent({ eventId, client: supabaseAnon });
  const sharesSession = !event?.session_id || event.session_id === session?.id;
  const activeGame = sharesSession ? gameState?.active_game : null;
  // El Duelo es un escenario, no un `active_game`, pero para la TV es lo mismo:
  // una capa en vivo que tapa el canvas del DJ y le baja el audio (el duelo
  // suena en vivo en el bar; el video del duelo va muteado a propósito).
  const activeEscenario = sharesSession ? gameState?.active_escenario : null;
  //
  // El DJ es la CAPA BASE de la TV: siempre montado, y visible siempre que no
  // haya exactamente uno de estos overlays con contenido real. Por eso cada
  // capa se decide por separado y `hasLiveLayer` se deriva de ellas, no al
  // revés: antes `hasLiveLayer` incluía el Duelo sin mirar si el Duelo iba a
  // renderizar algo. Con `active_escenario='duelo'` y cualquier `active_game`
  // que la TV no proyecta (suma, palabra), la capa se montaba vacía y su fondo
  // opaco tapaba el DJ — pantalla negra que ninguna acción del admin sacaba.
  const showRaffle = activeGame === "rey del orto";
  const showTrivia = activeGame === "trivia";
  // El Duelo cede ante un juego activo: el last-write-wins del admin ya los
  // hace excluyentes, pero si coexistieran gana el juego.
  const showDuelo  = activeEscenario === "duelo" && !activeGame;
  // Follow the Leader NO es una capa opaca: el contenido del juego ES el video
  // que se está reproduciendo como fuente temporal sobre los players del DJ
  // (la canción del evento queda congelada). El overlay va aparte, encima de
  // los players, con el avatar del líder. Por eso no entra en `hasLiveLayer`:
  // ese contenedor pinta un fondo opaco que taparía justo lo que hay que ver.
  //
  // Se muestra desde que se abre la convocatoria: sin líder es un cartelito
  // de "anotate", y con líder pasa a avatar + porcentajes. En los dos casos el
  // video del DJ sigue a la vista debajo.
  // Follow the Leader tiene tres estados y cada uno pinta algo distinto:
  //   A/C · convocatoria (sin participante) → pantalla propia del juego, que
  //         tapa al DJ. Es también el estado al que se vuelve entre turnos.
  //   B   · performance (con participante)  → el video del DJ a pantalla
  //         completa y encima el avatar con los porcentajes.
  // En los dos casos la interfaz del DJ se apaga: su canción, sus próximas y
  // su QR musical no pertenecen a este juego.
  const showFtl = activeEscenario === "ftl" && !activeGame;
  const participanteFtl = showFtl ? gameState?.escenario_participant || null : null;
  // Modo visual de la TV. PREPARADO no es EN VIVO: el admin llama al
  // participante, la TV lo muestra listo, y recién con "▶ Comenzar" arranca el
  // video. Los cuatro modos son excluyentes y salen todos de la base, así que
  // un F5 reconstruye el mismo.
  const modoFtl = !showFtl ? "dj"
    : participanteFtl?.playing ? "performance"
    : participanteFtl ? "candidato"
    : "convocatoria";
  const ftlPerformance  = modoFtl === "performance";
  const ftlCandidato    = modoFtl === "candidato";
  const ftlConvocatoria = modoFtl === "convocatoria";
  // `soloTotales`: /tv entra por token, sin sesión de auth. Lee los totales
  // públicos con el cliente anónimo y nunca toca follow_leader_votes.
  const { totals: votosFtl } = useFollowLeaderVotes(
    participanteFtl?.turn_id || null, null, { soloTotales: true });

  // Con FTL en el aire la TV deja de ser la pantalla del DJ: se reusa su MOTOR
  // (players, audio, recortes, avance) pero se apaga toda su INTERFAZ — título,
  // portada, QR musical, próximas, header, logo, reacciones.
  const soloVideoFtl = showFtl;
  const hasLiveLayer = showRaffle || showTrivia || showDuelo;
  // Mutear el DJ es una decisión aparte de montar un overlay. En FTL la música
  // del DJ ES el juego: el líder baila y el bar lo sigue. Si entrara en el
  // muteo, lanzar el juego apagaba la única salida de audio del bar.
  const muteDj = hasLiveLayer;
  // Placas de anuncio (el "📢 Anunciar" del admin escribe active_placa).
  // No entra en hasLiveLayer a propósito — el muteo del DJ no cambia por una
  // placa, solo por un juego en vivo.
  //
  // Exclusiones: `escenario_karaoke` no es proyectable (igual que en
  // /pantalla), y `logo`/`logo_animado` son el REPOSO del admin y suelen
  // quedar seteadas casi siempre. En /pantalla eso es inofensivo porque el
  // video las tapa, pero acá el reposo es el canvas del DJ: si no se
  // excluyeran, la TV quedaría permanentemente cubierta por el logo.
  // ── Reproducción temporal de Follow the Leader ──────────────────────────
  // La canción del participante NO es la canción del evento: `current_item_id`
  // sigue siendo la del DJ, congelada, y vuelve intacta al terminar. Lo único
  // que cambia es qué se le da de comer a los players A/B — el mismo motor, sin
  // un segundo reproductor y sin tocar la cola, el ranking ni el historial.
  //
  // El item sintético lleva el prefijo 'ftl:' en el id justamente para que no
  // pueda confundirse con una fila real de pantalla_playlist_items.
  const videoFtl = ftlPerformance ? gameState?.escenario_video : null;
  const itemFtl = videoFtl?.ytId ? {
    id:                 `ftl:${participanteFtl?.turn_id || videoFtl.ytId}`,
    youtube_id:         videoFtl.ytId,
    title:              videoFtl.ytTitle || "Follow the Leader",
    trim_start_seconds: Number(videoFtl.trimStart) || 0,
    trim_end_seconds:   videoFtl.trimEnd ?? null,
    youtube_volume:     100,
  } : null;

  // Lo que suena. Al soltar el escenario vuelve a ser `current` y el motor hace
  // su transición de siempre.
  const fuente = itemFtl || current;

  // ── Lluvia de cambio de modo ────────────────────────────────────────────
  // El motor sólo llueve cuando cambia la CANCIÓN. Los cambios de MODO que no
  // tocan la fuente (entrar a la convocatoria, volver a ella) no dispararían
  // nada y se vería el corte seco. Este estado es puramente visual — no se
  // persiste — y además dice hacia dónde vamos, que es lo que decide cuándo
  // levantarla.
  //
  // Convocatoria y candidato son las dos pantallas estáticas del juego: pasar
  // de una a la otra no lleva lluvia, es el mismo modo visual con más datos.
  // La lluvia tiene que entrar EN EL MISMO commit que el cambio de modo.
  //
  // Con la detección en un useEffect, React pintaba primero el modo nuevo —sin
  // la pantalla del juego, que ya se había desmontado— y recién en el commit
  // siguiente aparecía la lluvia. Ese hueco de un frame es el que dejaba ver el
  // video del DJ entre el candidato y la performance, y entre la convocatoria y
  // la vuelta al DJ.
  //
  // Actualizar estado durante el render del propio componente es el patrón que
  // React documenta para derivar estado de props: re-renderiza antes de pintar,
  // así que la lluvia y el modo nuevo llegan juntos a la pantalla. Va guardado
  // por la comparación, que es lo que evita el bucle.
  // El modo anterior va en ESTADO, no en un ref: la app corre bajo StrictMode y
  // el doble render de desarrollo haría que una mutación de ref se aplicara en
  // la pasada que React descarta, perdiendo transiciones. Comparar contra
  // estado es el patrón que React documenta para esto y es idempotente.
  if (modoPrevio !== modoFtl) {
    setModoPrevio(modoFtl);
    // Convocatoria y candidato son la misma pantalla con más datos: entre ellas
    // no hay nada que tapar.
    const ESTATICOS = new Set(["convocatoria", "candidato"]);
    if (!(ESTATICOS.has(modoPrevio) && ESTATICOS.has(modoFtl))) {
      setTransicion({ destino: modoFtl, desde: Date.now() });
    }
  }

  const enTransicion = !!transicion;

  // Se corta la fuente mientras la TV no está mostrando un video:
  //   * convocatoria y candidato → el DJ queda pausado en su canción; no tiene
  //     sentido que suene música debajo de un QR.
  //   * saliendo hacia el DJ → la performance tiene que callarse YA, no seguir
  //     sonando detrás de la lluvia hasta que el motor termine el cruce. El
  //     tema nuevo arranca cuando se levanta la lluvia.
  // Durante CUALQUIER transición la fuente vieja se calla: el DJ no puede
  // volver a sonar detrás de la lluvia mientras se prepara la performance, ni
  // la performance seguir sonando mientras se prepara la salida. El destino
  // arranca cuando se levanta la lluvia.
  const cortarFuente = ftlConvocatoria || ftlCandidato || enTransicion;
  const reproduciendo = cortarFuente ? false : event?.is_playing !== false;

  const PLACAS_NO_TV = ["escenario_karaoke", "logo", "logo_animado"];
  const activePlaca = sharesSession ? gameState?.active_placa : null;
  const hasPlaca = !!activePlaca && !PLACAS_NO_TV.includes(activePlaca);
  const { playerIds, visiblePlayer, rainPhase, displayedId, playerError, readyCount } =
    useContinuousTvPlayers({ current: fuente, eventId, token, unlocked,
      muted: !screenAudioOn || muteDj,
      playing: reproduciendo,
      // La performance no es la canción del evento: si la TV pidiera avanzar
      // al terminarla, el servidor archivaría la canción del DJ que está
      // congelada detrás.
      autoAdvance: !itemFtl,
      captionsEnabled: event?.youtube_captions_enabled === true,
      rainAnticipationSeconds: event?.rain_anticipation_seconds ?? 6,
      rainTailSeconds: event?.rain_tail_seconds ?? 0 });

  // Cuándo se levanta la lluvia. Hacia una pantalla estática alcanza un mínimo:
  // ya está lista. Hacia un video (performance o vuelta al DJ) se espera a que
  // el motor termine su propio cruce — `rainPhase` vuelve a 'idle' recién
  // cuando el video nuevo ya está sonando. El tope es el seguro: si el motor se
  // cuelga, la TV no se queda con la lluvia puesta para siempre.
  //
  // Va DESPUÉS de useContinuousTvPlayers a propósito: lee `rainPhase`, que ese
  // hook declara con const. Arriba caía en la zona muerta temporal y /tv no
  // llegaba a renderizar.
  // Hacia una pantalla estática alcanza un mínimo: ya está lista.
  //
  // Hacia un video se espera la señal REAL del motor: `displayedId` es el item
  // que los players tienen puesto, no el que pidió el servidor. Que el RPC de
  // avance haya vuelto no significa que YouTube ya esté mostrando la canción
  // nueva; por eso la lluvia se levanta contra `displayedId === fuente.id` y no
  // contra un timeout ciego. Se acepta `leaving` porque en esa fase el motor ya
  // hizo el swap y el video nuevo está sonando: es su propia salida en fundido.
  //
  // TOPE es el seguro, no el camino normal: si YouTube no carga (video privado,
  // API caída), la TV no se queda tapada para siempre. 9 s es holgado contra los
  // 12 s de LOAD_TIMEOUT_MS del motor, así que la lluvia se va antes de que el
  // propio motor declare el fallo y muestre su cartel.
  useEffect(() => {
    if (!transicion) return;
    const esperaMotor = transicion.destino === "performance" || transicion.destino === "dj";
    const MIN = esperaMotor ? 900 : 800;
    const TOPE = 9000;
    const id = setInterval(() => {
      const dt = Date.now() - transicion.desde;
      if (dt < MIN) return;
      if (dt >= TOPE) { setTransicion(null); return; }
      if (!esperaMotor) { setTransicion(null); return; }
      const destinoListo = fuente ? displayedId === fuente.id : true;
      if (destinoListo && (rainPhase === "leaving" || rainPhase === "idle")) setTransicion(null);
    }, 120);
    return () => clearInterval(id);
  }, [transicion, rainPhase, displayedId, fuente]);

  // 1. Validar el acceso contra el servidor.
  useEffect(() => {
    if (!code || !token) { setAuthErr("Falta el código o la clave de acceso."); return; }
    resolveTv(code, token)
      .then((res) => {
        console.info("[TV] acceso resuelto", { eventId: res.event_id, code });
        setEventId(res.event_id);
      })
      .catch((err) => setAuthErr(err.message));
  }, [code, token]);

  useEffect(() => {
    const refreshCanvas = (event) => {
      if (!event || event.key === "bizarr-tv-canvas-config:default") setCanvasConfig(loadTvConfig("default"));
    };
    window.addEventListener("storage", refreshCanvas);
    window.addEventListener("bizarr-tv-config-saved", refreshCanvas);
    return () => {
      window.removeEventListener("storage", refreshCanvas);
      window.removeEventListener("bizarr-tv-config-saved", refreshCanvas);
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=Space+Grotesk:wght@400;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:${C.bg};color:${C.white};font-family:'Space Grotesk',sans-serif;overflow:hidden}
    #${playerIds[0]},#${playerIds[1]}{display:block!important;position:absolute!important;inset:0!important;width:100%!important;height:100%!important;border:0!important;pointer-events:none!important}
    .tv-player-layer{position:absolute;inset:0;background:#000;transition:opacity .35s ease;pointer-events:none}
    .tv-static{position:fixed;inset:0;z-index:100;overflow:hidden;background:#111;opacity:1;transition:opacity .7s ease;pointer-events:none}
    .tv-static-entering{animation:tvStaticEnter .45s ease both}
    .tv-static-leaving{opacity:0}
    .tv-static-noise{position:absolute;inset:-35%;background-image:repeating-radial-gradient(circle at 17% 29%,#fff 0 1px,#111 1px 3px,#888 3px 4px,#000 4px 7px);background-size:9px 7px;filter:contrast(190%);opacity:.72;animation:tvNoise .16s steps(2,end) infinite}
    .tv-static-scanlines{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.68) 0 2px,rgba(255,255,255,.12) 2px 4px,transparent 4px 7px);mix-blend-mode:hard-light;animation:tvScan .55s linear infinite}
    .tv-static-band{position:absolute;left:-10%;right:-10%;height:18%;background:linear-gradient(180deg,transparent,rgba(255,255,255,.32),rgba(0,0,0,.75),transparent);filter:blur(2px);animation:tvBand 1.35s steps(6,end) infinite}
    .tv-static-brand{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;text-shadow:3px 0 #00e5ff,-3px 0 #ff2d78,0 3px 12px #000;animation:tvGlitch 1.1s steps(2,end) infinite}
    .tv-static-brand strong{font-family:'Syne',sans-serif;font-size:clamp(34px,7vw,92px);font-weight:900;letter-spacing:.12em;color:rgba(255,255,255,.86)}
    .tv-static-brand em{margin-top:10px;font-family:'Syne',sans-serif;font-size:clamp(15px,2.4vw,30px);font-style:normal;font-weight:800;letter-spacing:.12em;color:rgba(255,214,0,.82)}
    .tv-static-brand span{margin-top:14px;font-size:clamp(11px,1.5vw,18px);font-weight:700;letter-spacing:.28em;color:rgba(255,255,255,.64)}
    @keyframes tvStaticEnter{from{opacity:0}to{opacity:1}}
    @keyframes tvNoise{0%{transform:translate3d(-3%,2%,0) scale(1.03)}25%{transform:translate3d(4%,-3%,0) scale(1.08)}50%{transform:translate3d(-1%,5%,0) scale(1.05)}75%{transform:translate3d(3%,1%,0) scale(1.1)}100%{transform:translate3d(-4%,-2%,0) scale(1.04)}}
    @keyframes tvScan{to{background-position:0 28px}}
    @keyframes tvBand{0%{top:-25%}100%{top:115%}}
    @keyframes tvGlitch{0%,88%,100%{transform:translate(0);filter:none}90%{transform:translate(-5px,2px);filter:brightness(1.5)}94%{transform:translate(6px,-2px)}97%{transform:translate(-2px,1px)}}
    @keyframes tvFloat{
      0%{transform:translateY(0) scale(.6);opacity:0}
      12%{opacity:1;transform:translateY(-40px) scale(1)}
      100%{transform:translateY(-88vh) scale(1.15);opacity:0}
    }
  `;

  if (authErr) return (
    <>
      <style>{css}</style>
      <div style={pantallaCentro}>
        <div style={{ fontSize: 54, marginBottom: 18 }}>🔒</div>
        <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 24, marginBottom: 10 }}>
          Acceso de TV inválido
        </div>
        <div style={{ fontSize: 14, color: "rgba(240,232,255,.45)", maxWidth: 460, lineHeight: 1.6 }}>
          {authErr} Generá el link desde <strong>Admin › Pantalla/Escenario › DJ</strong>.
        </div>
      </div>
    </>
  );

  if (!eventId || loading) return (
    <>
      <style>{css}</style>
      <div style={pantallaCentro}>
        <div style={{ fontSize: 46, marginBottom: 14, opacity: .5 }}>🎵</div>
        <div style={{ fontSize: 15, color: "rgba(240,232,255,.4)" }}>Conectando con el evento…</div>
      </div>
    </>
  );

  if (!unlocked) return (
    <>
      <style>{css}</style>
      <div style={pantallaCentro}>
        <div style={{
          fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 13,
          letterSpacing: "3px", color: C.cyan, marginBottom: 16,
        }}>MODO TV · MOTOR DE REPRODUCCIÓN</div>
        <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 30, marginBottom: 12 }}>
          {event?.name || "Pantalla Bizarren"}
        </div>
        <button onClick={() => setUnlocked(true)} style={{
          padding: "16px 34px", borderRadius: 14, border: "none", cursor: "pointer",
          fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 17, color: C.bg,
          background: `linear-gradient(135deg, ${C.gold}, #FF9500)`,
          boxShadow: "0 8px 34px rgba(255,214,0,.35)",
        }}>▶ Iniciar video del TV</button>
        <div style={{
          fontSize: 13, color: "rgba(240,232,255,.4)", marginTop: 18,
          maxWidth: 460, lineHeight: 1.6,
        }}>
          Esta pantalla es la única salida de audio. Tocá una vez para desbloquear —
          después las canciones se encadenan solas.
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{css}</style>
      <div data-tv-live-stage style={{
        position: "relative", height: "100vh", width: "100vw", overflow: "hidden",
        backgroundColor: canvasConfig.screen.backgroundMode === "color" ? canvasConfig.screen.backgroundColor : C.bg,
        backgroundImage: canvasConfig.screen.backgroundMode === "image" && canvasConfig.screen.backgroundImage ? `url(${canvasConfig.screen.backgroundImage})` : "none",
        backgroundSize: "cover", backgroundPosition: "center",
      }}>
        <ConfiguredBlock id="video"
          block={soloVideoFtl ? aPantallaCompleta(canvasConfig.blocks.video) : canvasConfig.blocks.video}>
          {/* Players A/B permanentes: el standby nunca usa display:none. */}
          {playerIds.map((playerId, index) => (
            <div key={playerId} className="tv-player-layer" style={{
              opacity: visiblePlayer === index ? 1 : 0,
              zIndex: visiblePlayer === index ? 2 : 1,
            }}>
              <div id={playerId} />
            </div>
          ))}

          {!fuente && !soloVideoFtl && (
            <div style={{ ...pantallaCentro, position: "absolute", inset: 0, zIndex: 5 }}>
              <div style={{ fontSize: 52, marginBottom: 14, opacity: .35 }}>🎧</div>
              <div style={{ fontSize: 17, color: "rgba(240,232,255,.4)" }}>
                Esperando la próxima canción…
              </div>
            </div>
          )}

          {playerError && (
            <div style={{
              ...pantallaCentro, position: "absolute", inset: 0, zIndex: 10,
              background: "rgba(8,4,15,.94)",
            }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>⚠️</div>
              <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 24, marginBottom: 10 }}>
                Este video no puede reproducirse en pantalla.
              </div>
              <div style={{ fontSize: 14, color: "rgba(240,232,255,.55)", maxWidth: 560, lineHeight: 1.6 }}>
                {playerError.message} Pedile al DJ que avance al siguiente tema.
              </div>
              <div style={{ fontSize: 11, color: "rgba(240,232,255,.28)", marginTop: 12 }}>
                Código técnico de YouTube: {playerError.code}
              </div>
            </div>
          )}
        </ConfiguredBlock>

        {!soloVideoFtl && <>
        <ConfiguredBlock id="logo" block={canvasConfig.blocks.logo}>
          <EditableOverlayText block={canvasConfig.blocks.logo}/>
        </ConfiguredBlock>

        <ConfiguredBlock id="qr" block={canvasConfig.blocks.qr} contentStyle={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "3cqh 3cqw" }}>
          <QrPanel code={event?.code || code} block={canvasConfig.blocks.qr}/>
        </ConfiguredBlock>

        <ConfiguredBlock id="upcoming" block={canvasConfig.blocks.upcoming} contentStyle={{ padding: "4cqh 4cqw" }}>
          <UpcomingPanel candidates={candidates}/>
        </ConfiguredBlock>

        <ConfiguredBlock id="header" block={canvasConfig.blocks.header} contentStyle={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2cqh 2cqw" }}>
          <span style={{ fontSize: "min(7cqw,20cqh)", fontWeight: canvasConfig.blocks.header.font.titleWeight, color: canvasConfig.blocks.header.font.titleColor || C.white }}>
            {event?.name || "Pantalla Bizarren"} · {event?.code || code}
          </span>
        </ConfiguredBlock>

        {current && <ConfiguredBlock id="nowPlaying" block={canvasConfig.blocks.nowPlaying} contentStyle={{ display: "flex", alignItems: "center", gap: "2cqw", padding: "2cqh 2cqw" }}>
              {(current.cover_url || current.youtube_id) && (
                <img
                  src={current.cover_url || ytThumb(current.youtube_id)}
                  alt=""
                  style={{ aspectRatio: 1, height: "78%", borderRadius: "2cqw", objectFit: "cover", flexShrink: 0 }}
                />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontWeight: canvasConfig.blocks.nowPlaying.font.titleWeight, fontSize: canvasConfig.blocks.nowPlaying.font.titleSize || "min(8cqw,28cqh)", color: canvasConfig.blocks.nowPlaying.font.titleColor || C.gold,
                  lineHeight: 1.1, textShadow: "0 2px 14px #000",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{current.title}</div>
                {current.artist && (
                  <div style={{ fontSize: canvasConfig.blocks.nowPlaying.font.artistSize || "min(5cqw,18cqh)", color: canvasConfig.blocks.nowPlaying.font.artistColor || "rgba(240,232,255,.6)", marginTop: "1cqh" }}>
                    {current.artist}
                  </div>
                )}
              </div>
        </ConfiguredBlock>}

        {Object.entries(canvasConfig.customBlocks || {}).map(([id, block]) => <ConfiguredBlock key={id} id={id} block={block}>
          <span role="img" aria-label={block.title} style={{ position: "absolute", inset: 0 }}/><EditableOverlayText block={block}/>
        </ConfiguredBlock>)}
        </>}

        {!soloVideoFtl && !enTransicion && canvasConfig.screen.overlay.enabled && canvasConfig.screen.overlay.url && <img src={canvasConfig.screen.overlay.url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: canvasConfig.screen.overlay.opacity, pointerEvents: "none", zIndex: 2147483647 }}/>}

        {/* Placa de anuncio. Reusa el PlacaScreen de /pantalla — mismo catálogo,
            mismos assets de /placas — en vez de duplicar el diseño. Va debajo
            del juego en vivo y con el guard explícito por si alguna vez
            coexistieran active_placa y active_game. Los reproductores del DJ
            quedan montados detrás, igual que con la capa de juego. */}
        {hasPlaca && !hasLiveLayer && (
          <div data-tv-placa style={{
            position: "absolute", inset: 0, zIndex: 2147483647,
            background: C.bg, overflow: "hidden",
          }}>
            <style>{BIGSCREEN_CSS}</style>
            <PlacaScreen logo="/logo.png" gameState={gameState}/>
          </div>
        )}

        {hasLiveLayer && (
          <div data-tv-live-game style={{
            position: "absolute", inset: 0, zIndex: 2147483647,
            background: C.bg, overflow: "hidden",
          }}>
            <style>{BIGSCREEN_CSS}</style>
            {showRaffle && <RaffleScreen gameState={gameState}/>}
            {showTrivia && <TriviaScreen gameState={gameState} sessionId={session?.id}/>}
            {showDuelo && (
              <DueloBigscreen gameState={gameState} sessionId={session?.id ?? null}
                webappUrl={window.location.origin}/>
            )}
          </div>
        )}

        {/* Follow the Leader: sólo el avatar y (cuando exista el backend de
            votación) los porcentajes. Transparente y sin reproductor propio —
            el video de abajo es el del DJ, con su recorte de inicio/fin. */}
        {(ftlConvocatoria || ftlCandidato) && !hasLiveLayer && !hasPlaca && (
          <FtlStandby webappUrl={window.location.origin}
            participante={ftlCandidato ? participanteFtl : null}/>
        )}

        {ftlPerformance && !hasLiveLayer && !hasPlaca && (
          <FtlOverlay participante={participanteFtl} votos={votosFtl}/>
        )}
      </div>

      {/* La lluvia SÍ va durante FTL: es la transición del motor y es lo que
          se ve al cortar la canción del participante para volver al DJ. Fuera
          de una transición no dibuja nada (phase 'idle' y sin espera), así que
          no puede taparle la performance a nadie.
          Las reacciones flotantes, en cambio, son del público del DJ. */}
      {/* La lluvia cubre la espera, no sólo la anima: mientras esté puesta, el
          destino se prepara detrás. Va por encima de las pantallas de FTL
          (z 50) para que el cambio de modo no se vea a medio armar. */}
      <TvStatic phase={enTransicion && rainPhase === "idle" ? "static" : rainPhase}
        waiting={enTransicion || (!soloVideoFtl && (!fuente || readyCount < 2))}
        zIndex={enTransicion ? 2147483647 : undefined}/>

      {!soloVideoFtl && <Reacciones eventId={eventId} size={canvasConfig.screen.reactionEmojiSize}/>}
    </>
  );
}

const pantallaCentro = {
  height: "100vh", width: "100vw", display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center", textAlign: "center",
  background: C.bg, padding: 24,
};
