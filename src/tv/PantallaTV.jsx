import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { supabaseAnon } from "../lib/supabase";
import { usePantallaEvent } from "../hooks/realtime/usePantallaEvent";
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
  return (
      <div style={{ alignItems: "center", display: "flex", flexDirection: "column", height: "100%", justifyContent: "center", textAlign: "center", width: "100%" }}>
        <div style={{
          fontFamily: "Syne, sans-serif", fontWeight: block.content?.bold ? 900 : 400, fontSize: `min(${(block.content?.textSize || 16) / 2}cqw,${(block.content?.textSize || 16) / 2}cqh)`,
          letterSpacing: ".08em", color: block.content?.textColor || C.gold, marginBottom: "3cqh",
          order: block.content?.textPosition === "bottom" ? 3 : 0,
        }}>{block.content?.text}</div>
        <div style={{ background: "#fff", padding: "2cqw", borderRadius: "3cqw", display: "flex", maxHeight: "62cqh", maxWidth: "78cqw" }}>
          <QRCode value={guestUrl(code)} style={{ height: "100%", width: "100%" }} />
        </div>
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

function TvStatic({ phase, waiting }) {
  if (phase === "idle" && !waiting) return null;
  return (
    <div className={`tv-static tv-static-${phase === "idle" ? "static" : phase}`} aria-hidden="true">
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

  const { event, candidates, current, loading } =
    usePantallaEvent({ eventId, client: supabaseAnon });
  const { playerIds, visiblePlayer, rainPhase, playerError, readyCount } =
    useContinuousTvPlayers({ current, eventId, token, unlocked, rainAnticipationSeconds: event?.rain_anticipation_seconds ?? 6, rainTailSeconds: event?.rain_tail_seconds ?? 0 });

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
    #${playerIds[0]},#${playerIds[1]}{display:block!important;position:absolute!important;inset:0!important;width:100%!important;height:100%!important;border:0!important}
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
        <ConfiguredBlock id="video" block={canvasConfig.blocks.video}>
          {/* Players A/B permanentes: el standby nunca usa display:none. */}
          {playerIds.map((playerId, index) => (
            <div key={playerId} className="tv-player-layer" style={{
              opacity: visiblePlayer === index ? 1 : 0,
              zIndex: visiblePlayer === index ? 2 : 1,
            }}>
              <div id={playerId} />
            </div>
          ))}

          {!current && (
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

        {canvasConfig.screen.overlay.enabled && canvasConfig.screen.overlay.url && <img src={canvasConfig.screen.overlay.url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: canvasConfig.screen.overlay.opacity, pointerEvents: "none", zIndex: 2147483647 }}/>} 
      </div>

      <TvStatic phase={rainPhase} waiting={!current || readyCount < 2}/>

      <Reacciones eventId={eventId} size={canvasConfig.screen.reactionEmojiSize}/>
    </>
  );
}

const pantallaCentro = {
  height: "100vh", width: "100vw", display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center", textAlign: "center",
  background: C.bg, padding: 24,
};
