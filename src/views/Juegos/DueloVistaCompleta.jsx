import React from "react";
import { useDueloPostulaciones } from "../../hooks/realtime/useDueloPostulaciones";

const DUELO_LOGO = "/placas/Duelo_de_talento-removebg-preview.png";
const PINK = "#FF2D95";

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

/**
 * DueloVistaCompleta — fase "inviting" del Duelo de Talentos.
 * Muestra el estado de la postulación del usuario y la lista de postulados.
 */
export default function DueloVistaCompleta({ sessionId, user, activeEscenario, onBack }) {
  const { postulaciones, misPostulacion, postularme } = useDueloPostulaciones(sessionId, user);

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

  const otros = postulaciones.filter((p) => p.user_id !== user?.id);

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
            onClick={postularme}
            style={{
              width: "100%", padding: "15px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg, #FF2D95, #FF9500)", color: "#fff",
              fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 15,
              cursor: "pointer", WebkitTapHighlightColor: "transparent",
            }}
          >
            🎤 Postularme
          </button>
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
