import React from "react";
import AvatarHeader from "./AvatarHeader";

/**
 * MensajeCliente — overlay del mensaje aprobado sobre la Pantalla Gigante.
 *
 * - Cabecera [nombre] [avatar con latido] + globo blanco (comic) debajo,
 *   en la esquina superior derecha.
 * - "Último mensaje gana": muestra SOLO el approved más reciente. El admin
 *   archiva los anteriores al aprobar, así que ya no hay rotación.
 * - Visibilidad gobernada por el toggle "Zócalo" del admin (zocalo_active):
 *     · zocalo_active false      → no renderiza nada
 *     · sin mensaje aprobado     → no renderiza nada
 *
 * Recibe la lista ya aprobada por prop (root: useMessages(session, "screen").approved)
 * para no abrir una segunda suscripción Realtime al mismo canal.
 */

/**
 * Wrap por cantidad de caracteres respetando palabras. Las palabras más
 * largas que maxChars se parten a la fuerza. Devuelve un string con "\n"
 * (renderizar con whiteSpace: "pre-line").
 */
function wrapTextByChars(text, maxChars = 27) {
  if (!text) return "";
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length === 0) {
      if (word.length > maxChars) {
        let remaining = word;
        while (remaining.length > maxChars) {
          lines.push(remaining.substring(0, maxChars));
          remaining = remaining.substring(maxChars);
        }
        currentLine = remaining;
      } else {
        currentLine = word;
      }
    } else if (currentLine.length + 1 + word.length <= maxChars) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      if (word.length > maxChars) {
        let remaining = word;
        while (remaining.length > maxChars) {
          lines.push(remaining.substring(0, maxChars));
          remaining = remaining.substring(maxChars);
        }
        currentLine = remaining;
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);

  return lines.join("\n");
}

export default function MensajeCliente({ messages, gameState }) {
  // Blindaje + "último gana": solo approved, ordenados por created_at DESC,
  // tomamos el primero (no hay approved_at en la tabla).
  const approved = (messages || [])
    .filter((m) => m && m.text && (m.status ? m.status === "approved" : true))
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  // [DEBUG-TEMP] verificar en runtime que el toggle llega y por qué no oculta.
  console.info("[MensajeCliente] zocalo_active:", gameState?.zocalo_active,
               "mensajes:", approved.length);

  const zocaloActive = gameState?.zocalo_active ?? false;
  const msg = approved[0] || null;

  if (!zocaloActive) return null;                       // toggle "Zócalo" del admin
  if (!msg)          return null;

  return (
    <div
      key={msg.id}
      style={{
        position: "absolute", top: 32, right: 32, zIndex: 50,
        display: "flex", flexDirection: "column", alignItems: "flex-end",
        gap: 24,
        animation: "fadeIn 400ms ease",
      }}
    >
      {/* Cabecera: nombre (izq) + avatar con latido (der) */}
      <AvatarHeader name={msg.name} emoji={msg.avatar} photoUrl={msg.photo_url} />

      {/* Globo — speech bubble estilo comic, con tail apuntando hacia el avatar.
          Los pseudo-elementos no existen en estilos inline, así que el tail son
          dos <div> triángulos (negro detrás = borde, blanco delante = relleno). */}
      <div
        style={{
          position: "relative",
          width: "auto", minWidth: 200, maxWidth: "50vw",
          whiteSpace: "pre-line", overflowWrap: "break-word",
          background: "#FFFFFF", color: "#000000",
          border: "2px solid #000000",
          padding: "18px 25px", borderRadius: 28,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          fontSize: 25, fontWeight: 500, lineHeight: 1.3,
          boxShadow: "0 8px 32px rgba(0,0,0,.4)",
        }}
      >
        {/* Tail negro (borde) */}
        <div
          style={{
            position: "absolute", top: -15, right: 39,
            width: 0, height: 0,
            borderLeft: "15px solid transparent",
            borderRight: "15px solid transparent",
            borderBottom: "15px solid #000000",
            zIndex: 1,
          }}
        />
        {/* Tail blanco (relleno) */}
        <div
          style={{
            position: "absolute", top: -12, right: 40,
            width: 0, height: 0,
            borderLeft: "14px solid transparent",
            borderRight: "14px solid transparent",
            borderBottom: "14px solid #FFFFFF",
            zIndex: 2,
          }}
        />
        {wrapTextByChars(msg.text, 27)}
      </div>
    </div>
  );
}
