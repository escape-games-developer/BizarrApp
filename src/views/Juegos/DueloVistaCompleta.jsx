import React, { useState } from "react";
import { useDueloPostulaciones } from "../../hooks/realtime/useDueloPostulaciones";
import { useApplauseRound, resolveDueloWinner, dueloPercentages } from "../../hooks/realtime/useApplauseRound";

const DUELO_LOGO = "/placas/Duelo_de_talento-removebg-preview.png";
const PINK = "#FF2D95";
const ORANGE = "#FF9500";

// Avatar mini a partir de una fila de duelo_postulaciones (snake_case).
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

// Avatar de un duelista guardado en game_state.duelo_slotN (camelCase mixto:
// { user_id, name, avatar_id, avatar_emoji, photo_url }).
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

// Barra del reparto: fucsia = P1, naranja = P2. La división se mueve con cada
// voto y la transition la lleva suave en los dos sentidos (sube y baja).
function SplitBar({ p1 }) {
  return (
    <div style={{
      marginTop: 12, height: 10, borderRadius: 999, overflow: "hidden",
      background: ORANGE, border: "1px solid rgba(255,255,255,.1)",
    }}>
      <div style={{
        width: `${p1}%`, height: "100%", background: PINK,
        transition: "width .45s cubic-bezier(.4,0,.2,1)",
      }} />
    </div>
  );
}

/**
 * DueloVistaCompleta — vista de cliente del Duelo de Talentos.
 *
 * Todas las fases se derivan de datos persistidos, nunca de estado local:
 *   · convocatoria → duelo_postulaciones (mi fila = mi estado)
 *   · votación     → applause_sessions (status) + applause_counts (totales)
 *   · resultado    → applause_sessions.winner_slot
 * Por eso un F5 en cualquier momento reconstruye exactamente la misma pantalla.
 */
export default function DueloVistaCompleta({ sessionId, user, activeEscenario, gameState, onBack }) {
  const { postulaciones, misPostulacion, postularme, error } = useDueloPostulaciones(sessionId, user);
  const { round, counts, sendTap } = useApplauseRound(sessionId, "duelo");
  const [enviando, setEnviando] = useState(false);
  const [taps, setTaps] = useState(0); // feedback inmediato del propio tap

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
      <button
        onClick={onBack}
        style={{
          background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 10, padding: "7px 12px", color: "#F0E8FF",
          fontSize: 13, fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent",
        }}
      >
        ← Volver
      </button>
      <h3 style={{
        fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 17,
        color: PINK, margin: 0,
      }}>
        Duelo de Talentos
      </h3>
    </div>
  );

  const pulseCss = (
    <style>{`
      @keyframes dueloBigPulse {
        0%, 100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(255,45,149,.45); }
        50%      { transform: scale(1.02); box-shadow: 0 0 26px 6px rgba(255,45,149,.5); }
      }
    `}</style>
  );

  // ── Duelo no activo ──────────────────────────────────────────────────────────
  if (activeEscenario !== "duelo") {
    return (
      <div>
        {header}
        <div style={{
          textAlign: "center", padding: "40px 16px", color: "rgba(245,230,192,.4)",
          fontSize: 13,
        }}>
          El duelo no está activo ahora.
        </div>
      </div>
    );
  }

  const s1 = gameState?.duelo_slot1 || null;
  const s2 = gameState?.duelo_slot2 || null;

  // ── Duelo en curso: aplausómetro ─────────────────────────────────────────────
  // El tap NO escribe directo: `sendTap` acumula en un buffer local y el hook
  // lo manda cada 500 ms por el RPC applause_add, que capea por usuario y sólo
  // acepta aportes mientras la ronda está en 'voting'. Cerrada la ronda, los
  // taps que lleguen tarde los descarta el servidor.
  if (round?.status === "voting") {
    // Marcador = reparto del 100% (sube y baja). Los votos absolutos de `counts`
    // siguen intactos: son los que se mandan al servidor y los que deciden al ganador.
    const pct = dueloPercentages(counts);
    const soyDuelista = !!user?.id && (s1?.user_id === user.id || s2?.user_id === user.id);
    const lados = [
      { slot: 1, s: s1, color: PINK,   pct: pct.p1 },
      { slot: 2, s: s2, color: ORANGE, pct: pct.p2 },
    ];
    const tap = (slot) => {
      // Guard defensivo: si el usuario es duelista la UI ni siquiera dibuja los
      // botones, pero dejamos el corte acá para que no exista ningún camino del
      // cliente que mande un tap suyo. La protección real es server-side, en el
      // RPC applause_add (ver REQUERIMIENTO PARA CLAUDE SUPABASE).
      if (soyDuelista) return;
      sendTap(slot);
      setTaps((t) => t + 1);
      if (navigator.vibrate) navigator.vibrate(12);
    };

    // ── Duelista en el escenario: no vota ────────────────────────────────────
    // Ni a sí mismo ni al rival. Ve el marcador (divs sin onClick) para seguir
    // su duelo, pero no hay botón de voto ni contador de aplausos aportados.
    if (soyDuelista) {
      return (
        <div>
          {header}
          <div style={{
            textAlign: "center", padding: "26px 18px", borderRadius: 18, marginBottom: 14,
            background: "linear-gradient(135deg, rgba(255,45,149,.18), rgba(255,149,0,.10))",
            border: `2px solid ${PINK}`,
          }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>🎤</div>
            <div style={{
              fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 18,
              color: PINK, marginBottom: 6,
            }}>
              ESTÁS EN EL ESCENARIO
            </div>
            <div style={{ fontSize: 13, color: "rgba(245,230,192,.6)", lineHeight: 1.5 }}>
              No podés votar durante tu propio duelo.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            {lados.map(({ slot, s, color, pct: valor }) => (
              <div key={slot} style={{
                flex: 1, padding: "16px 8px", borderRadius: 18, textAlign: "center",
                border: `2px solid ${color}55`, background: `${color}10`,
              }}>
                <SlotFace slot={s} color={color} />
                <div style={{
                  fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 14,
                  color, marginTop: 8,
                }}>
                  {s?.name || `Participante ${slot}`}
                </div>
                <div style={{
                  fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 26,
                  color: "#F0E8FF", marginTop: 4,
                }}>
                  👍 {valor}%
                </div>
              </div>
            ))}
          </div>

          <SplitBar p1={pct.p1} />
        </div>
      );
    }

    return (
      <div>
        {header}
        <style>{`
          @keyframes dueloTapPop { 0%{transform:scale(1)} 45%{transform:scale(.96)} 100%{transform:scale(1)} }
          .duelo-tap:active { animation: dueloTapPop .18s ease-out; }
        `}</style>

        <div style={{
          textAlign: "center", fontSize: 13, color: "rgba(245,230,192,.6)", marginBottom: 14,
        }}>
          Tocá sin parar al que más te guste 👏
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {lados.map(({ slot, s, color, pct: valor }) => (
            <button
              key={slot}
              className="duelo-tap"
              onClick={() => tap(slot)}
              style={{
                flex: 1, padding: "18px 8px", borderRadius: 18, cursor: "pointer",
                border: `2px solid ${color}`, background: `${color}14`,
                WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
              }}
            >
              <SlotFace slot={s} color={color} />
              <div style={{
                fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 14,
                color, marginTop: 8,
              }}>
                {s?.name || `Participante ${slot}`}
              </div>
              <div style={{
                fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 26,
                color: "#F0E8FF", marginTop: 4,
              }}>
                👍 {valor}%
              </div>
            </button>
          ))}
        </div>

        <SplitBar p1={pct.p1} />

        <div style={{
          marginTop: 14, textAlign: "center", fontSize: 11.5, color: "rgba(245,230,192,.35)",
        }}>
          {taps > 0 ? `Aportaste ${taps} aplauso${taps === 1 ? "" : "s"}` : "Todavía no aplaudiste"}
        </div>
      </div>
    );
  }

  // ── Resultado ────────────────────────────────────────────────────────────────
  // Mismo cálculo que usan Admin y /tv (winner_slot persistido + totales).
  if (round?.status === "finished") {
    const result = resolveDueloWinner(round, counts);
    const ganador = result.slot === 1 ? s1 : result.slot === 2 ? s2 : null;
    // El ganador sale de los votos reales (result); el % es sólo el reparto.
    const finalPct = dueloPercentages(counts);
    return (
      <div>
        {header}
        <div style={{
          textAlign: "center", padding: "34px 20px", borderRadius: 20,
          background: "linear-gradient(135deg, rgba(0,245,160,.14), rgba(255,45,149,.08))",
          border: "1px solid rgba(0,245,160,.35)",
        }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>{result.tie ? "🤝" : "🏆"}</div>
          <div style={{
            fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 20,
            color: result.tie ? "#FFD600" : "#00F5A0",
          }}>
            {result.tie ? "¡Empate!" : `Ganó ${ganador?.name || "—"}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          {[{ slot: 1, s: s1, color: PINK, valor: finalPct.p1 },
            { slot: 2, s: s2, color: ORANGE, valor: finalPct.p2 }].map(({ slot, s, color, valor }) => (
            <div key={slot} style={{
              flex: 1, padding: "14px 8px", borderRadius: 16, textAlign: "center",
              background: `${color}10`,
              border: `2px solid ${result.slot === slot ? color : `${color}44`}`,
            }}>
              <SlotFace slot={s} color={color} size={52} />
              <div style={{ fontSize: 12.5, fontWeight: 700, color, marginTop: 6 }}>
                {s?.name || `Participante ${slot}`}
              </div>
              <div style={{
                fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 20,
                color: "#F0E8FF", marginTop: 2,
              }}>👍 {valor}%</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const otros = postulaciones.filter((p) => p.user_id !== user?.id);

  const handlePostularme = async () => {
    if (enviando) return;          // corta el doble tap antes de que salga el INSERT
    setEnviando(true);
    try { await postularme(); }
    finally { setEnviando(false); }
  };

  // El hook deja acá el error de RLS o del UNIQUE. Sin mostrarlo, el botón
  // parecía no hacer nada y el usuario creía que se había postulado.
  const errorBox = error ? (
    <div style={{
      marginTop: 12, padding: "10px 12px", borderRadius: 12, textAlign: "center",
      background: "rgba(255,45,120,.1)", border: "1px solid rgba(255,45,120,.35)",
      fontSize: 12, color: "#FF8FB8",
    }}>
      No pudimos registrar tu postulación. Probá de nuevo en unos segundos.
    </div>
  ) : null;

  // ── Sin postular todavía ─────────────────────────────────────────────────────
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
          <button
            onClick={handlePostularme}
            disabled={enviando}
            style={{
              width: "100%", padding: "15px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg, #FF2D95, #FF9500)", color: "#fff",
              fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 15,
              cursor: enviando ? "default" : "pointer", opacity: enviando ? 0.6 : 1,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {enviando ? "Enviando…" : "🎤 Postularme"}
          </button>
          {errorBox}
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, color: "rgba(245,230,192,.4)", marginBottom: 8, textAlign: "center" }}>
            {postulaciones.length} postulado{postulaciones.length === 1 ? "" : "s"}
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

  // ── Seleccionado ─────────────────────────────────────────────────────────────
  if (misPostulacion.status === "selected") {
    return (
      <div>
        {header}
        {pulseCss}
        <div style={{
          textAlign: "center", padding: "36px 20px", borderRadius: 20,
          background: "linear-gradient(135deg, rgba(255,45,149,.2), rgba(255,149,0,.14))",
          border: `2px solid ${PINK}`, animation: "dueloBigPulse 2s ease-in-out infinite",
        }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>🎉</div>
          <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 22, color: PINK, marginBottom: 6 }}>
            ¡Sos jugador!
          </div>
          <div style={{ fontSize: 15, color: "#F0E8FF" }}>Preparate 🎤</div>
        </div>
      </div>
    );
  }

  // ── Rechazado ────────────────────────────────────────────────────────────────
  if (misPostulacion.status === "rejected") {
    return (
      <div>
        {header}
        <div style={{
          textAlign: "center", padding: "36px 20px", borderRadius: 18,
          background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)",
        }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>😔</div>
          <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 16, color: "rgba(245,230,192,.6)", marginBottom: 6 }}>
            Esta vez no te tocó
          </div>
          <div style={{ fontSize: 13, color: "rgba(245,230,192,.4)" }}>¡Suerte para la próxima!</div>
        </div>
      </div>
    );
  }

  // ── Postulado, esperando (status 'waiting' o default) ────────────────────────
  return (
    <div>
      {header}
      <div style={{
        textAlign: "center", padding: "18px 16px", borderRadius: 16,
        background: "rgba(255,45,149,.08)", border: "1px solid rgba(255,45,149,.3)",
        marginBottom: 18,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: PINK, marginBottom: 4 }}>
          ⏳ Estás postulado
        </div>
        <div style={{ fontSize: 12.5, color: "rgba(245,230,192,.5)" }}>
          Esperando que el admin elija a los participantes...
        </div>
      </div>

      <div style={{ fontSize: 12, color: "rgba(245,230,192,.4)", marginBottom: 10, textAlign: "center" }}>
        {postulaciones.length} postulado{postulaciones.length === 1 ? "" : "s"}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
        {postulaciones.map((p) => (
          <MiniAvatar key={p.id} p={p} highlight={p.user_id === user?.id} />
        ))}
      </div>
    </div>
  );
}
