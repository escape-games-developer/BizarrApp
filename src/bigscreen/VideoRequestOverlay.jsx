import React from "react";
import AvatarHeader from "./AvatarHeader";
import { PRESET_AVATARS } from "../constants/theme";

/**
 * VideoRequestOverlay — crédito del usuario que pidió el video que está
 * sonando. Mismo layout que la cabecera de MensajeCliente (nombre + avatar
 * con latido) pero SIN globo. Esquina superior derecha, por encima del video.
 *
 * Prioridad de avatar (igual criterio que AvatarDisplay):
 *   1) photo_url    → foto del usuario
 *   2) avatar_emoji → emoji denormalizado en el request (snapshot)
 *   3) avatar_id    → resolver contra PRESET_AVATARS (compatibilidad)
 *   4) fallback     → 🎵
 */
export default function VideoRequestOverlay({ userName, avatarEmoji, photoUrl, avatarId }) {
  const emoji =
    avatarEmoji ||
    PRESET_AVATARS.find((a) => a.id === avatarId)?.emoji ||
    "🎵";

  return (
    <div style={{ position: "absolute", top: 32, right: 32, zIndex: 50 }}>
      <AvatarHeader name={userName} emoji={emoji} photoUrl={photoUrl} />
    </div>
  );
}
