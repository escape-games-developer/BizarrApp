import React from "react";

const DUELO_LOGO = "/placas/Duelo_de_talento-removebg-preview.png";

/**
 * DueloCard
 * Card de acceso al Duelo de Talentos dentro de la vista Juegos.
 * - activeEscenario === 'duelo' → iluminada, pulse suave, CTA "Ir al Duelo".
 * - si no → apagada/gris, CTA deshabilitado "Próximamente".
 */
export function DueloCard({ activeEscenario, onOpen }) {
  const activo = activeEscenario === "duelo";

  return (
    <div style={{ marginBottom: 14 }}>
      <style>{`
        @keyframes dueloPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,45,149,.45); }
          50%      { box-shadow: 0 0 22px 4px rgba(255,45,149,.55); }
        }
      `}</style>

      <div style={{
        borderRadius: 18,
        padding: "18px 16px",
        textAlign: "center",
        background: activo
          ? "linear-gradient(135deg, rgba(255,45,149,.16), rgba(255,149,0,.10))"
          : "rgba(255,255,255,.03)",
        border: `1.5px solid ${activo ? "rgba(255,45,149,.55)" : "rgba(255,255,255,.08)"}`,
        animation: activo ? "dueloPulse 2.4s ease-in-out infinite" : "none",
        transition: "all .3s ease",
      }}>
        <img
          src={DUELO_LOGO}
          alt="Duelo de Talentos"
          style={{
            width: 120, height: 120, objectFit: "contain",
            margin: "0 auto 8px",
            filter: activo ? "none" : "grayscale(1) opacity(.4)",
            transition: "filter .3s ease",
          }}
          onError={(e) => { e.target.style.display = "none"; }}
        />

        <div style={{
          fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 18,
          color: activo ? "#FF2D95" : "rgba(245,230,192,.35)",
          marginBottom: 12,
        }}>
          Duelo de Talentos
        </div>

        {activo ? (
          <button
            onClick={onOpen}
            style={{
              width: "100%", padding: "13px 16px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg, #FF2D95, #FF9500)", color: "#fff",
              fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 14,
              cursor: "pointer", WebkitTapHighlightColor: "transparent",
            }}
          >
            🎤 Ir al Duelo
          </button>
        ) : (
          <button
            disabled
            style={{
              width: "100%", padding: "13px 16px", borderRadius: 12,
              background: "rgba(255,255,255,.04)", color: "rgba(245,230,192,.3)",
              border: "1px solid rgba(255,255,255,.08)",
              fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 13,
              cursor: "not-allowed",
            }}
          >
            Próximamente
          </button>
        )}
      </div>
    </div>
  );
}

export default DueloCard;
