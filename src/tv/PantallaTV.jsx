import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { supabaseAnon } from "../lib/supabase";
import { usePantallaEvent } from "../hooks/realtime/usePantallaEvent";
import { useGameState } from "../hooks/realtime/useGameState";
import { BIGSCREEN_CSS, PlacaScreen, RaffleScreen, TriviaScreen, SumaScreen, PalabraScreen } from "../bigscreen/BizarrApp PantallaGigante Festival";
import DueloBigscreen from "../bigscreen/DueloBigscreen";
import FtlOverlay from "./FtlOverlay";
import FtlStandby from "./FtlStandby";
import { QrDeJuego } from "../components/QrDeJuego";
import TomatazoOverlay from "./TomatazoOverlay";
import KickDualOverlay from "./KickDualOverlay";
import { useFtlEnergia, useFtlPelea } from "../hooks/realtime/useFtlEnergia";
import { useFollowLeaderVotes } from "../hooks/realtime/useFollowLeaderVotes";
import { useVotacionEscenario } from "../hooks/useVotacionEscenario";
import { useEscenarioListo } from "../hooks/useEscenarioListo";
import { resolveTv, guestUrl, ytThumb, tvEscenarioVideoTerminado, telepronterReport, tvLatido } from "../services/pantallaDj";
import { useContinuousTvPlayers, TRANSICION_APAGADA } from "./useContinuousTvPlayers";
import { useTandasTv } from "./useTandasTv";
import { marcaDelEvento, colorConMarca } from "../constants/marcaEvento";
import { loadTvConfig, normalizeTvConfig } from "../designers/lib/persistence";
import { DEFAULT_TV_CONFIG } from "../designers/defaults";
import { ESCENARIO_JUEGOS } from "../constants/escenarioJuegos";
import LienzoPantalla from "../lienzo/LienzoPantalla";
import { useLienzo } from "../lienzo/useLienzo";
import { AREAS_DJ } from "../lienzo/datosDj";
import { ANCHO, ALTO } from "../lienzo/modelo";
import { marcadorEquipos } from "../services/pantallaConfig";
import { esKickDual } from "../constants/kickModos";

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
 *
 * Con `modo="telepronter"` (/telepronter, mismo link) es la Pantalla
 * Telepronter: la misma imagen para el participante en el escenario, pero
 * como ESPEJO — muda, sin reportar progreso y sin avanzar la cola ni cerrar
 * turnos de Escenario. Sigue a /tv por Realtime. El Admin la puede invertir
 * horizontalmente (`pantalla_events.telepronter_espejo`).
 */

/** Cada cuánto la TV y la Telepronter avisan que están abiertas (el Admin las da por vivas 20 s). */
const LATIDO_MS = 8_000;

const C = {
  bg: "#08040F", gold: "#FFD600", cyan: "#00E5FF",
  pink: "#FF2D78", green: "#00F5A0", white: "#F0E8FF",
};

// ─── Reacciones flotantes ────────────────────────────────────────────────────
/**
 * Diseño guardado en la base → config completa. Una config vieja o parcial
 * puede no traer algún bloque o campo de pantalla: se completa con los valores
 * por defecto para que la TV nunca lea algo indefinido.
 */
function completarConfigTv(remoto) {
  const base = DEFAULT_TV_CONFIG;
  return normalizeTvConfig({
    ...base, ...remoto,
    screen: { ...base.screen, ...remoto.screen,
      overlay: { ...base.screen.overlay, ...remoto.screen?.overlay } },
    blocks: Object.fromEntries(Object.keys({ ...base.blocks, ...remoto.blocks }).map((id) =>
      [id, { ...base.blocks[id], ...remoto.blocks?.[id] }])),
  });
}

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
// El logo que el bloque «Logo» del Diseñador trae por defecto.
const LOGO_POR_DEFECTO = "/logo.png";

// Los colores del QR que el Diseñador trae por defecto: si no se tocaron,
// manda el acento de la personalización del evento.
const QR_COLOR_POR_DEFECTO = "#FFD600";

function QrPanel({ code, block, marca }) {
  const content = block.content || {};
  const acentoQr = (v) => colorConMarca(v, QR_COLOR_POR_DEFECTO, marca.acento) || C.gold;
  const align = block.font?.align || "center";
  const label = <div style={{
    fontFamily: fontFamily(content.labelFont), fontWeight: content.bold ? 900 : 400,
    fontSize: content.labelSize ? `${content.labelSize}px` : "min(8cqw,12cqh)",
    letterSpacing: ".08em", color: acentoQr(content.labelColor || content.textColor),
  }}>{content.text}</div>;
  return (
      <div style={{ alignItems: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center", display: "flex", flexDirection: "column", gap: "3cqh", height: "100%", justifyContent: "center", textAlign: align, width: "100%" }}>
        {content.textPosition !== "bottom" && label}
        <div style={{ background: "#fff", padding: "2cqw", borderRadius: "3cqw", display: "flex", maxHeight: "62cqh", maxWidth: "78cqw" }}>
          <QRCode value={guestUrl(code)} style={{ height: "100%", width: "100%" }} />
        </div>
        {content.showSubtitle && <span style={{ color: acentoQr(content.labelColor), fontFamily: fontFamily(content.labelFont), fontSize: `max(8px,${Number(content.labelSize || 18) * .72}px)` }}>{content.subtitle || "Entrá y votá…"}</span>}
        {content.showCode && <b style={{ color: acentoQr(content.codeColor), fontFamily: fontFamily(content.codeFont), fontSize: content.codeSize ? `${content.codeSize}px` : "min(11cqw,18cqh)" }}>{code}</b>}
        {content.textPosition === "bottom" && label}
      </div>
  );
}

function UpcomingPanel({ candidates, marca }) {
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
                color: i === 0 ? (marca.acento || C.gold) : "rgba(240,232,255,.28)",
              }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: "min(6cqw,9cqh)", fontWeight: 700, color: marca.texto || C.white,
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

/**
 * Diseñador → DJ Democracy (editor libre, fila `lienzo_dj`) → las capas de la
 * TV. Los reproductores no pueden entrar al lienzo: desmontarlos corta la
 * música. Por eso el elemento «Video del DJ» sólo da la caja (en % de la
 * pantalla) del bloque de video de siempre, y el resto se parte en lo que va
 * DEBAJO del video (con el fondo) y lo que va ENCIMA. Las áreas (contador de
 * Sacar tema, transición) tampoco se dibujan: dan la caja de sus overlays.
 *
 * El lienzo se estira para llenar la ventana (`llenar`), igual que una TV
 * 16:9 aunque la ventana de Chrome no lo sea: las cajas van en % de la ventana.
 */
// El cierre de la votación cae justo al final de la canción, cuando entra el GIF
// de la transición (que tapa todo): este aviso va en una capa por encima.
const SOBRE_LA_TRANSICION = new Set(["djVotacionCerrada"]);

const enPorcentaje = (el) => ({ x: (el.x / ANCHO) * 100, y: (el.y / ALTO) * 100, w: (el.w / ANCHO) * 100, h: (el.h / ALTO) * 100 });

function capasDelLienzoDj(pantalla, bloqueVideo, marca) {
  const els = pantalla.elementos;
  const iv = els.findIndex((e) => e.tipo === "dato" && e.dato === "djVideo");
  const area = (dato) => {
    const el = els.find((e) => e.tipo === "dato" && e.dato === dato && e.visible);
    return el ? enPorcentaje(el) : null;
  };
  // El logo de fábrica cede ante el del evento (Personalización visual).
  const dibujables = (lista) => lista
    .filter((e) => !(e.tipo === "dato" && AREAS_DJ.has(e.dato)))
    .map((e) => (e.tipo === "imagen" && e.src === LOGO_POR_DEFECTO && marca.logo ? { ...e, src: marca.logo } : e));
  // Sin fondo elegido, el de la personalización del evento.
  const fondo = pantalla.fondo.tipo !== "ninguno" ? pantalla.fondo
    : marca.fondoImagen ? { ...pantalla.fondo, tipo: "imagen", imagen: marca.fondoImagen, ajuste: "cover" }
    : { ...pantalla.fondo, tipo: "color", color: marca.fondo || C.bg };
  const video = iv >= 0 ? els[iv] : null;
  return {
    debajo: { fondo, elementos: dibujables(iv >= 0 ? els.slice(0, iv) : []) },
    encima: { fondo, elementos: dibujables(iv >= 0 ? els.slice(iv + 1) : els).filter((e) => !(e.tipo === "dato" && SOBRE_LA_TRANSICION.has(e.dato))) },
    // Lo que tiene que verse aunque esté pasando la transición (va arriba de todo).
    arriba: { fondo, elementos: dibujables(els).filter((e) => e.tipo === "dato" && SOBRE_LA_TRANSICION.has(e.dato)) },
    // Oculto en el editor = invisible, pero montado: sigue siendo la salida de audio.
    video: video ? {
      ...bloqueVideo, ...enPorcentaje(video), visible: true, z: 1, radius: 0,
      opacity: video.visible ? video.opacidad : 0,
      bg: { ...bloqueVideo.bg, mode: "none", image: null, opacity: 0 },
      border: { ...bloqueVideo.border, enabled: false }, shadow: { ...bloqueVideo.shadow, enabled: false },
    } : bloqueVideo,
    contador: area("djContador"),
    transicion: area("djTransicion"),
  };
}

/**
 * Marcador de Team Batata y Team Membrillo para el «Marcador de equipos»
 * (pantalla_team_scores, lectura pública; lo suma el motor de la base). Sólo
 * con equipos activados; se relee cada 10 s.
 */
const EQUIPOS_CADA_MS = 10_000;
function useEquiposTv(eventId, activo) {
  const [equipos, setEquipos] = useState([]);
  useEffect(() => {
    if (!eventId || !activo) { setEquipos([]); return undefined; }
    let vivo = true;
    const leer = () => supabaseAnon.from("pantalla_team_scores").select("team, points").eq("event_id", eventId)
      .then(({ data, error }) => {
        if (error) { console.warn("[PantallaTV] equipos:", error.message); return; }
        if (vivo) setEquipos(marcadorEquipos(data || []));
      });
    leer();
    const id = setInterval(leer, EQUIPOS_CADA_MS);
    return () => { vivo = false; clearInterval(id); };
  }, [eventId, activo]);
  return equipos;
}

/**
 * Votos para sacar el tema y cuántos hacen falta (Clásico y Tomatazo), para el
 * «Contador Sacar tema». Relee al llegar un voto (`clave` cambia con
 * kick_votes_current y la canción) y cada 5 s, porque «necesarios» depende de
 * cuánta gente hay conectada.
 */
const KICK_CADA_MS = 5_000;
function useKickTv(eventId, clave) {
  const [kick, setKick] = useState(null);
  useEffect(() => {
    if (!eventId) { setKick(null); return undefined; }
    let vivo = true;
    const leer = () => supabaseAnon.rpc("pantalla_get_kick_status", { _event_id: eventId })
      .then(({ data, error }) => {
        if (error) { console.warn("[PantallaTV] Sacar tema:", error.message); return; }
        if (vivo) setKick(data || null);
      });
    leer();
    const id = setInterval(leer, KICK_CADA_MS);
    return () => { vivo = false; clearInterval(id); };
  }, [eventId, clave]);
  return kick;
}

/**
 * El GIF del premio «GIF a pantalla» que está al aire, o null
 * (pantalla_gif_en_pantalla: el último usado, mientras dure). Cada 3 s.
 */
const GIF_CADA_MS = 3_000;
function useGifPremioTv(eventId) {
  const [gif, setGif] = useState(null);
  useEffect(() => {
    if (!eventId) { setGif(null); return undefined; }
    let vivo = true;
    const leer = () => supabaseAnon.rpc("pantalla_gif_en_pantalla", { _event_id: eventId })
      .then(({ data, error }) => {
        if (error) { console.warn("[PantallaTV] GIF del premio:", error.message); return; }
        if (!vivo) return;
        setGif((prev) => (prev?.url === data?.url && prev?.hasta === data?.hasta ? prev : data || null));
      });
    leer();
    const id = setInterval(leer, GIF_CADA_MS);
    return () => { vivo = false; clearInterval(id); };
  }, [eventId]);
  return gif;
}

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
 * Transición entre canciones del DJ: el GIF que se elige en DJ Democracy →
 * Editor → «Transición entre canciones» (`transition_gif_url`). Sin audio: se
 * superpone sobre el área del video, aparece (fade in), se mantiene (hold) y se
 * desvanece (fade out). CUÁNDO pasa cada cosa lo decide el motor (`phase`).
 *
 * El área es la del bloque «Transición entre canciones» del Diseñador TV si
 * está visible; si no, la del video. Ningún juego la usa: con un juego en
 * pantalla no se dibuja y el motor hace cortes secos (ver `sinTransicion`).
 *
 * phase: 'idle' | 'entering' | 'static' | 'leaving'.
 */
function TvTransicion({ phase, gif, area, fadeInMs, fadeOutMs }) {
  if (!gif || phase === "idle") return null;
  const opacidad = phase === "entering" ? { animation: `tvTransIn ${fadeInMs}ms ease both` }
    : phase === "leaving" ? { opacity: 0, transition: `opacity ${fadeOutMs}ms ease` }
    : { opacity: 1 };
  return (
    <div aria-hidden="true" data-tv-transicion style={{
      position: "absolute", left: `${area.x}%`, top: `${area.y}%`, width: `${area.w}%`, height: `${area.h}%`,
      zIndex: 100, overflow: "hidden", pointerEvents: "none", borderRadius: area.radius ?? 0, ...opacidad,
    }}>
      <img src={gif} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}/>
    </div>
  );
}

/**
 * Tanda publicitaria en MP3 (ver useTandasTv): la reproduce un <audio>, con
 * su recorte y su volumen, sobre una pantalla con el logo y el título. Avisa
 * al terminar (o si el archivo no carga) para que arranque el tema siguiente.
 */
function TandaAudio({ tanda, logo, muted, onTerminar }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120, background: C.bg,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "3vh" }}>
      <img src={logo} alt="" style={{ maxWidth: "34vw", maxHeight: "34vh", objectFit: "contain" }}/>
      <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: "3vh", letterSpacing: ".18em",
        color: "rgba(240,232,255,.55)", textAlign: "center", maxWidth: "80vw" }}>📢 {tanda.titulo}</div>
      <audio src={tanda.url} autoPlay muted={muted}
        onLoadedMetadata={(e) => {
          e.currentTarget.volume = tanda.volumen;
          if (tanda.inicio) e.currentTarget.currentTime = tanda.inicio;
        }}
        onTimeUpdate={(e) => { if (tanda.fin && e.currentTarget.currentTime >= tanda.fin) onTerminar(); }}
        onEnded={onTerminar}
        onError={() => { console.error("[PantallaTV] la tanda en MP3 no se pudo reproducir"); onTerminar(); }}/>
    </div>
  );
}

// Placas de anuncio de los juegos (📢 Anunciar del Admin): con una puesta la
// TV ya está en el juego, y tampoco lleva transición.
const PLACAS_DE_JUEGO = ["game_rey", "game_trivia", "game_suma", "game_palabra",
  "duelo", "escenario", "escenario_ftl", "escenario_pt"];

// Segundos sin transición después de que el juego sale de la pantalla (ver
// `sinTransicion` en PantallaTV).
const GRACIA_SIN_TRANSICION_MS = 5000;

// Tiempos de la transición si el evento no tiene los suyos: los valores por
// defecto de las columnas de `pantalla_events`.
const FADE_IN_POR_DEFECTO  = 2;
const HOLD_POR_DEFECTO     = 1;
const FADE_OUT_POR_DEFECTO = 2;

/** Segundos guardados en el evento → ms. Vacío o inválido: `porDefecto`. */
const segundosAMs = (valor, porDefecto) => {
  const n = valor === null || valor === undefined || valor === "" ? NaN : Number(valor);
  return Math.round((Number.isFinite(n) && n >= 0 ? n : porDefecto) * 1000);
};

/** `activo`, y sigue en true `ms` después de que se apaga. */
function useSostenido(activo, ms) {
  const [sostenido, setSostenido] = useState(activo);
  useEffect(() => {
    if (activo) { setSostenido(true); return undefined; }
    const t = setTimeout(() => setSostenido(false), ms);
    return () => clearTimeout(t);
  }, [activo, ms]);
  return activo || sostenido;
}

// ─── Vista principal ─────────────────────────────────────────────────────────
export default function PantallaTV({ modo = "tv" }) {
  const telepronter = modo === "telepronter";
  const params = new URLSearchParams(window.location.search);
  const code   = (params.get("code") || "").trim().toUpperCase();
  const token  = params.get("key") || "";

  const [eventId,  setEventId]  = useState(null);
  const [authErr,  setAuthErr]  = useState(null);
  // La Telepronter va muda: el navegador deja arrancar el video sin el toque
  // de desbloqueo, así que entra directo.
  const [unlocked, setUnlocked] = useState(telepronter);
  // Respaldo local: sólo se usa si el evento todavía no tiene diseño guardado
  // en la base (el Diseñador TV sube el suyo al primer Guardar).
  const [canvasLocal, setCanvasConfig] = useState(() => loadTvConfig("default"));
  const { gameState, session } = useGameState();
  const screenAudioOn = gameState?.screen_audio_enabled ?? false;

  const { event, candidates, current, loading } =
    usePantallaEvent({ eventId, client: supabaseAnon });

  // El diseño de la TV es `pantalla_events.tv_canvas_config`: es lo que guarda
  // el Diseñador TV y lo que hace que se vea igual en cualquier máquina. Llega
  // con el evento y se actualiza solo por Realtime al guardar. Antes la TV leía
  // sólo el localStorage del navegador, así que en la PC del bar no se aplicaba.
  const canvasRemoto = event?.tv_canvas_config || null;
  const canvasConfig = useMemo(
    () => (canvasRemoto ? completarConfigTv(canvasRemoto) : canvasLocal),
    [canvasRemoto, canvasLocal]);
  // Personalización visual del evento (Editor → «Personalización visual»): la
  // base de los colores, el fondo y el logo donde el Diseñador no fijó otra cosa.
  const marca = useMemo(() => marcaDelEvento(event), [event]);
  // El logo del evento reemplaza al de BizarrApp que trae el bloque por defecto;
  // si en el Diseñador se eligió otra imagen, queda esa.
  // Diseño del editor libre (Diseñador → DJ Democracy). Sin él, el de arriba.
  const lienzoDj = useLienzo("dj").dj || null;
  const equiposDj = useEquiposTv(lienzoDj ? eventId : null, !!event?.teams_enabled);
  // Sólo se consulta si la pantalla editada tiene el GIF del premio a la vista.
  const conGifPremio = !!lienzoDj?.elementos.some((e) => e.tipo === "dato" && e.dato === "djGifPremio" && e.visible);
  const gifPremio = useGifPremioTv(conGifPremio ? eventId : null);
  // El contador sólo se consulta en Clásico / Tomatazo y si está a la vista.
  const kickPorcentaje = event?.kick_enabled === true && !esKickDual(event?.kick_style);
  const conContador = kickPorcentaje
    && !!lienzoDj?.elementos.some((e) => e.tipo === "dato" && e.dato === "djContador" && e.visible);
  const kickEstado = useKickTv(conContador ? eventId : null, `${event?.kick_votes_current}|${event?.current_item_id}`);
  // Cuándo llegó el último tiempo reportado (para adelantar la barra de progreso).
  const progresoAl = useMemo(() => Date.now(), [event?.tv_current_time]); // eslint-disable-line react-hooks/exhaustive-deps
  const capasDj = useMemo(() => (lienzoDj ? capasDelLienzoDj(lienzoDj, canvasConfig.blocks.video, marca) : null),
    [lienzoDj, canvasConfig.blocks.video, marca]);
  const bloqueVideo = capasDj ? capasDj.video : canvasConfig.blocks.video;
  const bloqueLogo = useMemo(() => {
    const b = canvasConfig.blocks.logo;
    return marca.logo && b?.bg?.image === LOGO_POR_DEFECTO ? { ...b, bg: { ...b.bg, image: marca.logo } } : b;
  }, [canvasConfig.blocks.logo, marca.logo]);

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
  const showSuma   = activeGame === "suma";
  const showPalabra = activeGame === "palabra";
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
  // FTL y Personal Trainer son el MISMO contrato de escenario: los dos
  // proyectan igual y sólo cambian su copy/imagen, que sale de ESCENARIO_JUEGOS.
  const juegoEsc = (activeEscenario && !activeGame) ? ESCENARIO_JUEGOS[activeEscenario] || null : null;
  const showFtl = !!juegoEsc;
  const participanteFtl = showFtl ? gameState?.escenario_participant || null : null;
  // Modo visual de la TV. PREPARADO no es EN VIVO: el admin llama al
  // participante, la TV lo muestra listo, y recién con "▶ Comenzar" arranca el
  // video. Los cuatro modos son excluyentes y salen todos de la base, así que
  // un F5 reconstruye el mismo.
  const modoFtl = !showFtl ? "dj"
    : participanteFtl?.playing ? "performance"
    : participanteFtl ? "candidato"
    : "convocatoria";
  const votacionCfg = useVotacionEscenario({ anonimo: true });
  // Pantalla «participante listo» (texto/imagen, efecto, y si se muestra o no).
  const listoCfg = useEscenarioListo();
  const ftlPerformance  = modoFtl === "performance";
  const ftlCandidato    = modoFtl === "candidato";
  const ftlConvocatoria = modoFtl === "convocatoria";
  // Modo de votación del juego (🗳️ del panel del juego en el Admin). La TV muestra
  // SIEMPRE el barómetro; el modo sólo cambia cómo vota la gente y de dónde
  // sale el %: 'toques' = energía, 'votos' = % de 👍, 'pelea' = posición de
  // la pelea 👍/👎, 'off' = sin barómetro. /tv entra por token, sin sesión:
  // todo con el cliente anónimo y sólo con el video sonando.
  const modoVotacion = (showFtl && votacionCfg[juegoEsc.type]) || "off";
  const turnoEnVivo = (participanteFtl?.playing && participanteFtl?.turn_id) || null;
  const energiaFtl = useFtlEnergia(modoVotacion === "toques" ? turnoEnVivo : null,
    { anonimo: true, cadaMs: 400 });
  const { totals: votosFtl } = useFollowLeaderVotes(
    modoVotacion === "votos" ? turnoEnVivo : null, null, { soloTotales: true });
  const peleaFtl = useFtlPelea(modoVotacion === "pelea" ? turnoEnVivo : null,
    { anonimo: true, cadaMs: 400 });

  // Con FTL en el aire la TV deja de ser la pantalla del DJ: se reusa su MOTOR
  // (players, audio, recortes, avance) pero se apaga toda su INTERFAZ — título,
  // portada, QR musical, próximas, header, logo, reacciones.
  const soloVideoFtl = showFtl;
  const hasLiveLayer = showRaffle || showTrivia || showSuma || showPalabra || showDuelo;
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
  // El item sintético lleva el prefijo del juego ('ftl:' / 'pt:') en el id
  // justamente para que no
  // pueda confundirse con una fila real de pantalla_playlist_items.
  const videoFtl = ftlPerformance ? gameState?.escenario_video : null;
  const itemFtl = videoFtl?.ytId ? {
    id:                 `${juegoEsc.type}:${participanteFtl?.turn_id || videoFtl.ytId}`,
    youtube_id:         videoFtl.ytId,
    title:              videoFtl.ytTitle || "Follow the Leader",
    trim_start_seconds: Number(videoFtl.trimStart) || 0,
    trim_end_seconds:   videoFtl.trimEnd ?? null,
    youtube_volume:     100,
  } : null;

  const PLACAS_NO_TV = ["escenario_karaoke", "logo", "logo_animado"];
  const activePlaca = sharesSession ? gameState?.active_placa : null;
  const hasPlaca = !!activePlaca && !PLACAS_NO_TV.includes(activePlaca);
  // Los juegos NO llevan transición: ni al entrar ni al salir, ni en los videos
  // de FTL / PT. Mientras un juego (o su placa de anuncio) está en pantalla, el
  // motor hace cortes secos y el GIF no se dibuja. La gracia cubre el cierre:
  // al cerrar FTL / PT el Admin avanza el DJ y suelta el escenario, y esos dos
  // avisos pueden llegar a la TV en cualquier orden. Los cambios entre
  // canciones del DJ, con la TV mostrando al DJ, usan la transición configurada.
  const juegoEnPantalla = showFtl || hasLiveLayer || (hasPlaca && PLACAS_DE_JUEGO.includes(activePlaca));
  const sinTransicion = useSostenido(juegoEnPantalla, GRACIA_SIN_TRANSICION_MS);

  // Tandas publicitarias: cada N canciones del DJ, una tanda antes del tema
  // siguiente (ver useTandasTv). Con un juego en pantalla no entran.
  const { itemTanda, audioTanda, terminarTanda } = useTandasTv({
    eventId, token, current,
    habilitadas: event?.ads_enabled === true,
    cadaN: event?.ads_every_n_songs,
    pausado: juegoEnPantalla,
    reportar: !telepronter,
  });

  // Lo que suena. Al soltar el escenario (o terminar la tanda) vuelve a ser
  // `current`. Con una tanda en MP3 los players del DJ quedan sin fuente: la
  // reproduce el <audio> de abajo.
  const fuente = itemFtl || itemTanda || (audioTanda ? null : current);
  // Con FTL o una tanda de YouTube al aire, el video va a pantalla completa y
  // sin la interfaz del DJ (título, QR, próximas…).
  const soloVideo = soloVideoFtl || !!itemTanda;

  // Los cambios de MODO de Follow the Leader son CORTES DIRECTOS: convocatoria
  // → participante preparado → video → convocatoria. Acá vivía una transición
  // propia del juego (estado `transicion`/`modoPrevio`, transición forzada,
  // z-index especial) que ya no existe. La transición del DJ (el GIF
  // configurado) es sólo para sus propios cambios de canción.

  // Se corta la fuente mientras la TV no está mostrando un video: en
  // convocatoria y con el participante preparado el DJ queda pausado en su
  // canción — no tiene sentido que suene música debajo de un QR ni detrás del
  // avatar de alguien que todavía no arrancó.
  // Video subido desde la PC (Biblioteca del Escenario): no pasa por los
  // players de YouTube, lo reproduce un <video> encima. Mientras suena, el DJ
  // queda pausado en su canción igual que con un video de YouTube.
  const archivoFtl = !itemFtl && videoFtl?.url ? videoFtl : null;
  const cortarFuente = ftlConvocatoria || ftlCandidato || !!archivoFtl;

  // Terminó el video del participante (YouTube o archivo): la TV le avisa a la
  // base y vuelve a la convocatoria por corte directo, igual que «■ Finalizar»
  // del Admin. Una sola vez por turno; la base además es idempotente.
  const turnoTerminadoRef = useRef(null);
  const terminarVideoEscenario = () => {
    const turno = participanteFtl?.turn_id;
    // El turno lo cierra /tv; la Telepronter sólo lo refleja.
    if (telepronter || !turno || turnoTerminadoRef.current === turno || !eventId || !token) return;
    turnoTerminadoRef.current = turno;
    tvEscenarioVideoTerminado(eventId, token, turno)
      .catch((e) => { turnoTerminadoRef.current = null; console.error("[PantallaTV] fin de video de escenario:", e); });
  };
  const reproduciendo = cortarFuente ? false : event?.is_playing !== false;

  // Transición entre canciones del DJ (DJ Democracy → Editor → «Transición
  // entre canciones»). Sin GIF no hay transición: corte directo. El fundido de
  // audio sólo vale con la transición activa.
  const transicionGif = event?.transition_enabled && event?.transition_gif_url ? event.transition_gif_url : null;
  const fadeInMs  = segundosAMs(event?.transition_fade_in_seconds,  FADE_IN_POR_DEFECTO);
  const holdMs    = segundosAMs(event?.transition_hold_seconds,     HOLD_POR_DEFECTO);
  const fadeOutMs = segundosAMs(event?.transition_fade_out_seconds, FADE_OUT_POR_DEFECTO);
  const fundidoAudio = !!transicionGif && event?.transition_audio_fade === true;
  const transicion = useMemo(() => (transicionGif
    ? { activa: true, fadeInMs, holdMs, fadeOutMs, fundidoAudio }
    : TRANSICION_APAGADA), [transicionGif, fadeInMs, holdMs, fadeOutMs, fundidoAudio]);
  // Dónde se dibuja: el bloque «Transición entre canciones» del Diseñador TV
  // si está visible; si no, el área del video.
  const areaTransicion = capasDj ? (capasDj.transicion || bloqueVideo)
    : canvasConfig.blocks.transition?.visible ? canvasConfig.blocks.transition : canvasConfig.blocks.video;

  // `displayedId` lo consumía la transición de FTL, que ya no existe: el motor
  // lo sigue exponiendo para quien lo necesite, pero acá no hay nada que esperar.
  const { playerIds, visiblePlayer, transitionPhase, cargando, playerError, readyCount } =
    // Los players se crean sobre sus <div>, que recién existen con el evento
    // cargado (antes se ve «Conectando…»). La Telepronter arranca desbloqueada:
    // sin esta espera los creaba sobre la nada y quedaba en negro.
    useContinuousTvPlayers({ current: fuente, eventId, token, unlocked: unlocked && !!eventId && !loading,
      muted: telepronter || !screenAudioOn || muteDj,
      playing: reproduciendo,
      // La performance no es la canción del evento: si la TV pidiera avanzar
      // al terminarla, el servidor archivaría la canción del DJ que está
      // congelada detrás. La Telepronter nunca avanza: espera el cambio de /tv.
      // Una tanda tampoco es la canción del evento: ni avanza ni reporta
      // progreso (el Admin vería el del tema que espera detrás).
      autoAdvance: !telepronter && !itemFtl && !itemTanda,
      reportar: !telepronter && !itemTanda,
      // Fin del video del juego: vuelve a la convocatoria, sin transición.
      // Fin de la tanda: arranca el tema que esperaba.
      onFuenteTerminada: (itemId) => {
        if (itemFtl && itemId === itemFtl.id) terminarVideoEscenario();
        if (itemTanda && itemId === itemTanda.id) terminarTanda();
      },
      captionsEnabled: event?.youtube_captions_enabled === true,
      transicion,
      sinTransicion });

  // El GIF se descarga de antemano: si no, la primera transición de la noche
  // arrancaría con el área vacía mientras baja.
  useEffect(() => {
    if (!transicionGif) return;
    const img = new Image();
    img.src = transicionGif;
  }, [transicionGif]);

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

  // Latido: es lo que el Admin lee para mostrar ACTIVA la pantalla. La TV late
  // siempre, esté mostrando la canción del DJ, un juego, el escenario o una
  // placa (el reporte de progreso sólo corre con canción al aire).
  useEffect(() => {
    if (!eventId || !token) return;
    const latir = () => (telepronter ? telepronterReport(eventId, token) : tvLatido(eventId, token))
      .catch((err) => console.warn(telepronter ? "[Telepronter] latido:" : "[TV] latido:", err.message));
    latir();
    const id = setInterval(latir, LATIDO_MS);
    return () => clearInterval(id);
  }, [telepronter, eventId, token]);
  const espejo = telepronter && event?.telepronter_espejo === true;

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

  const datosLienzoDj = {
    vivo: true, qrUrl: guestUrl(event?.code || code), sonando: current, proximas: candidates,
    evento: { nombre: event?.name || "Pantalla Bizarren", codigo: event?.code || code },
    // Lo que la TV reportó de la canción; la barra se adelanta sola entre reportes.
    progreso: current && event?.tv_duration > 0 ? {
      actual: Number(event.tv_current_time) || 0, total: Number(event.tv_duration), al: progresoAl,
      sonando: reproduciendo && !cargando,
    } : null,
    enVivo: event?.status === "live",
    // Las pastillas y el aviso de cierre calculan la votación con la fila del evento.
    cierreEvento: event,
    equipos: event?.teams_enabled ? equiposDj : [],
    gifPremio,
    kick: esKickDual(event?.kick_style) ? { modo: "dual" }
      : kickPorcentaje && kickEstado ? {
        modo: "porcentaje", votos: kickEstado.votes ?? 0, necesarios: kickEstado.needed ?? 1,
        visible: kickEstado.enabled !== false && kickEstado.visible !== false,
      } : null,
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=Space+Grotesk:wght@400;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:${C.bg};color:${C.white};font-family:'Space Grotesk',sans-serif;overflow:hidden}
    #${playerIds[0]},#${playerIds[1]}{display:block!important;position:absolute!important;inset:0!important;width:100%!important;height:100%!important;border:0!important;pointer-events:none!important}
    .tv-player-layer{position:absolute;inset:0;background:#000;transition:opacity .35s ease;pointer-events:none}
    @keyframes tvTransIn{from{opacity:0}to{opacity:1}}
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
          {authErr} Abrila desde el selector de pantallas del <strong>Admin</strong>.
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

  // El espejo envuelve TODO, incluidas las capas `position: fixed` (tapa de carga,
  // reacciones): un ancestro con transform pasa a ser su caja contenedora, así
  // que se invierten junto con el resto sin tocarlas una por una.
  return (
    <div data-telepronter-espejo={espejo || undefined} style={{
      position: "relative", width: "100vw", height: "100vh", overflow: "hidden",
      transform: espejo ? "scaleX(-1)" : "none",
    }}>
      <style>{css}</style>
      <div data-tv-live-stage style={{
        position: "relative", height: "100vh", width: "100vw", overflow: "hidden",
        // Sin fondo elegido en el Diseñador, el de la personalización del evento.
        backgroundColor: canvasConfig.screen.backgroundMode === "color" ? canvasConfig.screen.backgroundColor
          : canvasConfig.screen.backgroundMode === "none" ? (marca.fondo || C.bg) : C.bg,
        backgroundImage: canvasConfig.screen.backgroundMode === "image" && canvasConfig.screen.backgroundImage ? `url(${canvasConfig.screen.backgroundImage})`
          : canvasConfig.screen.backgroundMode === "none" && marca.fondoImagen ? `url(${marca.fondoImagen})` : "none",
        backgroundSize: "cover", backgroundPosition: "center",
      }}>
        {capasDj && !soloVideo && (
          <div data-tv-lienzo="debajo" style={{ position: "absolute", inset: 0, zIndex: 0 }}>
            <LienzoPantalla pantalla={capasDj.debajo} datos={datosLienzoDj} llenar/>
          </div>
        )}
        <ConfiguredBlock id="video"
          block={soloVideo ? aPantallaCompleta(bloqueVideo) : bloqueVideo}>
          {/* Players A/B permanentes: el standby nunca usa display:none. */}
          {playerIds.map((playerId, index) => (
            <div key={playerId} className="tv-player-layer" style={{
              opacity: visiblePlayer === index ? 1 : 0,
              zIndex: visiblePlayer === index ? 2 : 1,
            }}>
              <div id={playerId} />
            </div>
          ))}

          {archivoFtl && (
            <video key={archivoFtl.url} src={archivoFtl.url} autoPlay playsInline
              muted={telepronter || !screenAudioOn}
              onEnded={terminarVideoEscenario}
              onError={(e) => console.error("[PantallaTV] video de escenario:", e)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                objectFit: "contain", background: "#000", zIndex: 3 }}/>
          )}

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

        {capasDj && !soloVideo && (
          <div data-tv-lienzo="encima" style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }}>
            <LienzoPantalla pantalla={capasDj.encima} datos={datosLienzoDj} sinFondo llenar/>
          </div>
        )}
        {capasDj && !soloVideo && capasDj.arriba.elementos.length > 0 && (
          // Por encima de la transición (zIndex 100): ver SOBRE_LA_TRANSICION.
          <div data-tv-lienzo="arriba" style={{ position: "absolute", inset: 0, zIndex: 101, pointerEvents: "none" }}>
            <LienzoPantalla pantalla={capasDj.arriba} datos={datosLienzoDj} sinFondo llenar/>
          </div>
        )}

        {!soloVideo && !capasDj && <>
        <ConfiguredBlock id="logo" block={bloqueLogo}>
          <EditableOverlayText block={canvasConfig.blocks.logo}/>
        </ConfiguredBlock>

        <ConfiguredBlock id="qr" block={canvasConfig.blocks.qr} contentStyle={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "3cqh 3cqw" }}>
          <QrPanel code={event?.code || code} block={canvasConfig.blocks.qr} marca={marca}/>
        </ConfiguredBlock>

        <ConfiguredBlock id="upcoming" block={canvasConfig.blocks.upcoming} contentStyle={{ padding: "4cqh 4cqw" }}>
          <UpcomingPanel candidates={candidates} marca={marca}/>
        </ConfiguredBlock>

        <ConfiguredBlock id="header" block={canvasConfig.blocks.header} contentStyle={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2cqh 2cqw" }}>
          <span style={{ fontSize: "min(7cqw,20cqh)", fontWeight: canvasConfig.blocks.header.font.titleWeight, color: canvasConfig.blocks.header.font.titleColor || marca.acento || C.white }}>
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
                  fontWeight: canvasConfig.blocks.nowPlaying.font.titleWeight, fontSize: canvasConfig.blocks.nowPlaying.font.titleSize || "min(8cqw,28cqh)", color: canvasConfig.blocks.nowPlaying.font.titleColor || marca.texto || C.gold,
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

        {!soloVideo && !capasDj && canvasConfig.screen.overlay.enabled && canvasConfig.screen.overlay.url && <img src={canvasConfig.screen.overlay.url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: canvasConfig.screen.overlay.opacity, pointerEvents: "none", zIndex: 2147483647 }}/>}

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
            {showSuma && <SumaScreen sessionId={session?.id ?? null}/>}
            {showPalabra && <PalabraScreen sessionId={session?.id ?? null}/>}
            {showDuelo && (
              <DueloBigscreen gameState={gameState} sessionId={session?.id ?? null}
                webappUrl={window.location.origin}
                placa={<PlacaScreen logo="/logo.png" gameState={{ ...gameState, active_placa:"duelo", placa_custom:null }}/>}/>
            )}
            {/* QR de Rey / Desafío / Sumate / Arma (Diseñador → QR y logo del juego) */}
            {(showRaffle || showTrivia || showSuma || showPalabra) && (
              <QrDeJuego activeGame={activeGame}/>
            )}
          </div>
        )}

        {/* Follow the Leader: sólo el avatar y (cuando exista el backend de
            votación) los porcentajes. Transparente y sin reproductor propio —
            el video de abajo es el del DJ, con su recorte de inicio/fin. */}
        {(ftlConvocatoria || ftlCandidato) && !hasLiveLayer && !hasPlaca && (
          // Pantalla previa apagada (🎨 Diseño de juegos): al llamar al
          // participante la TV sigue en la convocatoria hasta que arranca el video.
          <FtlStandby juego={juegoEsc} webappUrl={window.location.origin}
            participante={ftlCandidato && listoCfg[juegoEsc.type]?.previa !== false ? participanteFtl : null}/>
        )}

        {ftlPerformance && !hasLiveLayer && !hasPlaca && (
          <FtlOverlay participante={participanteFtl} juego={juegoEsc}
            pct={modoVotacion === "toques" ? energiaFtl
              : modoVotacion === "votos" ? (votosFtl.up_pct ?? 0)
              : modoVotacion === "pelea" ? peleaFtl.pct
              : null}
            decae={modoVotacion === "toques"}
            barometro={listoCfg[juegoEsc.type]?.barometro}/>
        )}
      </div>

      {/* La transición es sólo del DJ: con un juego o su placa en pantalla no
          se dibuja nunca, aunque el motor haya quedado a mitad de un cruce. */}
      <TvTransicion phase={juegoEnPantalla ? "idle" : transitionPhase}
        gif={transicionGif} area={areaTransicion} fadeInMs={fadeInMs} fadeOutMs={fadeOutMs}/>

      {/* Tapa lisa mientras los players cargan el tema (arranque, un video
          que falló): que no se vea la carga de YouTube. Sin tema, en cambio,
          se ve el «Esperando la próxima canción…» del DJ. */}
      {!juegoEnPantalla && !!fuente && (cargando || readyCount < 2) && (
        <div aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 100,
          background: C.bg, pointerEvents: "none" }}/>
      )}

      {/* Tanda publicitaria en MP3: pantalla propia mientras suena. Con un
          juego encima (que tapa todo) se calla, igual que el DJ. */}
      {audioTanda && (
        <TandaAudio key={audioTanda.clave} tanda={audioTanda} logo={marca.logo || "/logo.png"}
          muted={telepronter || !screenAudioOn || muteDj} onTerminar={terminarTanda}/>
      )}

      {!soloVideo && <Reacciones eventId={eventId} size={canvasConfig.screen.reactionEmojiSize}/>}

      {/* Tomatazo: es la votación para voltear la canción del DJ, así que sólo
          se monta cuando la capa visual es la del DJ. Con un juego en vivo, un
          escenario o una placa puesta no se tiran tomates: no son su pantalla.
          Desmontarlo no pierde nada — al volver, el seq del momento es baseline
          y no se reproducen impactos viejos. */}
      {!soloVideo && !hasLiveLayer && !hasPlaca && (
        <TomatazoOverlay event={event} eventId={eventId} client={supabaseAnon}/>
      )}
      {/* Amor y Odio / Guns & Roses: medidor en el bloque «Contador Sacar Tema»
          del Diseñador, flores, tomates y balas. Mismas reglas que el Tomatazo. */}
      {!soloVideo && !hasLiveLayer && !hasPlaca && (
        <KickDualOverlay event={event} area={capasDj ? capasDj.contador : canvasConfig.blocks.kickCounter}/>
      )}
    </div>
  );
}

const pantallaCentro = {
  height: "100vh", width: "100vw", display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center", textAlign: "center",
  background: C.bg, padding: 24,
};
