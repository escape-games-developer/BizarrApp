import React, { useState } from "react";
import { useDueloPostulaciones } from "../../hooks/realtime/useDueloPostulaciones";
import { useDueloRound, useAplausos } from "../../hooks/realtime/useDueloRound";
import {
  faseDuelo, duelistasDeRonda, porcentajesDuelo, segundosRestantes, formatoReloj,
} from "../../services/duelo";

const DUELO_LOGO = "/placas/Duelo_de_talento-removebg-preview.png";
const PINK = "#FF2D95";
const ORANGE = "#FF9500";

// Avatar mini a partir de una fila de duelo_postulaciones.
function MiniAvatar({ p, highlight = false, size = 44 }) {
  const base = {
    width: size, height: size, borderRadius: "50%", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.5, overflow: "hidden",
    background: "rgba(255,255,255,.06)",
    border: `2px solid ${highlight ? PINK : "rgba(255,255,255,.12)"}`,
    boxShadow: highlight ? `0 0 12px ${PINK}` : "none",
  };
  if (p.photo_url) {
    return (
      <div style={base}>
        <img src={p.photo_url} alt={p.user_name || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }
  return <div style={base}>{p.avatar_emoji || (p.user_name || "?").slice(0, 1).toUpperCase()}</div>;
}

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
 *   · mi saldo      → lo que devuelve applause_add (used / remaining)
 */
export default function DueloVistaCompleta({ sessionId, user, activeEscenario, gameState, onBack }) {
  const { postulaciones, misPostulacion, postularme, error } = useDueloPostulaciones(sessionId, user);
  const { round, counts, now, vencida } = useDueloRound(sessionId, { autoFinish: true });
  const aplausos = useAplausos(round, user?.id || null);
  const [enviando, setEnviando] = useState(false);

  const fase = faseDuelo({ ...gameState, active_escenario: activeEscenario }, round);
  const [d1, d2] = duelistasDeRonda(round);
  const pct = porcentajesDuelo(counts);

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
      <button onClick={onBack} style={{
        background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)",
        borderRadius: 10, padding: "7px 12px", color: "#F0E8FF",
        fontSize: 13, fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent",
      }}>← Volver</button>
      <h3 style={{ fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 17, color: PINK, margin: 0 }}>
        Duelo de Talentos
      </h3>
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
    if (soyDuelista || aplausos.bloqueo === "DUELIST_CANNOT_VOTE") {
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
          <SplitBar p1={pct.p1} />
        </div>
      );
    }

    const cerrada = vencida || aplausos.bloqueo === "CLOSED";
    const sinSaldo = aplausos.bloqueo === "LIMIT_REACHED" || aplausos.restante <= 0;
    const deshabilitado = cerrada || sinSaldo || aplausos.bloqueo === "NOT_PRESENT" || aplausos.bloqueo === "ERROR";

    const tap = (slot) => {
      if (aplausos.tap(slot) && navigator.vibrate) navigator.vibrate(12);
    };

    let saldo;
    if (cerrada) saldo = "Se cerró la votación. Esperando el resultado…";
    else if (aplausos.bloqueo === "NOT_PRESENT") saldo = "Tenés que estar conectado a la sesión para aplaudir.";
    else if (aplausos.bloqueo === "ERROR") saldo = "No pudimos registrar tus aplausos.";
    else if (sinSaldo) saldo = "Ya usaste todos tus aplausos 👏";
    else if (!aplausos.confirmado && aplausos.usados === 0) saldo = `Tenés ${aplausos.limite} aplausos para repartir`;
    else saldo = `Te quedan ${aplausos.restante} aplauso${aplausos.restante === 1 ? "" : "s"}`;

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
          Tocá sin parar al que más te guste 👏
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {lados.map(({ slot, s, color, pct: valor }) => (
            <button key={slot} className="duelo-tap" onClick={() => tap(slot)} disabled={deshabilitado}
              style={{
                flex: 1, padding: "20px 8px", borderRadius: 18,
                cursor: deshabilitado ? "default" : "pointer", opacity: deshabilitado ? 0.55 : 1,
                border: `2px solid ${color}`, background: `${color}14`,
                WebkitTapHighlightColor: "transparent", touchAction: "manipulation", userSelect: "none",
              }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color, marginBottom: 6 }}>PARTICIPANTE {slot}</div>
              <SlotFace slot={s} color={color} />
              <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 14, color, marginTop: 8 }}>{s?.name}</div>
              <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 26, color: "#F0E8FF", marginTop: 4 }}>{valor}%</div>
              <div style={{ fontSize: 22, marginTop: 4 }}>👏</div>
            </button>
          ))}
        </div>
        <SplitBar p1={pct.p1} />
        <div style={{
          marginTop: 14, textAlign: "center", fontSize: 14, fontWeight: 700,
          color: sinSaldo || cerrada ? "rgba(245,230,192,.5)" : "#F0E8FF",
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
      </div>
    );
  }

  // ── Convocatoria ─────────────────────────────────────────────────────────
  const disponibles = postulaciones.filter((p) => p.status !== "rejected");
  const otros = disponibles.filter((p) => p.user_id !== user?.id);

  const handlePostularme = async () => {
    if (enviando) return;
    setEnviando(true);
    try { await postularme(); }
    finally { setEnviando(false); }
  };

  if (!misPostulacion) {
    return (
      <div>
        {header}
        <div style={{
          textAlign: "center", padding: "22px 16px", borderRadius: 18,
          background: "linear-gradient(135deg, rgba(255,45,149,.12), rgba(255,149,0,.08))",
          border: "1px solid rgba(255,45,149,.4)",
        }}>
          <img src={DUELO_LOGO} alt="Duelo" style={{ width: 140, height: 140, objectFit: "contain", margin: "0 auto 10px" }}
            onError={(e) => { e.target.style.display = "none"; }} />
          <div style={{ fontSize: 13, color: "rgba(245,230,192,.6)", marginBottom: 16, lineHeight: 1.5 }}>
            ¿Te animás a subir al escenario? Postulate y esperá que el staff te elija.
          </div>
          <button onClick={handlePostularme} disabled={enviando} style={{
            width: "100%", padding: "15px", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg, #FF2D95, #FF9500)", color: "#fff",
            fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 15,
            cursor: enviando ? "default" : "pointer", opacity: enviando ? 0.6 : 1,
            WebkitTapHighlightColor: "transparent",
          }}>
            {enviando ? "Enviando…" : "🎤 Postularme"}
          </button>
          {error && (
            <div style={{
              marginTop: 12, padding: "10px 12px", borderRadius: 12, textAlign: "center",
              background: "rgba(255,45,120,.1)", border: "1px solid rgba(255,45,120,.35)",
              fontSize: 12, color: "#FF8FB8",
            }}>{error}</div>
          )}
        </div>
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, color: "rgba(245,230,192,.4)", marginBottom: 8, textAlign: "center" }}>
            {disponibles.length} postulado{disponibles.length === 1 ? "" : "s"}
          </div>
          {otros.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {otros.map((p) => <MiniAvatar key={p.id} p={p} size={38} />)}
            </div>
          )}
        </div>
      </div>
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

  // waiting o selected (ya participó en una ronda anterior): sigue en la lista.
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
            ? "Ya participaste: seguís en la lista por si te vuelven a llamar."
            : "Esperando que el staff elija a los participantes…"}
        </div>
      </div>
      <div style={{ fontSize: 12, color: "rgba(245,230,192,.4)", marginBottom: 10, textAlign: "center" }}>
        {disponibles.length} postulado{disponibles.length === 1 ? "" : "s"}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
        {disponibles.map((p) => <MiniAvatar key={p.id} p={p} highlight={p.user_id === user?.id} />)}
      </div>
    </div>
  );
}
