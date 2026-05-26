import React from "react";
import { PRESET_AVATARS } from "../constants/theme";

/**
 * AvatarDisplay
 * Renderiza el avatar del usuario: foto propia o avatar preset.
 */
export function AvatarDisplay({ user, size = 40, fontSize = 18 }) {
  const av = PRESET_AVATARS.find((a) => a.id === user?.avatarId);

  const style = {
    width:          size,
    height:         size,
    borderRadius:   "50%",
    overflow:       "hidden",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  };

  if (user?.photoUrl) {
    return (
      <div style={style}>
        <img
          src={user.photoUrl}
          alt={user.name || "Avatar"}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    );
  }

  if (av) {
    return (
      <div
        style={{
          ...style,
          background: `linear-gradient(135deg, ${av.bg[0]}, ${av.bg[1]})`,
          fontSize,
        }}
      >
        {av.emoji}
      </div>
    );
  }

  // Fallback: iniciales
  const initials = (user?.name || "?").slice(0, 2).toUpperCase();
  return (
    <div
      style={{
        ...style,
        background: "linear-gradient(135deg, #F59E0B, #7C3A00)",
        fontSize: Math.round(fontSize * 0.65),
        fontWeight: 800,
        fontFamily: "Syne, sans-serif",
        color: "#1A0A00",
      }}
    >
      {initials}
    </div>
  );
}
