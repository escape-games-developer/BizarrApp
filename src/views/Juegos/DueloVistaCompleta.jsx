import React, { useState } from "react";
import { useDueloPostulaciones } from "../../hooks/realtime/useDueloPostulaciones";
import { useDueloRound, useToquesDuelo, useVotoDuelo } from "../../hooks/realtime/useDueloRound";
import ContenedorPostulacion from "../../components/ContenedorPostulacion";
import {
  faseDuelo, duelistasDeRonda, porcentajesDuelo, segundosRestantes, formatoReloj, modoDeRonda, anchoBarraP1,
} from "../../services/duelo";

// Cómo se vota en cada modo (ver MODOS_DUELO).
const TEXTO_MODO = {
  toques: { consigna: "Tocá sin parar al que más te guste: cuantos más toques, más porcentaje" },
  votos:  { consigna: "Votá a uno de los dos. Podés cambiar tu voto hasta que termine" },
};

const DUELO_LOGO = "/placas/Duelo_de_talento-removebg-preview.png";
const PINK = "#FF2D95";
const ORANGE = "#FF9500";

// Cara de un duelista de la ronda ({ name, avatar_emoji, photo_url }).
function SlotFace({ slot, color, size = 68 }) {
  const base = {
    width: size, height: size, borderRadius: "50%", margin: "0 auto",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.46, overflow: "hidden",
    background: "rgba(20,8,30,.6)", border: `2px solid ${color}`,
    boxShadow: `0 0 16px ${color}66`,
  };
  if (slot?.photo_url) {
    return (
      <div style={base}>
        <img src={slot.photo_url} alt={slot.name || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }
  return <div style={base}>{slot?.avatar_emoji || "🎤"}</div>;
}

function SplitBar({ p1 }) {
  return (
    <div style={{
      marginTop: 12, height: 10, borderRadius: 999, overflow: "hidden",
      background: ORANGE, border: "1px solid rgba(255,255,255,.1)",
    }}>
      <div style={{ width: `${p1}%`, height: "100%", background: PINK, transition: "width .45s cubic-bezier(.4,0,.2,1)" }} />
    </div>
  );
}

const cajaCentro = {
  textAlign: "center", padding: "26px 18px", borderRadius: 18,
  background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)",
};

/**
 * DueloVistaCompleta — vista de cliente del Duelo de Talentos V1.
 *
 * Todo se deriva de Supabase (nada importante vive sólo en React):
 *   · fase          → game_state.active_escenario + última ronda 'duelo'
 *   · postulación   → duelo_postulaciones (mi fila)
 *   · votación      → applause_sessions + applause_counts
 *   · resultado     → applause_sessions.result (lo decide el servidor)
 *   · mis votos     → applause_add (toques) / duelo_votar (voto único)
 */
// `demo` (sólo vista previa del Diseñador): { misPostulacion, round, counts }
// de muestra. Con él no se consulta ni se vota nada; en la app llega null.
export default function DueloVistaCompleta({ sessionId, user, activeEscenario, gameState, onBack, estiloCards = true, demo = null }) {
  const sesion = demo ? null : sessionId;
  const postulaciones = useDueloPostulaciones(sesion, user);
  const ronda = useDueloRound(sesion, { autoFinish: !demo });
  const { misPostulacion, postularme, error } = demo
    ? { misPostulacion: demo.misPostulacion ?? null, postularme: async () => {}, error: null }
    : postulaciones;
  const { round, counts, now, vencida } = demo
    ? { round: demo.round ?? null, counts: demo.counts ?? { p1: 0, p2: 0 }, now: Date.now(), vencida: false }
    : ronda;
  const toques = useToquesDuelo(demo ? null : round);
  const voto = useVotoDuelo(demo ? null : round, user?.id || null);
  const [enviando, setEnviando] = useState(false);

  const fase = faseDuelo({ ...gameState, active_escenario: activeEscenario }, round);
  const [d1, d2] = duelistasDeRonda(round);
  const pct = porcentajesDuelo(counts);
  const modo = modoDeRonda(round);
  const bloqueo = modo === "votos" ? voto.bloqueo : toques.bloqueo;

  const header = (
    // data-titulo-seccion: se oculta con Ajustes → General → títulos apagado.
    <div data-titulo-seccion style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
      {/* Sin `onBack` el Duelo ocupa Juegos entero: no hay a dónde volver. */}
      {onBack && <button onClick={onBack} style={{
        background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)",
        borderRadius: 10, padding: "7px 12px", color: "#F0E8FF",
        fontSize: 13, fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent",
      }}>← Volver</button>}
      <h3 style={{ fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 17, color: PINK, margin: 0 }}>
        Duelo de Talentos
      </h3>
    </div>
  );

  // Cartel de fin de ronda, debajo del resultado. Cuando el admin vuelve a la
  // placa, la vista pasa sola a la convocatoria (Postularme).
  const proximaRonda = (
    <div style={{
      marginTop: 14, padding: "14px 16px", borderRadius: 14, textAlign: "center",
      background: "rgba(255,214,0,.07)", border: "1px solid rgba(255,214,0,.3)",
      fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 15, color: "#FFD600",
    }}>
      ⏳ Esperá la próxima ronda
    </div>
  );

  // ── Duelo fuera del escenario ────────────────────────────────────────────
  if (fase === "off") {
    return (
      <div>
        {header}
        <div style={{ textAlign: "center", padding: "40px 16px", color: "rgba(245,230,192,.4)", fontSize: 13 }}>
          El duelo no está activo ahora.
        </div>
      </div>
    );
  }

  // ── Votación ─────────────────────────────────────────────────────────────
  if (fase === "voting") {
    const soyDuelista = !!user?.id && (round.p1_user_id === user.id || round.p2_user_id === user.id);
    const seg = segundosRestantes(round, now);
    const lados = [
      { slot: 1, s: d1, color: PINK,   pct: pct.p1 },
      { slot: 2, s: d2, color: ORANGE, pct: pct.p2 },
    ];
    const reloj = seg == null ? null : (
      <div style={{
        textAlign: "center", fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 22,
        color: seg <= 10 ? PINK : "#F0E8FF", marginBottom: 10,
      }}>
        {seg > 0 ? `⏱ ${formatoReloj(seg)}` : "¡Tiempo!"}
      </div>
    );
    const vs = (
      <div style={{
        textAlign: "center", fontFamily: "Syne, sans-serif", fontWeight: 900,
        fontSize: 13, color: "rgba(245,230,192,.5)", letterSpacing: 2, marginBottom: 10,
      }}>
        {d1?.name} <span style={{ color: PINK }}>VS</span> {d2?.name}
      </div>
    );

    // El duelista ve el marcador, sin botones: no vota (lo impide el backend).
    if (soyDuelista || bloqueo === "DUELIST_CANNOT_VOTE") {
      return (
        <div>
          {header}
          {reloj}
          <div style={{
            textAlign: "center", padding: "22px 18px", borderRadius: 18, marginBottom: 14,
            background: "linear-gradient(135deg, rgba(255,45,149,.18), rgba(255,149,0,.10))",
            border: `2px solid ${PINK}`,
          }}>
            <div style={{ fontSize: 40, marginBottom: 6 }}>🎤</div>
            <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 18, color: PINK, marginBottom: 4 }}>
              ESTÁS EN EL ESCENARIO
            </div>
            <div style={{ fontSize: 13, color: "rgba(245,230,192,.6)", lineHeight: 1.5 }}>
              ¡Dalo todo! Los duelistas no votan: el público decide.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {lados.map(({ slot, s, color, pct: valor }) => (
              <div key={slot} style={{
                flex: 1, padding: "16px 8px", borderRadius: 18, textAlign: "center",
                border: `2px solid ${color}55`, background: `${color}10`,
              }}>
                <SlotFace slot={s} color={color} />
                <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 14, color, marginTop: 8 }}>{s?.name}</div>
                <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 26, color: "#F0E8FF", marginTop: 4 }}>{valor}%</div>
              </div>
            ))}
          </div>
          <SplitBar p1={anchoBarraP1(pct)} />
        </div>
      );
    }

    const cerrada = vencida || bloqueo === "CLOSED";
    const sinSaldo = modo === "toques" && (bloqueo === "LIMIT_REACHED" || toques.restante === 0);
    const deshabilitado = cerrada || sinSaldo || bloqueo === "NOT_PRESENT" || bloqueo === "ERROR"
      || (modo === "votos" && voto.enviando);

    // Tocar a un participante: un toque más (Mod 1) o el voto único (Mod 2).
    const votarA = (slot) => {
      if (modo === "votos") { voto.votar(slot); if (navigator.vibrate) navigator.vibrate(20); return; }
      if (toques.tap(slot) && navigator.vibrate) navigator.vibrate(12);
    };

    let saldo;
    if (cerrada) saldo = "Se cerró la votación. Esperando el resultado…";
    else if (bloqueo === "NOT_PRESENT") saldo = "Tenés que estar conectado a la sesión para votar.";
    else if (bloqueo === "ERROR") saldo = "No pudimos registrar tu voto.";
    else if (modo === "votos") saldo = voto.miVoto
      ? `Votaste a ${voto.miVoto === 1 ? d1?.name : d2?.name} ✓ Podés cambiar tu voto`
      : "Todavía no votaste";
    else if (sinSaldo) saldo = "Ya usaste todos tus toques";
    else if (toques.limite != null) saldo = `Te quedan ${toques.restante} toque${toques.restante === 1 ? "" : "s"}`;
    else saldo = toques.mios > 0 ? `Llevás ${toques.mios} toque${toques.mios === 1 ? "" : "s"}` : "Toques sin límite";

    return (
      <div>
        {header}
        <style>{`
          @keyframes dueloTapPop { 0%{transform:scale(1)} 45%{transform:scale(.95)} 100%{transform:scale(1)} }
          .duelo-tap:active:not(:disabled) { animation: dueloTapPop .16s ease-out; }
        `}</style>
        {reloj}
        {vs}
        <div style={{ textAlign: "center", fontSize: 13, color: "rgba(245,230,192,.6)", marginBottom: 12 }}>
          {TEXTO_MODO[modo].consigna}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {lados.map(({ slot, s, color, pct: valor }) => {
            const elegido = modo === "votos" && voto.miVoto === slot;
            return (
              <button key={slot} className="duelo-tap" disabled={deshabilitado} onClick={() => votarA(slot)}
                aria-label={`${modo === "votos" ? "Votar a" : "Tocar a"} ${s?.name || `participante ${slot}`}`}
                style={{
                  flex: 1, padding: "20px 8px", borderRadius: 18,
                  cursor: deshabilitado ? "default" : "pointer", opacity: deshabilitado ? 0.55 : 1,
                  border: `${elegido ? 3 : 2}px solid ${color}`, background: elegido ? `${color}33` : `${color}14`,
                  boxShadow: elegido ? `0 0 18px ${color}88` : "none",
                  WebkitTapHighlightColor: "transparent", touchAction: "manipulation", userSelect: "none",
                }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color, marginBottom: 6 }}>
                  {elegido ? "✓ TU VOTO" : `PARTICIPANTE ${slot}`}
                </div>
                <SlotFace slot={s} color={color} />
                <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 14, color, marginTop: 8 }}>{s?.name}</div>
                <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 26, color: "#F0E8FF", marginTop: 4 }}>{valor}%</div>
                <div style={{ fontSize: 11, fontWeight: 700, color, marginTop: 6 }}>
                  {modo === "votos" ? (elegido ? "Tu voto" : "Votar") : "¡Tocá!"}
                </div>
              </button>
            );
          })}
        </div>
        <SplitBar p1={anchoBarraP1(pct)} />
        <div style={{
          marginTop: 14, textAlign: "center", fontSize: 14, fontWeight: 700,
          color: cerrada || sinSaldo ? "rgba(245,230,192,.5)" : "#F0E8FF",
        }}>
          {saldo}
        </div>
      </div>
    );
  }

  // ── Resultado (lo decide el servidor: round.result) ─────────────────────
  if (fase === "result") {
    const empate = round.result === "tie";
    const ganador = round.result === "p1" ? d1 : round.result === "p2" ? d2 : null;
    return (
      <div>
        {header}
        <div style={{
          textAlign: "center", padding: "34px 20px", borderRadius: 20,
          background: "linear-gradient(135deg, rgba(0,245,160,.14), rgba(255,45,149,.08))",
          border: "1px solid rgba(0,245,160,.35)",
        }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>{empate ? "🤝" : "🏆"}</div>
          <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 20, color: empate ? "#FFD600" : "#00F5A0" }}>
            {empate ? "¡Empate!" : ganador ? `Ganó ${ganador.name}` : "Calculando resultado…"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          {[{ slot: 1, s: d1, color: PINK, valor: pct.p1, gano: round.result === "p1" },
            { slot: 2, s: d2, color: ORANGE, valor: pct.p2, gano: round.result === "p2" }].map(({ slot, s, color, valor, gano }) => (
            <div key={slot} style={{
              flex: 1, padding: "14px 8px", borderRadius: 16, textAlign: "center",
              background: `${color}10`, border: `2px solid ${gano ? color : `${color}44`}`,
            }}>
              <SlotFace slot={s} color={color} size={52} />
              <div style={{ fontSize: 12.5, fontWeight: 700, color, marginTop: 6 }}>{s?.name}</div>
              <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 20, color: "#F0E8FF", marginTop: 2 }}>{valor}%</div>
            </div>
          ))}
        </div>
        {proximaRonda}
      </div>
    );
  }

  // ── Convocatoria ─────────────────────────────────────────────────────────
  // El cliente NO ve cuántos se postularon ni quiénes: sólo su botón o su
  // estado. La lista es del Admin.

  const handlePostularme = async () => {
    if (enviando) return;
    setEnviando(true);
    try { await postularme(); }
    finally { setEnviando(false); }
  };

  if (!misPostulacion) {
    // Mismo contenedor que FTL y PT: toda la sección, botón adentro.
    return (
      <ContenedorPostulacion
        id="duelo" logo={DUELO_LOGO} alt="Duelo de Talentos"
        titulo="¿Te animás a subir al escenario? Postulate y esperá que el staff te elija."
        textoBoton="🎤 Postularme" cargando={enviando} onPostular={handlePostularme}
        estiloCards={estiloCards} error={error} arriba={header}
        propio={{ bg: "linear-gradient(135deg, rgba(255,45,149,.12), rgba(255,149,0,.08))",
          borde: "rgba(255,45,149,.4)", texto: "rgba(245,230,192,.75)",
          boton: "linear-gradient(135deg, #FF2D95, #FF9500)" }}
      />
    );
  }

  if (misPostulacion.status === "rejected") {
    return (
      <div>
        {header}
        <div style={cajaCentro}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>⏸️</div>
          <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 16, color: "rgba(245,230,192,.6)", marginBottom: 6 }}>
            Tu postulación no está activa
          </div>
          <div style={{ fontSize: 13, color: "rgba(245,230,192,.4)" }}>Pedile al staff que te vuelva a sumar.</div>
        </div>
      </div>
    );
  }

  // waiting, o selected justo antes de que arranque la votación. Al terminar
  // la ronda la base BORRA la postulación de los dos que subieron (migración
  // 20261020150000), así que vuelven a ver «Postularme».
  return (
    <div>
      {header}
      <div style={{
        textAlign: "center", padding: "18px 16px", borderRadius: 16,
        background: "rgba(255,45,149,.08)", border: "1px solid rgba(255,45,149,.3)", marginBottom: 18,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: PINK, marginBottom: 4 }}>
          ⏳ Estás postulado
        </div>
        <div style={{ fontSize: 12.5, color: "rgba(245,230,192,.5)" }}>
          {misPostulacion.status === "selected"
            ? "¡Te eligieron! Preparate para subir al escenario."
            : "Esperando que el staff elija a los participantes…"}
        </div>
      </div>
    </div>
  );
}
