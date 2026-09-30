import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import QRCode from "react-qr-code";
import { useDueloRound } from "../hooks/realtime/useDueloRound";
import {
  faseDuelo, duelistasDeRonda, porcentajesDuelo, segundosRestantes, formatoReloj,
} from "../services/duelo";

const P1_COLOR = "#ff1688"; // Participante 1 — fucsia
const P2_COLOR = "#ff8a00"; // Participante 2 — naranja
const PLACA    = "/placas/Duelo_de_talento-removebg-preview.png";
const LOGO_APP  = "/logo.png";
const LOGO_DUELO = "/logos/duelo_horizontal.png";
const MAX_ACTIVE_PER_SLOT = 20;

// ── YouTubeVideoPlayer (memoizado) ────────────────────────────────────────────
// CRÍTICO: solo se re-renderiza si cambia yt_id / video_url. Sin esto, cada tap
// (update de counts) re-montaría el iframe y el video se reiniciaría.
const YouTubeVideoPlayer = memo(function YouTubeVideoPlayer({ video }) {
  if (video?.source === "youtube" && video?.yt_id) {
    return (
      <iframe
        title="duelo-video"
        src={`https://www.youtube.com/embed/${video.yt_id}?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&loop=1&playlist=${video.yt_id}`}
        style={{ width: "100%", height: "100%", border: "none" }}
        allow="autoplay; encrypted-media"
      />
    );
  }
  if (video?.source === "url" && video?.video_url) {
    return (
      <video src={video.video_url} autoPlay muted loop
        style={{ width: "100%", height: "100%", objectFit: "contain" }} />
    );
  }
  return null;
}, (prev, next) =>
  prev.video?.source === next.video?.source &&
  prev.video?.yt_id === next.video?.yt_id &&
  prev.video?.video_url === next.video?.video_url
);

// ── Cara circular simple (foto o emoji) — usada en el resultado ────────────────
function Face({ emoji, photo, size, borderColor }) {
  const base = {
    width: size, height: size, borderRadius: "50%", overflow: "hidden",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: `calc(${size} * 0.5)`, flexShrink: 0,
    background: "rgba(20,8,30,.75)", border: `2px solid ${borderColor}`,
  };
  if (photo) return <div style={base}><img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>;
  return <div style={base}>{emoji || "🎤"}</div>;
}

// ── DuelHeader — logos centrales posicionados independientes (dentro del área central) ──
// BizarrApp: chico, hacia el participante 1 (izq). Duelo: grande, centrado sobre el video.
function DuelHeader() {
  return (
    <div className="center-header">
      <img className="bizarrapp-logo" src={LOGO_APP} alt="BizarrApp"
        onError={(e) => { e.currentTarget.style.display = "none"; }} />
      <img className="duel-logo" src={LOGO_DUELO} alt="Duelo de Talentos"
        onError={(e) => { e.currentTarget.style.display = "none"; }} />
    </div>
  );
}

// ── CircularAvatar — sin caja detrás, glow que se intensifica al recibir voto ──
function CircularAvatar({ avatar, color, pulse, avatarRef }) {
  const flashRef = useRef(null);
  const size = "clamp(78px, 5.2vw, 102px)";

  useEffect(() => {
    if (!pulse?.key) return;
    const s = pulse.big ? 1.1 : 1.06;
    avatarRef.current?.animate(
      [{ transform: "scale(1)" }, { transform: `scale(${s})` }, { transform: "scale(1)" }],
      { duration: 380, easing: "ease-out" }
    );
    flashRef.current?.animate(
      [{ transform: "translate(-50%,-50%) scale(.6)", opacity: pulse.big ? 0.85 : 0.6 },
       { transform: `translate(-50%,-50%) scale(${pulse.big ? 2.4 : 1.8})`, opacity: 0 }],
      { duration: 460, easing: "ease-out" }
    );
  }, [pulse?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {/* destello radial detrás (efecto de llegada) */}
      <div ref={flashRef} style={{
        position: "absolute", left: "50%", top: "50%", width: "100%", height: "100%",
        borderRadius: "50%", background: `radial-gradient(circle, ${color}cc, transparent 70%)`,
        transform: "translate(-50%,-50%) scale(0)", opacity: 0, pointerEvents: "none",
      }} />
      <div ref={avatarRef} style={{
        width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden",
        border: `2px solid ${color}`, boxShadow: `0 0 18px ${color}aa`,
        background: "rgba(20,8,30,.6)", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: "2.2rem", willChange: "transform",
      }}>
        {avatar?.photo_url
          ? <img src={avatar.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : (avatar?.avatar_emoji || "🎤")}
      </div>
    </div>
  );
}

// ── LikeCounter — "👍 58%", pulso al cambiar sin layout shift ──────────────────
// Muestra el REPARTO, no el acumulado: el número puede subir y bajar, y el
// pulso salta con cualquier cambio (no es monotónico).
function LikeCounter({ percent, color, numberColor }) {
  const value    = `${percent}%`;
  const numRef   = useRef(null);
  const firstRef = useRef(true);
  useEffect(() => {
    if (firstRef.current) { firstRef.current = false; return; }
    numRef.current?.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }],
      { duration: 300, easing: "ease-out" }
    );
  }, [value]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, lineHeight: 1 }}>
      <span style={{ fontSize: "clamp(29px, 2.2vw, 40px)", filter: `drop-shadow(0 1px 4px ${color}88)` }}>👍</span>
      <span ref={numRef} style={{
        display: "inline-block", fontFamily: "Syne, sans-serif", fontWeight: 800,
        fontSize: "clamp(44px, 3.2vw, 62px)", color: numberColor || color,
        textShadow: `0 2px 12px ${color}66`,
      }}>{value}</span>
    </div>
  );
}

// ── ContestantInfo — avatar + nombre + contador, SIN tarjeta (por encima de partículas) ──
function ContestantInfo({ name, color, avatar, percent, side, leader, avatarRef, pulse, popups }) {
  const isLeft = side === "left";
  return (
    <div className="contestant-info">
      <div style={{ position: "relative" }}>
        <CircularAvatar avatar={avatar} color={color} pulse={pulse} avatarRef={avatarRef} />
        {leader && (
          <div style={{ position: "absolute", top: -40, left: "50%", transform: "translateX(-50%) rotate(-8deg)",
            fontSize: "clamp(28px, 2vw, 38px)", filter: `drop-shadow(0 0 8px ${color})` }}>👑</div>
        )}
        {/* +1 / +N flotante (efecto de llegada) */}
        {popups.map((p) => (
          <div key={p.id} style={{
            position: "absolute", top: -6, [isLeft ? "right" : "left"]: -12, zIndex: 6,
            fontFamily: "Syne, sans-serif", fontWeight: 800, color,
            fontSize: p.big ? "1.7rem" : "1.2rem",
            textShadow: `0 2px 8px ${color}`, animation: "dueloVotePopup .8s ease-out forwards",
          }}>{p.text}</div>
        ))}
      </div>
      <div style={{
        fontSize: "clamp(24px, 1.8vw, 33px)", fontWeight: 700, color: "#fff",
        textTransform: "uppercase", letterSpacing: 0.5, textShadow: "0 2px 10px rgba(0,0,0,.7)",
      }}>{name}</div>
      <LikeCounter percent={percent} color={color} numberColor={isLeft ? "#ff258e" : "#ff9100"} />
    </div>
  );
}

// ── VoteParticle — 👍 que sube por carril lateral hasta el avatar (WAAPI + offset-path) ──
// Coordenadas RELATIVAS A LA COLUMNA (layerRef). Mecánica preservada: misma curva Bézier,
// duración 3.5-5s, easing, offset-path y backstop. Solo cambia el marco de referencia.
function VoteParticle({ particle, avatarRef, layerRef, color, onDone }) {
  const ref     = useRef(null);
  const kind    = particle.kind || "thumb";
  const sizeRef = useRef(
    kind === "spark" ? Math.round(3 + Math.random() * 5)     // chispa 3-8px
    : kind === "plus" ? Math.round(18 + Math.random() * 10)  // +1 18-28px
    : Math.round(30 + Math.random() * 18)                    // pulgar 30-48px
  );

  useEffect(() => {
    const el = ref.current;
    const layer = layerRef.current;
    const arect = avatarRef.current?.getBoundingClientRect();
    if (!el || !layer || !arect) { onDone(particle); return; }

    const lrect = layer.getBoundingClientRect();
    const lw = lrect.width, lh = lrect.height;
    const isLeft = particle.slot === 1;
    // Nacen dentro de la columna (izq 12-82%, der 18-88% del ancho; 82-102% de la altura).
    const xStart = isLeft ? lw * (0.12 + Math.random() * 0.70) : lw * (0.18 + Math.random() * 0.70);
    const yStart = lh * (0.82 + Math.random() * 0.20);
    // Destino: centro del avatar, relativo a la columna.
    const xEnd = (arect.left + arect.width / 2) - lrect.left;
    const yEnd = (arect.top + arect.height / 2) - lrect.top;
    // Control Bézier: primero se abre hacia el lateral, después converge al avatar.
    const xCtrl = isLeft ? xStart - lw * (0.04 + Math.random() * 0.06) : xStart + lw * (0.04 + Math.random() * 0.06);
    const yCtrl = (yStart + yEnd) / 2 - lh * 0.06;

    el.style.offsetPath = `path("M ${xStart} ${yStart} Q ${xCtrl} ${yCtrl} ${xEnd} ${yEnd}")`;
    el.style.offsetRotate = "0deg";

    const rotStart = (Math.random() * 30 - 15).toFixed(1);
    const rotEnd   = (Math.random() * 30 - 15).toFixed(1);
    const scaleMid = (0.9 + Math.random() * 0.3).toFixed(2);
    const peak     = (0.75 + Math.random() * 0.25).toFixed(2);
    const duration = 3500 + Math.random() * 1500; // 3.5s – 5s

    const anim = el.animate([
      { offsetDistance: "0%",   opacity: 0,     transform: `rotate(${rotStart}deg) scale(0.6)` },
      { offsetDistance: "15%",  opacity: peak,  transform: `rotate(${rotStart}deg) scale(${scaleMid})`, offset: 0.15 },
      { offsetDistance: "82%",  opacity: peak,  transform: `rotate(${rotEnd}deg) scale(${scaleMid})`,   offset: 0.82 },
      { offsetDistance: "100%", opacity: 0,     transform: `rotate(${rotEnd}deg) scale(0.25)` },
    ], { duration, easing: "cubic-bezier(0.35, 0.05, 0.3, 1)" });

    let done = false;
    const finish = () => { if (done) return; done = true; onDone(particle); };
    anim.onfinish = finish;
    const t = setTimeout(finish, duration + 200); // backstop si offset-path no soporta (~5.2s máx)
    return () => { clearTimeout(t); anim.cancel?.(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sideClass = particle.slot === 1 ? "left" : "right";

  // Chispa: pequeño círculo brillante (blanco/rosa o blanco/dorado).
  if (kind === "spark") {
    return (
      <div ref={ref} className={`vote-spark vote-spark--${sideClass}`} style={{
        position: "absolute", top: 0, left: 0,
        width: sizeRef.current, height: sizeRef.current, borderRadius: "50%",
        pointerEvents: "none", willChange: "transform, opacity",
      }} />
    );
  }

  // Pulgar (👍 / +N agrupado) o "+1".
  return (
    <div ref={ref} className={`vote-like vote-like--${sideClass}`} style={{
      position: "absolute", top: 0, left: 0, fontSize: sizeRef.current,
      pointerEvents: "none", willChange: "transform, opacity",
      fontFamily: "Syne, sans-serif", fontWeight: 800,
      color: kind === "plus" ? color : (particle.isGroup ? color : undefined),
    }}>
      {kind === "plus" ? "+1" : (particle.isGroup ? `+${particle.groupSize}` : "👍")}
    </div>
  );
}

// ── VoteParticleLayer — capa de votos DENTRO de la columna (overflow:hidden) ────
function VoteParticleLayer({ particles, avatarRef, color, onDone }) {
  const layerRef = useRef(null);
  return (
    <div ref={layerRef} className="vote-particle-layer">
      {particles.map((p) => (
        <VoteParticle key={p.id} particle={p} avatarRef={avatarRef} layerRef={layerRef}
          color={color} onDone={onDone} />
      ))}
    </div>
  );
}

// ── Partículas ambientales (decorativas, puro CSS) — generadas 1 sola vez ──────
// Concentración inferior: 60% zona baja, 30% media, 10% alta (poca densidad cerca del avatar).
function pickBandRise() {
  const r = Math.random();
  if (r < 0.60) return -(34 + Math.random() * 22); // -34..-56vh (mitad inferior)
  if (r < 0.90) return -(56 + Math.random() * 16); // -56..-72vh
  return -(72 + Math.random() * 13);               // -72..-85vh
}

function makeAmbient() {
  // Puntitos pequeños (12-19)
  const dots = Array.from({ length: 12 + Math.floor(Math.random() * 8) }, (_, i) => {
    const duration = 5 + Math.random() * 6; // 5-11s
    return {
      id: `d${i}`,
      x: Math.round(Math.random() * 100),
      size: (2 + Math.random() * 4).toFixed(1),        // 2-6px
      duration: duration.toFixed(1),
      delay: (-Math.random() * duration).toFixed(1),
      drift: Math.round(Math.random() * 50 - 25),
      rise: pickBandRise().toFixed(0),
      opacity: (0.35 + Math.random() * 0.4).toFixed(2), // 0.35-0.75
    };
  });
  // Pulgares ambientales muy sutiles (2-4)
  const thumbs = Array.from({ length: 2 + Math.floor(Math.random() * 3) }, (_, i) => {
    const duration = 6 + Math.random() * 6; // 6-12s
    return {
      id: `t${i}`,
      x: Math.round(8 + Math.random() * 84),
      size: Math.round(18 + Math.random() * 14),       // 18-32px
      duration: duration.toFixed(1),
      delay: (-Math.random() * duration).toFixed(1),
      drift: Math.round(Math.random() * 60 - 30),
      rise: (-(48 + Math.random() * 24)).toFixed(0),   // -48..-72vh
      opacity: (0.2 + Math.random() * 0.25).toFixed(2), // 0.2-0.45
    };
  });
  // Destellos que titilan en la mitad inferior (4-6)
  const sparks = Array.from({ length: 4 + Math.floor(Math.random() * 3) }, (_, i) => ({
    id: `s${i}`,
    x: Math.round(Math.random() * 100),
    y: Math.round(50 + Math.random() * 46),            // 50-96% (mitad inferior)
    size: (2 + Math.random() * 3).toFixed(1),          // 2-5px
    duration: (1.4 + Math.random() * 1.8).toFixed(2),  // 1.4-3.2s
    delay: (-Math.random() * 3).toFixed(2),
    variant: Math.random() < 0.5 ? "a" : "b",
  }));
  // "+1" ambientales tenues (2)
  const plus = Array.from({ length: 2 }, (_, i) => {
    const duration = 6 + Math.random() * 4; // 6-10s
    return {
      id: `pl${i}`,
      x: Math.round(15 + Math.random() * 70),
      duration: duration.toFixed(1),
      delay: (-Math.random() * duration).toFixed(1),
      drift: Math.round(Math.random() * 30 - 15),
      rise: (-(45 + Math.random() * 25)).toFixed(0),   // -45..-70vh
    };
  });
  return { dots, thumbs, sparks, plus };
}

// ── ContestantColumn — columna lateral por capas (fondo · energía · ambient · votos · info · glow) ──
function ContestantColumn({ side, name, color, avatar, percent, leader, avatarRef, pulse, popups, particles, onParticleDone }) {
  const [ambient] = useState(makeAmbient); // generadas una sola vez al montar
  const glowRef = useRef(null);

  // Al recibir voto → intensificar brevemente el glow inferior.
  useEffect(() => {
    if (!pulse?.key) return;
    glowRef.current?.animate(
      [{ opacity: 0.72, transform: "scale(1)" },
       { opacity: pulse.big ? 1 : 0.92, transform: `scale(${pulse.big ? 1.14 : 1.07})` },
       { opacity: 0.72, transform: "scale(1)" }],
      { duration: pulse.big ? 620 : 460, easing: "ease-out" }
    );
  }, [pulse?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`contestant-column contestant-column--${side}`}>
      <div className="column-background" />
      <div className="column-energy-lines" />
      <div className="column-ambient-particles">
        {ambient.dots.map((p) => (
          <span key={p.id} className="ambient-particle" style={{
            "--x": `${p.x}%`, "--size": `${p.size}px`, "--duration": `${p.duration}s`,
            "--delay": `${p.delay}s`, "--drift": `${p.drift}px`, "--rise": `${p.rise}vh`,
            "--amb-op": p.opacity,
          }} />
        ))}
        {ambient.thumbs.map((p) => (
          <span key={p.id} className="ambient-thumb" style={{
            "--x": `${p.x}%`, "--size": `${p.size}px`, "--duration": `${p.duration}s`,
            "--delay": `${p.delay}s`, "--drift": `${p.drift}px`, "--rise": `${p.rise}vh`,
            "--amb-op": p.opacity,
          }}>👍</span>
        ))}
        {ambient.plus.map((p) => (
          <span key={p.id} className="ambient-plus" style={{
            "--x": `${p.x}%`, "--duration": `${p.duration}s`, "--delay": `${p.delay}s`,
            "--drift": `${p.drift}px`, "--rise": `${p.rise}vh`,
          }}>+1</span>
        ))}
        {ambient.sparks.map((p) => (
          <span key={p.id} className={`ambient-spark ambient-spark--${p.variant}`} style={{
            "--x": `${p.x}%`, "--y": `${p.y}%`, "--size": `${p.size}px`,
            "--duration": `${p.duration}s`, "--delay": `${p.delay}s`,
          }} />
        ))}
      </div>
      <VoteParticleLayer particles={particles} avatarRef={avatarRef} color={color} onDone={onParticleDone} />
      <ContestantInfo name={name} color={color} avatar={avatar} percent={percent} side={side}
        leader={leader} avatarRef={avatarRef} pulse={pulse} popups={popups} />
      <div ref={glowRef} className="column-bottom-glow" />
    </div>
  );
}

// ── CSS del duelo (columnas por capas + logos header). Inline no alcanza para ─────
// ::after, mask-image ni repeating-gradient, así que se inyecta como bloque <style>.
const duelStyles = (
  <style>{`
    .duel-screen {
      --left-color: #ff087f;  --left-bright: #ff3ca2;  --left-dark: #260016;
      --right-color: #ff8a00; --right-bright: #ffb000; --right-dark: #291300;
      --header-height: clamp(108px, 13vh, 145px);
      position: absolute; inset: 0; height: 100%;
      display: grid;
      grid-template-columns: clamp(190px, 15vw, 285px) minmax(0, 1fr) clamp(190px, 15vw, 285px);
      grid-template-rows: 100%;
      overflow: hidden; background: #050308;
    }

    /* ── Área central: video + logos ── */
    .video-zone {
      position: relative; min-width: 0; height: 100%;
      display: flex; flex-direction: column; align-items: stretch;
      gap: clamp(2px, 0.5vh, 8px); overflow: hidden;
    }
    .center-header {
      position: relative; width: 100%;
      height: var(--header-height); min-height: var(--header-height);
      z-index: 20; pointer-events: none;
    }
    .bizarrapp-logo {
      position: absolute; left: clamp(8px, 1.5vw, 30px); top: 50%; transform: translateY(-50%);
      height: clamp(103px, 9vw, 165px); width: auto; object-fit: contain;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,.85)) drop-shadow(0 0 12px rgba(255,190,0,.18));
    }
    .duel-logo {
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      height: clamp(140px, 12vw, 220px); max-width: min(48vw, 780px); width: auto; object-fit: contain;
      mix-blend-mode: screen; /* el PNG sigue sin alfa (RGB) → screen elimina el rectángulo negro */
      filter: drop-shadow(0 4px 10px rgba(0,0,0,.9)) drop-shadow(0 0 16px rgba(255,170,0,.32));
    }
    .video-wrapper {
      position: relative; flex: 1; min-height: 0;
      display: flex; align-items: center; justify-content: center;
      margin-top: clamp(12px, 1.5vh, 24px); /* baja el video para separarlo del header */
      padding: 0 0 clamp(8px, 1vh, 16px);   /* sin padding horizontal → el video pega contra las columnas */
    }
    .youtube-player-container {
      width: 100%;
      height: min(82vh, calc(100vh - var(--header-height) - clamp(12px, 1.5vh, 24px)));
      max-width: 100%; background: #000; overflow: hidden;
    }

    /* ── Columnas laterales ── */
    .contestant-column { position: relative; height: 100%; overflow: hidden; isolation: isolate; }

    .contestant-column--left {
      background:
        radial-gradient(ellipse at 45% 9%, rgba(255,20,130,0.30) 0%, rgba(255,20,130,0.12) 24%, transparent 48%),
        radial-gradient(ellipse at 50% 108%, rgba(255,0,110,0.72) 0%, rgba(255,0,110,0.32) 28%, rgba(70,0,40,0.14) 54%, transparent 72%),
        linear-gradient(90deg, #210011 0%, #16000d 55%, #070308 100%);
    }
    .contestant-column--left::after {
      content: ""; position: absolute; z-index: 4; top: 0; right: 0; bottom: 0; width: 24%;
      pointer-events: none;
      background: linear-gradient(90deg, transparent 0%, rgba(5,3,8,0.18) 65%, rgba(5,3,8,0.48) 100%);
    }

    .contestant-column--right {
      background:
        radial-gradient(ellipse at 55% 9%, rgba(255,150,0,0.30) 0%, rgba(255,150,0,0.12) 24%, transparent 48%),
        radial-gradient(ellipse at 50% 108%, rgba(255,120,0,0.74) 0%, rgba(255,115,0,0.34) 28%, rgba(80,38,0,0.15) 54%, transparent 72%),
        linear-gradient(270deg, #291300 0%, #170b00 55%, #070308 100%);
    }
    .contestant-column--right::after {
      content: ""; position: absolute; z-index: 4; top: 0; left: 0; bottom: 0; width: 24%;
      pointer-events: none;
      background: linear-gradient(270deg, transparent 0%, rgba(5,3,8,0.18) 65%, rgba(5,3,8,0.48) 100%);
    }

    /* ── Líneas verticales de energía ── */
    .column-energy-lines {
      position: absolute; z-index: 1; inset: 20% 6% 0; pointer-events: none; opacity: 0.30;
      -webkit-mask-image: linear-gradient(to top, black 0%, rgba(0,0,0,0.8) 48%, transparent 100%);
      mask-image: linear-gradient(to top, black 0%, rgba(0,0,0,0.8) 48%, transparent 100%);
      animation: energyMove 4s ease-in-out infinite alternate;
    }
    .contestant-column--left .column-energy-lines {
      background: repeating-linear-gradient(90deg, transparent 0, transparent 20px, rgba(255,30,135,0.22) 21px, transparent 23px);
    }
    .contestant-column--right .column-energy-lines {
      background: repeating-linear-gradient(90deg, transparent 0, transparent 20px, rgba(255,155,0,0.22) 21px, transparent 23px);
    }
    @keyframes energyMove {
      from { transform: translateY(35px);  opacity: 0.18; }
      50%  {                                opacity: 0.34; }
      to   { transform: translateY(-35px); opacity: 0.18; }
    }

    /* ── Glow inferior ── */
    .column-bottom-glow {
      position: absolute; z-index: 2; left: -8%; right: -8%; bottom: -14%; height: 48%;
      border-radius: 50%; filter: blur(28px); pointer-events: none; opacity: 0.72;
    }
    .contestant-column--left .column-bottom-glow {
      background: radial-gradient(ellipse, rgba(255,0,110,0.78) 0%, rgba(255,0,110,0.24) 42%, transparent 72%);
    }
    .contestant-column--right .column-bottom-glow {
      background: radial-gradient(ellipse, rgba(255,130,0,0.80) 0%, rgba(255,110,0,0.25) 42%, transparent 72%);
    }

    /* ── Partículas ambientales ── */
    .column-ambient-particles { position: absolute; inset: 0; z-index: 3; overflow: hidden; pointer-events: none; }

    /* puntitos */
    .ambient-particle {
      position: absolute; left: var(--x); bottom: -20px;
      width: var(--size); height: var(--size); border-radius: 50%;
      opacity: 0; pointer-events: none;
      animation: ambientRise var(--duration) linear var(--delay) infinite;
    }
    .contestant-column--left .ambient-particle {
      background: #ff3b9d; box-shadow: 0 0 6px #ff1688, 0 0 14px rgba(255,0,120,0.75);
    }
    .contestant-column--right .ambient-particle {
      background: #ffad20; box-shadow: 0 0 6px #ff8a00, 0 0 14px rgba(255,130,0,0.75);
    }
    @keyframes ambientRise {
      0%   { transform: translate3d(0,0,0) scale(0.6); opacity: 0; }
      12%  { opacity: var(--amb-op, 0.65); }
      75%  { opacity: calc(var(--amb-op, 0.65) * 0.5); }
      100% { transform: translate3d(var(--drift), var(--rise, -75vh), 0) scale(0.15); opacity: 0; }
    }

    /* pulgares ambientales sutiles */
    .ambient-thumb {
      position: absolute; left: var(--x); bottom: -32px;
      font-size: var(--size); line-height: 1; opacity: 0; pointer-events: none;
      filter: blur(0.6px);
      animation: ambientThumbRise var(--duration) ease-in-out var(--delay) infinite;
    }
    .contestant-column--left  .ambient-thumb { color: #ff72bd; text-shadow: 0 0 8px rgba(255,0,120,0.5); }
    .contestant-column--right .ambient-thumb { color: #ffd65a; text-shadow: 0 0 8px rgba(255,130,0,0.5); }
    @keyframes ambientThumbRise {
      0%   { transform: translate3d(0,0,0) scale(0.85) rotate(-6deg); opacity: 0; }
      15%  { opacity: var(--amb-op, 0.35); }
      50%  { transform: translate3d(calc(var(--drift) * 0.5), calc(var(--rise, -60vh) * 0.5), 0) scale(1) rotate(5deg); }
      80%  { opacity: calc(var(--amb-op, 0.35) * 0.6); }
      100% { transform: translate3d(var(--drift), var(--rise, -60vh), 0) scale(0.7) rotate(-3deg); opacity: 0; }
    }

    /* "+1" ambientales tenues */
    .ambient-plus {
      position: absolute; left: var(--x); bottom: -20px;
      font-family: Syne, sans-serif; font-weight: 800; font-size: clamp(14px, 1vw, 20px);
      opacity: 0; pointer-events: none;
      animation: ambientPlusRise var(--duration) ease-out var(--delay) infinite;
    }
    .contestant-column--left  .ambient-plus { color: #ff3ca2; text-shadow: 0 0 8px rgba(255,0,120,0.6); }
    .contestant-column--right .ambient-plus { color: #ffb000; text-shadow: 0 0 8px rgba(255,130,0,0.6); }
    @keyframes ambientPlusRise {
      0%   { transform: translate3d(0,0,0) scale(0.7); opacity: 0; }
      18%  { opacity: 0.4; }
      100% { transform: translate3d(var(--drift), var(--rise, -55vh), 0) scale(0.9); opacity: 0; }
    }

    /* destellos que titilan (mitad inferior) */
    .ambient-spark {
      position: absolute; left: var(--x); top: var(--y);
      width: var(--size); height: var(--size); border-radius: 50%;
      opacity: 0; pointer-events: none;
      animation: sparkTwinkle var(--duration) ease-in-out var(--delay) infinite;
    }
    .contestant-column--left  .ambient-spark--a { background: #fff;     box-shadow: 0 0 6px #fff, 0 0 10px rgba(255,0,120,0.8); }
    .contestant-column--left  .ambient-spark--b { background: #ff72bd;  box-shadow: 0 0 6px #ff72bd, 0 0 12px rgba(255,0,120,0.85); }
    .contestant-column--right .ambient-spark--a { background: #fff;     box-shadow: 0 0 6px #fff, 0 0 10px rgba(255,130,0,0.8); }
    .contestant-column--right .ambient-spark--b { background: #ffd65a;  box-shadow: 0 0 6px #ffd65a, 0 0 12px rgba(255,130,0,0.85); }
    @keyframes sparkTwinkle {
      0%,100% { opacity: 0;   transform: scale(0.3); }
      40%     { opacity: 0.9; transform: scale(1); }
      60%     { opacity: 0.5; transform: scale(0.8); }
    }

    /* ── Capa de votos (dentro de la columna) ── */
    .vote-particle-layer { position: absolute; z-index: 8; inset: 0; overflow: hidden; pointer-events: none; }
    .vote-like--left  { color: #ffd33d; filter: drop-shadow(0 0 5px #ff1688) drop-shadow(0 0 14px rgba(255,0,120,0.9)); }
    .vote-like--right { color: #ffd33d; filter: drop-shadow(0 0 5px #ff8a00) drop-shadow(0 0 14px rgba(255,130,0,0.9)); }
    /* chispas que acompañan al voto real */
    .vote-spark--left  { background: radial-gradient(circle, #fff 0%, #ff72bd 70%); box-shadow: 0 0 6px #ff72bd, 0 0 12px rgba(255,0,120,0.9); }
    .vote-spark--right { background: radial-gradient(circle, #fff 0%, #ffd65a 70%); box-shadow: 0 0 6px #ffd65a, 0 0 12px rgba(255,130,0,0.9); }

    /* ── Info del participante (por encima de las partículas) ── */
    .contestant-info {
      position: relative; z-index: 15;
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding-top: clamp(18px, 2vh, 32px); pointer-events: none;
    }

    /* ── Barra del reparto 100% ──
       Absoluta sobre el grid (no es una celda más): no toca las 3 columnas ni
       el área del video. Fucsia = P1, naranja = P2; la división se mueve en
       realtime y la transition la lleva suave en los dos sentidos. */
    .duel-split {
      position: absolute; left: 0; right: 0; bottom: 0; z-index: 30;
      height: clamp(8px, 1.1vh, 14px);
      background: var(--right-color);
      box-shadow: 0 -2px 14px rgba(0,0,0,.55);
      pointer-events: none;
    }
    .duel-split-fill {
      height: 100%; background: var(--left-color);
      box-shadow: 2px 0 10px rgba(0,0,0,.5);
      transition: width .45s cubic-bezier(.4, 0, .2, 1);
    }
  `}</style>
);

/**
 * TalentDuelScreen — el Duelo en /tv y /pantalla (gráfica televisiva).
 *
 * Fases (faseDuelo, la misma que usan Admin y Cliente):
 *   convocatoria → logo oficial + QR chico abajo a la izquierda (nada más)
 *   voting       → duelistas, VS, video, aplausómetro, reloj si la ronda lo tiene
 *   result       → ganador o EMPATE según applause_sessions.result
 * Cancelar / cerrar deja la fase en convocatoria u `off` (la TV vuelve al DJ).
 *
 * Todo sale de Supabase: la ronda y sus totales (useDueloRound) y game_state.
 * Un F5 reconstruye la misma pantalla. El ganador NO se calcula acá.
 * La TV NO lee `duelo_postulaciones`: corre como anon y no tiene SELECT sobre
 * esa tabla; los postulantes los gestiona el Admin.
 *
 * `demo` (sólo Diseñador): { round, counts } de muestra; con él no se abre
 * ninguna suscripción.
 */
export default function TalentDuelScreen({ gameState, sessionId, webappUrl, demo = null }) {
  const live = useDueloRound(demo ? null : sessionId);
  const currentRound = demo ? demo.round : live.round;
  const counts = demo ? (demo.counts || { p1: 0, p2: 0 }) : live.counts;
  const nowMs = demo ? Date.now() : live.now;

  const fase = (() => {
    const f = faseDuelo(gameState, currentRound);
    return f === "off" ? null : f === "convocatoria" ? "inviting" : f;
  })();
  const [s1, s2] = duelistasDeRonda(currentRound);
  const seg = fase === "voting" ? segundosRestantes(currentRound, nowMs) : null;

  // ── Estado de partículas / pulsos / popups ──────────────────────────────────
  const [particles, setParticles]   = useState([]);
  const [prevCounts, setPrevCounts] = useState({ p1: 0, p2: 0 });
  const [pulse1, setPulse1] = useState({ key: 0, big: false });
  const [pulse2, setPulse2] = useState({ key: 0, big: false });
  const [popups, setPopups] = useState([]); // {id, slot, text, big}
  const initedRef = useRef(false);
  const idRef = useRef(0);
  const lastPulseRef = useRef({ 1: 0, 2: 0 });
  const spawnTimeoutsRef = useRef([]); // timeouts del spawn escalonado, para limpiar al desmontar
  const avatarRefs = { 1: useRef(null), 2: useRef(null) };

  const mk = (slot, isGroup, groupSize, kind = "thumb") => ({ id: `p${idRef.current++}`, slot, isGroup, groupSize, kind });

  const spawnForSlot = useCallback((slot, delta) => {
    // El cap 20/slot cuenta SOLO pulgares (los +1 y chispas acompañantes no cuentan).
    const active = particles.filter((p) => p.slot === slot && p.kind !== "plus" && p.kind !== "spark").length;
    const room = MAX_ACTIVE_PER_SLOT - active;

    let indiv, groupSize;
    if (room <= 0) {
      indiv = 0; groupSize = delta;
    } else if (delta <= room) {
      indiv = delta; groupSize = 0;
    } else {
      indiv = Math.max(0, room - 1); groupSize = delta - indiv;
    }

    if (groupSize > 0) {
      setParticles((prev) => [...prev, mk(slot, true, groupSize)]);
    }

    for (let i = 0; i < indiv; i++) {
      const to = setTimeout(() => {
        const companions = [mk(slot, false, 1, "thumb"), mk(slot, false, 1, "plus")];
        const nSparks = 1 + Math.floor(Math.random() * 3); // 1-3
        for (let k = 0; k < nSparks; k++) companions.push(mk(slot, false, 1, "spark"));
        setParticles((prev) => [...prev, ...companions]);
        spawnTimeoutsRef.current = spawnTimeoutsRef.current.filter((x) => x !== to);
      }, i * (120 + Math.random() * 80));
      spawnTimeoutsRef.current.push(to);
    }
  }, [particles]);

  useEffect(() => () => {
    spawnTimeoutsRef.current.forEach(clearTimeout);
    spawnTimeoutsRef.current = [];
  }, []);

  // Nuevos aplausos → partículas (el número se actualiza aparte, sin esperar la animación).
  useEffect(() => {
    if (fase !== "voting") { initedRef.current = false; return; }
    const p1 = counts?.p1 ?? 0, p2 = counts?.p2 ?? 0;
    if (!initedRef.current) {
      initedRef.current = true; setPrevCounts({ p1, p2 }); return;
    }
    const dP1 = p1 - prevCounts.p1, dP2 = p2 - prevCounts.p2;
    if (dP1 > 0) spawnForSlot(1, dP1);
    if (dP2 > 0) spawnForSlot(2, dP2);
    setPrevCounts({ p1, p2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts?.p1, counts?.p2, fase]);

  const onParticleDone = useCallback((particle) => {
    setParticles((prev) => prev.filter((p) => p.id !== particle.id));
    if (particle.kind === "plus" || particle.kind === "spark") return;
    const slot = particle.slot;
    const now = Date.now();
    if (!particle.isGroup && now - lastPulseRef.current[slot] < 100) return;
    lastPulseRef.current[slot] = now;
    (slot === 1 ? setPulse1 : setPulse2)((prev) => ({ key: prev.key + 1, big: particle.isGroup }));
    const pid = `pop${idRef.current++}`;
    setPopups((prev) => [...prev, { id: pid, slot, text: particle.isGroup ? `+${particle.groupSize}` : "+1", big: particle.isGroup }]);
    setTimeout(() => setPopups((prev) => prev.filter((p) => p.id !== pid)), 800);
  }, []);

  // Líder por aplausos absolutos (sólo para el brillo visual; no es el resultado).
  const c1 = counts?.p1 ?? 0, c2 = counts?.p2 ?? 0;
  const leader = c1 > c2 ? 1 : (c2 > c1 ? 2 : 0);
  const pct = porcentajesDuelo(counts);
  const prevLeaderRef = useRef(0);
  useEffect(() => {
    if (fase !== "voting") { prevLeaderRef.current = leader; return; }
    if (leader && leader !== prevLeaderRef.current && prevLeaderRef.current !== 0) {
      (leader === 1 ? setPulse1 : setPulse2)((p) => ({ key: p.key + 1, big: true }));
    }
    prevLeaderRef.current = leader;
  }, [leader, fase]);

  const keyframes = (
    <style>{`
      @keyframes dueloPop   { 0% { transform: scale(.3); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      @keyframes dueloWinnerIn { 0% { transform: scale(.6); opacity: 0; } 70% { transform: scale(1.06); opacity: 1; } 100% { transform: scale(1); } }
    `}</style>
  );

  if (!fase) return null;

  // ── CONVOCATORIA ────────────────────────────────────────────────────────────
  if (fase === "inviting") {
    return (
      <div style={{
        position: "absolute", inset: 0, overflow: "hidden",
        background: "radial-gradient(circle at 50% 30%, rgba(255,31,122,.18), rgba(8,4,15,1) 60%)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {keyframes}
        {/* Única identificación del juego: el logo oficial (asset existente). */}
        <img src={PLACA} alt="Duelo de Talentos"
          style={{ height: "68vh", maxWidth: "80vw", objectFit: "contain", animation: "dueloPop .5s ease" }}
          onError={(e) => { e.currentTarget.style.display = "none"; }} />

        {/* QR + leyenda: bloque compacto abajo a la izquierda. */}
        <div style={{
          position: "absolute", left: "2.2vw", bottom: "3vh",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "0.8vh",
          width: "clamp(110px, 8.5vw, 170px)",
        }}>
          <div style={{ background: "#fff", padding: "clamp(6px, 0.5vw, 10px)", borderRadius: 10, width: "100%", boxSizing: "border-box" }}>
            <QRCode value={`${webappUrl}/?view=games&game=duelo`} size={256}
              style={{ width: "100%", height: "auto", display: "block" }} />
          </div>
          <div style={{
            fontSize: "clamp(11px, 0.8vw, 16px)", fontWeight: 700, color: "#F0E8FF",
            textAlign: "center", lineHeight: 1.2,
          }}>Escaneame para postularte</div>
        </div>
      </div>
    );
  }

  // ── RESULTADO — `result` lo persistió duelo_finish_round ────────────────────
  if (fase === "result") {
    const result = currentRound?.result;
    const empate = result === "tie";
    const ganador = result === "p1" ? s1 : result === "p2" ? s2 : null;
    const colGanador = result === "p1" ? P1_COLOR : P2_COLOR;
    return (
      <div style={{
        position: "absolute", inset: 0,
        background: empate
          ? "radial-gradient(circle at 50% 40%, rgba(255,214,0,.16), rgba(8,4,15,1) 60%)"
          : `radial-gradient(circle at 50% 40%, ${colGanador}33, rgba(8,4,15,1) 62%)`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2.2vh",
      }}>
        {keyframes}
        {!result ? (
          <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: "clamp(30px,4vw,64px)", color: "#F0E8FF" }}>
            Contando aplausos…
          </div>
        ) : empate ? (
          <>
            <div style={{ fontSize: "clamp(60px,9vw,140px)", animation: "dueloWinnerIn .7s ease" }}>🤝</div>
            <div style={{
              fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: "clamp(60px,10vw,170px)",
              color: "#FFD600", letterSpacing: 4, animation: "dueloWinnerIn .7s ease",
            }}>¡EMPATE!</div>
            <div style={{ display: "flex", gap: "6vw", alignItems: "center" }}>
              {[{ s: s1, c: P1_COLOR }, { s: s2, c: P2_COLOR }].map(({ s, c }, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <Face emoji={s?.avatar_emoji} photo={s?.photo_url} size="clamp(90px,9vw,150px)" borderColor={c} />
                  <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: "clamp(22px,2.6vw,44px)", color: c }}>{s?.name}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{
              fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: "clamp(26px,3vw,52px)",
              color: "#F0E8FF", letterSpacing: 8, opacity: .85,
            }}>🏆 GANADOR 🏆</div>
            <div style={{ animation: "dueloWinnerIn .8s ease" }}>
              <Face emoji={ganador?.avatar_emoji} photo={ganador?.photo_url} size="clamp(150px,16vw,260px)" borderColor={colGanador} />
            </div>
            <div style={{
              fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: "clamp(56px,9vw,160px)",
              color: colGanador, textAlign: "center", lineHeight: 1,
              textShadow: `0 0 40px ${colGanador}aa`, animation: "dueloWinnerIn .8s ease",
            }}>{ganador?.name}</div>
          </>
        )}
        {result && (
          <div style={{
            fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "clamp(20px,2.4vw,38px)",
            color: "#F0E8FF", opacity: .8,
          }}>
            {s1?.name} · {pct.p1}% &nbsp;|&nbsp; {pct.p2}% · {s2?.name}
          </div>
        )}
      </div>
    );
  }

  // ── VOTACIÓN (3 columnas: P1 · video + VS + reloj · P2) ────────────────────
  // El video y los participantes salen de la ronda / game_state de ESTA ronda.
  const video = gameState?.duelo_video;
  const hasVideo = (video?.source === "youtube" && !!video?.yt_id)
                || (video?.source === "url"     && !!video?.video_url);

  return (
    <div className="duel-screen">
      {keyframes}
      {duelStyles}

      <ContestantColumn side="left" name={s1?.name || "—"} color={P1_COLOR} avatar={s1} percent={pct.p1}
        leader={c1 > c2} avatarRef={avatarRefs[1]} pulse={pulse1}
        popups={popups.filter((p) => p.slot === 1)}
        particles={particles.filter((p) => p.slot === 1)} onParticleDone={onParticleDone} />

      <main className="video-zone">
        <DuelHeader />
        {hasVideo ? (
          <div className="video-wrapper">
            <div className="youtube-player-container">
              <YouTubeVideoPlayer video={video} />
            </div>
          </div>
        ) : (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: "clamp(80px,11vw,200px)",
            color: "#F0E8FF", opacity: .9, textShadow: `0 0 30px ${P1_COLOR}, 0 0 60px ${P2_COLOR}`,
            pointerEvents: "none",
          }}>VS</div>
        )}
        {seg != null && (
          <div style={{
            position: "absolute", left: "50%", bottom: "4vh", transform: "translateX(-50%)", zIndex: 20,
            padding: "0.6vh 2.4vw", borderRadius: 999, background: "rgba(8,4,15,.78)",
            border: `2px solid ${seg <= 10 ? P1_COLOR : "rgba(240,232,255,.25)"}`,
            fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: "clamp(28px,3.4vw,64px)",
            color: seg <= 10 ? P1_COLOR : "#F0E8FF",
          }}>
            {seg > 0 ? `⏱ ${formatoReloj(seg)}` : "¡TIEMPO!"}
          </div>
        )}
      </main>

      <ContestantColumn side="right" name={s2?.name || "—"} color={P2_COLOR} avatar={s2} percent={pct.p2}
        leader={c2 > c1} avatarRef={avatarRefs[2]} pulse={pulse2}
        popups={popups.filter((p) => p.slot === 2)}
        particles={particles.filter((p) => p.slot === 2)} onParticleDone={onParticleDone} />

      <div className="duel-split">
        <div className="duel-split-fill" style={{ width: `${pct.p1}%` }} />
      </div>
    </div>
  );
}
