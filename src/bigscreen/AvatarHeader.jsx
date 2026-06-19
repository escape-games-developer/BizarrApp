import React from "react";

/**
 * AvatarHeader — fila [nombre] [avatar] alineada a la derecha.
 * El avatar late (mismo keyframe "latido" que las placas, inyectado global
 * por PantallaGigante). Lo usan MensajeCliente y VideoRequestOverlay para
 * compartir exactamente el mismo layout de cabecera.
 *
 * props:
 *   name     — nombre del usuario (a la izquierda)
 *   emoji    — emoji del avatar (fallback "👤")
 *   photoUrl — foto del usuario (opcional; tiene prioridad sobre emoji)
 */
export default function AvatarHeader({ name, emoji, photoUrl }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <span
        style={{
          color: "#FFFFFF",
          fontSize: 28,
          fontWeight: 600,
          fontFamily: "system-ui, -apple-system, sans-serif",
          textShadow: "0 2px 8px rgba(0,0,0,0.6)",   // legible sobre cualquier fondo
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
      <div
        style={{
          width: 96, height: 96, borderRadius: "50%", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 56, lineHeight: 1, overflow: "hidden",
          background: "rgba(8,4,15,.55)",
          boxShadow: "0 6px 24px rgba(0,0,0,.45)",
          animation: "latido 1.5s ease-in-out infinite",
        }}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={name}
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          emoji || "👤"
        )}
      </div>
    </div>
  );
}
