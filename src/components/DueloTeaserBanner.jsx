import React, { useState, useEffect } from "react";

/**
 * DueloTeaserBanner
 * Barra flotante top-center que avisa que empezó el Duelo.
 * Aparece sólo si el duelo está activo y el usuario NO está ya en Juegos.
 * El botón "X" lo silencia por la sesión (sessionStorage) para no molestar.
 */
export function DueloTeaserBanner({ activeEscenario, currentView, onGoDuelo, sessionId }) {
  const dismissKey = `duelo_banner_dismissed_${sessionId}`;
  const [dismissed, setDismissed] = useState(false);

  // Releer el flag cuando cambia la sesión.
  useEffect(() => {
    try { setDismissed(sessionStorage.getItem(dismissKey) === "1"); }
    catch { setDismissed(false); }
  }, [dismissKey]);

  const shouldShow = activeEscenario === "duelo" && currentView !== "games" && !dismissed;
  if (!shouldShow) return null;

  const handleDismiss = () => {
    try { sessionStorage.setItem(dismissKey, "1"); } catch { /* noop */ }
    setDismissed(true);
  };

  return (
    <div style={{
      position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)",
      zIndex: 9998, width: "calc(100% - 24px)", maxWidth: 420,
      background: "#ff2d95", color: "#fff",
      padding: "10px 12px", borderRadius: 14,
      boxShadow: "0 10px 30px rgba(255,45,149,.45)",
      display: "flex", alignItems: "center", gap: 10,
      fontFamily: "'Space Grotesk', sans-serif",
    }}>
      <div style={{ flex: 1, fontWeight: 700, fontSize: 13.5 }}>
        🎤 ¡Empezó el Duelo!
      </div>
      <button
        onClick={onGoDuelo}
        style={{
          background: "#fff", color: "#ff2d95", border: "none",
          padding: "7px 16px", borderRadius: 999, fontWeight: 800, fontSize: 13,
          cursor: "pointer", whiteSpace: "nowrap", WebkitTapHighlightColor: "transparent",
        }}
      >
        Ir
      </button>
      <button
        onClick={handleDismiss}
        aria-label="Cerrar"
        style={{
          background: "transparent", color: "rgba(255,255,255,.85)",
          border: "none", fontSize: 18, fontWeight: 700, lineHeight: 1,
          cursor: "pointer", padding: "0 4px", WebkitTapHighlightColor: "transparent",
        }}
      >
        ×
      </button>
    </div>
  );
}

export default DueloTeaserBanner;
