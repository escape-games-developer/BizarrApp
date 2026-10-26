import { useState, useEffect, useRef } from "react";
import FtlBarometro from "../components/FtlBarometro";

/**
 * La columna de cada duelista en la votación del Duelo (avatar, nombre, 👍 %,
 * barómetro, partículas y la lluvia de 👍), con su CSS. La usan la TV
 * (DueloBigscreen) y el editor de pantallas, que la muestra de ejemplo en las
 * cajas «Columna del duelista» (datosDuelo.jsx).
 */

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
function ContestantInfo({ name, color, avatar, percent, side, leader, avatarRef, pulse, popups, conPorcentaje = true }) {
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
      {/* 👍 + % activable desde el Admin (Duelo → Pantalla del duelo). */}
      {conPorcentaje && <LikeCounter percent={percent} color={color} numberColor={isLeft ? "#ff258e" : "#ff9100"} />}
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
// `soloEfectos`: sin fondo, sin avatar/nombre/% y sin barómetro — la capa
// «Efectos del duelista» del editor, con esas piezas sueltas por encima.
export function ContestantColumn({ side, name, color, avatar, percent, leader, avatarRef, pulse, popups, particles, onParticleDone, conPorcentaje = true, soloEfectos = false }) {
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
    <div className={`contestant-column contestant-column--${side}${soloEfectos ? " contestant-column--efectos" : ""}`}>
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
      {!soloEfectos && <ContestantInfo name={name} color={color} avatar={avatar} percent={percent} side={side}
        leader={leader} avatarRef={avatarRef} pulse={pulse} popups={popups} conPorcentaje={conPorcentaje} />}
      {/* Barómetro vertical de Follow the Leader con el % de este participante.
          No decae: en el Duelo el % sólo cambia cuando el público vota. */}
      {!soloEfectos && <div className="column-barometro">
        <FtlBarometro pct={percent} tamano="tv" decae={false} />
      </div>}
      <div ref={glowRef} className="column-bottom-glow" />
    </div>
  );
}

// ── CSS del duelo (columnas por capas + logos header). Inline no alcanza para ─────
// ::after, mask-image ni repeating-gradient, así que se inyecta como bloque <style>.
export const duelStyles = (
  <style>{`
    .duel-screen {
      --left-color: #ff087f;  --left-bright: #ff3ca2;  --left-dark: #260016;
      --right-color: #ff8a00; --right-bright: #ffb000; --right-dark: #291300;
      --header-height: clamp(108px, 13vh, 145px);
      /* Layout editable (Admin → Duelo → Pantalla del duelo). Los pone el
         componente con style; acá, los valores de siempre. */
      --izq-ancho: 15vw; --izq-alto: 100%;
      --der-ancho: 15vw; --der-alto: 100%;
      --baro-escala: 1; --baro-alto: 60%; --baro-y: 64%; --baro-x: 50%;
      position: absolute; inset: 0; height: 100%;
      overflow: hidden; background: #050308;
    }

    /* ── FONDO: video a pantalla completa, o imagen de fondo, o negro ── */
    .duel-fondo {
      position: absolute; inset: 0; z-index: 0; overflow: hidden;
      container-type: size; background: #050308 center / cover no-repeat;
    }
    /* El video cubre todo (como background-size: cover), sin franjas negras. */
    .duel-fondo-video {
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: max(100cqw, 177.78cqh); height: max(100cqh, 56.25cqw);
      border: 0; object-fit: cover; pointer-events: none;
    }

    /* ── MÁSCARA, área central entre los paneles: logos + reloj ── */
    .video-zone {
      position: absolute; top: 0; bottom: 0; z-index: 12;
      left: var(--izq-ancho); right: var(--der-ancho);
      min-width: 0; overflow: hidden; pointer-events: none;
    }
    .center-header {
      position: relative; width: 100%;
      height: var(--header-height); min-height: var(--header-height);
      z-index: 20; pointer-events: none;
    }
    .bizarrapp-logo {
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      height: clamp(103px, 9vw, 165px); width: auto; object-fit: contain;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,.85)) drop-shadow(0 0 12px rgba(255,190,0,.18));
    }
    /* ── MÁSCARA, paneles laterales: ancho y alto por lado, centrados en vertical ── */
    .contestant-column {
      position: absolute; top: 50%; transform: translateY(-50%); z-index: 10;
      overflow: hidden; isolation: isolate;
    }
    .contestant-column--left  { left: 0;  width: var(--izq-ancho); height: var(--izq-alto); }
    .contestant-column--right { right: 0; width: var(--der-ancho); height: var(--der-alto); }

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

    /* Capa de efectos sola: el fondo es una imagen del editor, debajo. */
    .contestant-column.contestant-column--efectos { background: none; }
    .contestant-column.contestant-column--efectos::after { display: none; }

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
    /* Barómetro: ancho, alto y ubicación editables. La horizontal se espeja:
       --baro-x se mide desde el borde EXTERIOR de cada panel (izquierda en el
       panel izquierdo, derecha en el derecho), así los dos quedan simétricos. */
    .column-barometro {
      position: absolute; z-index: 14; transform: translate(-50%, -50%);
      top: var(--baro-y); height: var(--baro-alto);
      width: calc(clamp(34px, 3.1vw, 60px) * var(--baro-escala)); pointer-events: none;
    }
    .contestant-column--left  .column-barometro { left: var(--baro-x); }
    .contestant-column--right .column-barometro { left: calc(100% - var(--baro-x)); }
    .contestant-info {
      position: relative; z-index: 15;
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding-top: clamp(18px, 2vh, 32px); pointer-events: none;
    }
  `}</style>
);

const P1_COLOR = "#ff1688"; // Participante 1 — fucsia (igual que DueloBigscreen)
const P2_COLOR = "#ff8a00"; // Participante 2 — naranja
const MUESTRA = { 1: { name: "Vale", avatar_emoji: "💃", percent: 58 }, 2: { name: "Nico", avatar_emoji: "🎸", percent: 42 } };
const SIN_PARTICULAS = [];
const nada = () => {};

/**
 * Una columna de ejemplo para el editor (o con los datos reales si llegan):
 * llena su caja. `config` es la de «Pantalla del duelo» (barómetro, 👍 %).
 */
export function ColumnaDuelo({ slot, duelista, percent, config }) {
  const avatarRef = useRef(null);
  const m = MUESTRA[slot];
  const s = duelista || m;
  const pct = percent ?? m.percent;
  const b = config?.barometro;
  const vars = { "--izq-ancho": "100%", "--izq-alto": "100%", "--der-ancho": "100%", "--der-alto": "100%",
    ...(b ? { "--baro-escala": b.ancho / 100, "--baro-alto": `${b.alto}%`, "--baro-y": `${b.y}%`, "--baro-x": `${b.x}%` }
      : { "--baro-escala": 1, "--baro-alto": "60%", "--baro-y": "64%", "--baro-x": "50%" }) };
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...vars }}>
      {duelStyles}
      <ContestantColumn side={slot === 1 ? "left" : "right"} name={s.name} color={slot === 1 ? P1_COLOR : P2_COLOR}
        avatar={s} percent={pct} leader={pct > 50} avatarRef={avatarRef} pulse={null} popups={SIN_PARTICULAS}
        particles={SIN_PARTICULAS} onParticleDone={nada} conPorcentaje={config ? config.porcentajes : true}/>
    </div>
  );
}

/**
 * «Efectos del duelista»: partículas, líneas de energía, brillo de abajo y la
 * lluvia de 👍 que vuela hasta `avatarRef` (la cara, otra pieza del diseño).
 * Transparente: llena su caja. En el editor, sin `particles`, es de muestra.
 */
export function EfectosDuelo({ slot, particles = SIN_PARTICULAS, onParticleDone = nada, avatarRef, pulse = null }) {
  const propio = useRef(null);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden",
      "--izq-ancho": "100%", "--izq-alto": "100%", "--der-ancho": "100%", "--der-alto": "100%" }}>
      {duelStyles}
      <ContestantColumn soloEfectos side={slot === 1 ? "left" : "right"} color={slot === 1 ? P1_COLOR : P2_COLOR}
        avatarRef={avatarRef || propio} pulse={pulse} particles={particles} onParticleDone={onParticleDone}/>
    </div>
  );
}
