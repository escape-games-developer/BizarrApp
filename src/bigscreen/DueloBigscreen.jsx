import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import QrEsquina from "../components/QrEsquina";
import LogoCampana from "../components/LogoCampana";
import LogoJuego from "../components/LogoJuego";
import { ContestantColumn, duelStyles } from "./dueloColumna";
import { usePantallaLogo, usePantallaQr } from "../hooks/usePantallaQr";
import { useDueloRound } from "../hooks/realtime/useDueloRound";
import { useDueloPantalla, efectoDuelo, escalaDeZoom, EFECTOS_CSS } from "../hooks/useDueloPantalla";
import LienzoPantalla from "../lienzo/LienzoPantalla";
import { useLienzo } from "../lienzo/useLienzo";
import { AREAS_DUELO } from "../lienzo/datosDuelo";
import { separarColumnas } from "../lienzo/juegos/duelo";
import { normalizarPantalla } from "../lienzo/modelo";
import {
  faseDuelo, duelistasDeRonda, porcentajesDuelo, segundosRestantes, formatoReloj,
} from "../services/duelo";

// Diseñador → Escenario → Duelo (editor libre, fila lienzo_duelo).
const enPorcentaje = (el) => ({ left: `${(el.x / 1920) * 100}%`, top: `${(el.y / 1080) * 100}%`,
  width: `${(el.w / 1920) * 100}%`, height: `${(el.h / 1080) * 100}%` });
// Las columnas usan sus anchos/altos de siempre como variables: adentro de su caja, la caja entera.
const VARIABLES_CAJA = { "--izq-ancho": "100%", "--izq-alto": "100%", "--der-ancho": "100%", "--der-alto": "100%" };

const P1_COLOR = "#ff1688"; // Participante 1 — fucsia
const P2_COLOR = "#ff8a00"; // Participante 2 — naranja
const PLACA    = "/placas/Duelo_de_talento-removebg-preview.png";
const LOGO_APP  = "/logo.png";
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
        className="duel-fondo-video"
        allow="autoplay; encrypted-media"
      />
    );
  }
  if (video?.source === "url" && video?.video_url) {
    return (
      <video src={video.video_url} autoPlay muted loop playsInline className="duel-fondo-video" />
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

// ── DuelHeader — logo de BizarrApp centrado arriba del área central ──
// El logo «Duelo de Talentos» ya no va: lo que identifica al juego es el centro
// (texto o imagen configurable desde el Admin).
function DuelHeader({ conLogoApp = true }) {
  return (
    <div className="center-header">
      {conLogoApp && <img className="bizarrapp-logo" src={LOGO_APP} alt="BizarrApp"
        onError={(e) => { e.currentTarget.style.display = "none"; }} />}
    </div>
  );
}

/**
 * TalentDuelScreen — el Duelo en /tv y /pantalla (gráfica televisiva).
 *
 * Fases (faseDuelo, la misma que usan Admin y Cliente):
 *   convocatoria → la placa de anuncio `duelo` (prop `placa`, la arma quien
 *                  monta esto con su PlacaScreen). Sin `placa`: logo + QR.
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
export default function TalentDuelScreen({ gameState, sessionId, webappUrl, demo = null, placa = null }) {
  const live = useDueloRound(demo ? null : sessionId);
  // Diseñador → QR y logo del juego: el QR de la convocatoria se puede ocultar.
  const mostrarQr   = usePantallaQr().duelo !== false;
  const mostrarLogo = usePantallaLogo().duelo !== false;
  // Admin → Duelo → Pantalla del duelo: centro (texto/imagen) y 👍 + %.
  const pantalla = useDueloPantalla();
  const efecto = efectoDuelo(pantalla.efecto);
  const estiloEfecto = { animation: efecto.anim, transformOrigin: efecto.origen || "50% 50%",
    willChange: efecto.id === "ninguno" ? "auto" : "transform" };
  const lienzo = useLienzo("duelo");
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

  // Líder por porcentaje (sólo para el brillo visual; no es el resultado).
  const pct = porcentajesDuelo(counts);
  const c1 = pct.p1, c2 = pct.p2;
  const leader = c1 > c2 ? 1 : (c2 > c1 ? 2 : 0);
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
      @keyframes dueloVotePopup { 0% { transform: translateY(0) scale(.8); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(-30px) scale(1.1); opacity: 0; } }
      @keyframes dueloWinnerIn { 0% { transform: scale(.6); opacity: 0; } 70% { transform: scale(1.06); opacity: 1; } 100% { transform: scale(1); } }
    `}</style>
  );

  if (!fase) return null;

  // ── CONVOCATORIA ────────────────────────────────────────────────────────────
  // Anunciar abre la convocatoria y la pantalla muestra la placa del anuncio:
  // no hay una pantalla de convocatoria aparte.
  if (fase === "inviting" && placa) return placa;
  if (fase === "inviting") {
    return (
      <div style={{
        position: "absolute", inset: 0, overflow: "hidden",
        background: "radial-gradient(circle at 50% 30%, rgba(255,31,122,.18), rgba(8,4,15,1) 60%)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {keyframes}
        {/* Logo BizarrApp con campana, igual que las demás convocatorias
            (Diseñador → QR y logo del juego). */}
        {mostrarLogo && <LogoCampana src={LOGO_APP}/>}
        {/* Única identificación del juego: el logo oficial (asset existente). */}
        <LogoJuego src={PLACA} alt="Duelo de Talentos"
          style={{ height: "68vh", maxWidth: "80vw" }}/>

        {/* QR + leyenda abajo a la izquierda: el mismo bloque que el resto de
            los juegos (QrEsquina). */}
        {mostrarQr && <QrEsquina url={`${webappUrl}/?view=games&game=duelo`} texto="Escaneá para postularte"/>}
      </div>
    );
  }

  // ── RESULTADO — `result` lo persistió duelo_finish_round ────────────────────
  if (fase === "result") {
    const result = currentRound?.result;
    const editada = result ? lienzo[result === "tie" ? "empate" : "ganador"] : null;
    if (editada) return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <LienzoPantalla pantalla={editada} datos={{ vivo: true, d1: s1, d2: s2, pct, result }} llenar/>
      </div>
    );
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

  // ── VOTACIÓN: FONDO + MÁSCARA ──────────────────────────────────────────────
  // Fondo: el video de ESTA ronda a pantalla completa; sin video, la imagen de
  // fondo del Admin; sin imagen, negro. Máscara (siempre encima): paneles,
  // barómetros, avatares, logo de BizarrApp, logo de duelo y reloj.
  const video = gameState?.duelo_video;
  const hasVideo = (video?.source === "youtube" && !!video?.yt_id)
                || (video?.source === "url"     && !!video?.video_url);

  // Layout del Admin → variables CSS de .duel-screen.
  const layout = {
    "--izq-ancho": `${pantalla.panelIzq.ancho}vw`, "--izq-alto": `${pantalla.panelIzq.alto}%`,
    "--der-ancho": `${pantalla.panelDer.ancho}vw`, "--der-alto": `${pantalla.panelDer.alto}%`,
    "--baro-escala": pantalla.barometro.ancho / 100,
    "--baro-alto": `${pantalla.barometro.alto}%`, "--baro-y": `${pantalla.barometro.y}%`,
    "--baro-x": `${pantalla.barometro.x}%`,
  };
  // Logo de duelo: arriba / centro / abajo del área central, con su zoom.
  const alinear = { arriba: "flex-start", centro: "center", abajo: "flex-end" }[pantalla.logoPos];
  const altoLogo = pantalla.logoPos === "centro" ? "100%" : "45%";
  const escala = escalaDeZoom(pantalla.zoom);

  // Votación editada en el lienzo: el video y las columnas (áreas) en sus
  // cajas, dibujados como siempre; el resto del diseño encima.
  if (lienzo.votacion) {
    // Los diseños con la columna entera se ven ya con sus piezas sueltas.
    const pv = normalizarPantalla(separarColumnas(lienzo.votacion, pantalla));
    const els = pv.elementos.map((e) => (e.id === "logo-app" && !mostrarLogo ? { ...e, visible: false } : e));
    // Capas en el orden del editor: cada área (video, efectos) en su caja, a
    // tamaño real; los tramos de elementos entre áreas, en un lienzo cada uno.
    const capas = [];
    let tramo = [];
    const cerrar = () => { if (tramo.length) capas.push({ lienzo: tramo }); tramo = []; };
    for (const e of els) {
      if (e.tipo === "dato" && AREAS_DUELO.has(e.dato)) { cerrar(); capas.push({ area: e }); } else tramo.push(e);
    }
    cerrar();
    const datosVivos = { vivo: true, centro: pantalla, seg, d1: s1, d2: s2, pct,
      duelo: { avatarRefs, pulsos: { 1: pulse1, 2: pulse2 }, popups, lider: leader } };
    const deSlot = (slot) => ({ side: slot === 1 ? "left" : "right", color: slot === 1 ? P1_COLOR : P2_COLOR,
      avatarRef: avatarRefs[slot], pulse: slot === 1 ? pulse1 : pulse2,
      particles: particles.filter((p) => p.slot === slot), onParticleDone });
    const area = (a, z) => {
      if (!a.visible) return null;
      const caja = { position: "absolute", ...enPorcentaje(a), zIndex: z };
      if (a.dato === "duVideo") return (
        <div key={a.id} className="duel-fondo" style={{ ...caja, inset: "auto", ...enPorcentaje(a),
          ...(!hasVideo && pantalla.fondo ? { backgroundImage: `url("${pantalla.fondo}")` } : {}) }}>
          {hasVideo && <YouTubeVideoPlayer video={video} />}
        </div>
      );
      const slot = a.dato.endsWith("1") ? 1 : 2;
      return (
        <div key={a.id} style={{ ...caja, ...VARIABLES_CAJA }}>
          <ContestantColumn soloEfectos {...deSlot(slot)} />
        </div>
      );
    };
    return (
      <div className="duel-screen" style={layout}>
        {keyframes}
        {duelStyles}
        <style>{EFECTOS_CSS}</style>
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <LienzoPantalla pantalla={{ ...pv, elementos: [] }} llenar/>
        </div>
        {capas.map((c, i) => (c.area ? area(c.area, i + 1) : (
          <div key={c.lienzo[0].id} style={{ position: "absolute", inset: 0, zIndex: i + 1, pointerEvents: "none" }}>
            <LienzoPantalla pantalla={{ ...pv, elementos: c.lienzo }} datos={datosVivos} sinFondo llenar/>
          </div>
        )))}
      </div>
    );
  }

  return (
    <div className="duel-screen" style={layout}>
      {keyframes}
      {duelStyles}
      <style>{EFECTOS_CSS}</style>

      <div className="duel-fondo"
        style={!hasVideo && pantalla.fondo ? { backgroundImage: `url("${pantalla.fondo}")` } : undefined}>
        {hasVideo && <YouTubeVideoPlayer video={video} />}
      </div>

      <ContestantColumn side="left" name={s1?.name || "—"} color={P1_COLOR} avatar={s1} percent={pct.p1}
        conPorcentaje={pantalla.porcentajes}
        leader={c1 > c2} avatarRef={avatarRefs[1]} pulse={pulse1}
        popups={popups.filter((p) => p.slot === 1)}
        particles={particles.filter((p) => p.slot === 1)} onParticleDone={onParticleDone} />

      <main className="video-zone">
        <DuelHeader conLogoApp={mostrarLogo} />
        {/* Logo de duelo (texto o imagen): siempre en la máscara, también con
            video. Tres capas: posición → zoom → efecto, para que el efecto
            no pise el zoom ni el drop-shadow. */}
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          justifyContent: alinear, alignItems: "center",
          padding: "var(--header-height) 3vw 13vh", boxSizing: "border-box", pointerEvents: "none",
        }}>
          <div style={{ width: "100%", height: altoLogo, display: "flex", alignItems: "center",
            justifyContent: "center", transform: `scale(${escala})`, transition: "transform .3s ease" }}>
            <div style={{ ...estiloEfecto, width: "100%", height: "100%",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              {pantalla.centro === "imagen" && pantalla.imagen ? (
                <img src={pantalla.imagen} alt="" style={{
                  maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
                  filter: `drop-shadow(0 0 24px ${P1_COLOR}88) drop-shadow(0 0 40px ${P2_COLOR}66)`,
                }}/>
              ) : (
                <div style={{
                  fontFamily: "Syne, sans-serif", fontWeight: 900, textAlign: "center", lineHeight: 1.05,
                  fontSize: pantalla.texto.length > 10 ? "clamp(44px,5.4vw,120px)" : "clamp(60px,8vw,170px)",
                  letterSpacing: ".04em", color: "#F0E8FF", opacity: .92,
                  textShadow: `0 0 30px ${P1_COLOR}, 0 0 60px ${P2_COLOR}`,
                }}>{pantalla.texto}</div>
              )}
            </div>
          </div>
        </div>
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
        conPorcentaje={pantalla.porcentajes}
        leader={c2 > c1} avatarRef={avatarRefs[2]} pulse={pulse2}
        popups={popups.filter((p) => p.slot === 2)}
        particles={particles.filter((p) => p.slot === 2)} onParticleDone={onParticleDone} />
    </div>
  );
}
