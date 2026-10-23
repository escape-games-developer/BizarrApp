import FtlBarometro from "../components/FtlBarometro";

/**
 * Overlay de Follow the Leader sobre el video del participante.
 *
 * Es TRANSPARENTE a propósito: el video de YouTube se reproduce en los mismos
 * players A/B del DJ, como fuente TEMPORAL (la canción del evento sigue
 * congelada detrás), y el subido desde la PC en un <video> debajo. Por eso no
 * va dentro del contenedor opaco de juego en vivo de PantallaTV.
 *
 * La convocatoria (FTL abierto y todavía sin nadie en escena) NO se dibuja acá:
 * es `FtlStandby`, una pantalla completa del juego.
 *
 * Diseño, todo sobre el margen izquierdo:
 *   · esquina superior izquierda: avatar + nombre del participante
 *   · el barómetro VERTICAL (por defecto debajo del avatar; ancho, alto y
 *     ubicación se editan en el Admin) y rectangular, con las divisiones de los
 *     cuatro tramos y sin número ni rótulo. Es el mismo en los dos modos de
 *     🗳️ Votación del público del panel del juego (Admin); sólo cambia de dónde sale `pct`:
 *       Mod 1 → energía de toques (ftl_energia_pct)
 *       Mod 2 → % de 👍 (follow_leader_vote_totals.up_pct)
 *     null = juego sin votación, sin barómetro.
 */

const C = { gold: "#FFD600", white: "#F0E8FF" };

// Ubicación de hoy, si no llega configuración.
const BARO_BASE = { ancho: 100, alto: 70, x: 8, y: 61 };

export default function FtlOverlay({ participante, pct = null, decae = true, barometro = BARO_BASE }) {
  if (!participante) return null;

  const emoji = participante.avatar_emoji || "🎤";
  const nombre = participante.name || "Participante";

  return (
    <div data-tv-ftl style={{
      position: "absolute", inset: 0,
      zIndex: 50,                       // debajo de la lluvia, placas y juegos
      pointerEvents: "none",            // nunca tapa nada clickeable
    }}>
      <div style={{
        position: "absolute", top: "3vh", left: "2vw", bottom: "4vh", width: "12vw",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "1.2vh",
      }}>
        {/* Esquina superior izquierda: avatar + nombre */}
        <div style={{
          width: "7.5vw", height: "7.5vw", flexShrink: 0, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "4.2vw", background: "rgba(8,4,15,.6)",
          backdropFilter: "blur(6px)",
          border: `3px solid ${C.gold}`, boxShadow: "0 0 36px rgba(255,214,0,.45)",
        }}>{emoji}</div>
        <div style={{
          fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: "1.8vw", lineHeight: 1.1,
          color: C.white, textAlign: "center", textShadow: "0 2px 12px #000, 0 0 2px #000",
          maxWidth: "12vw", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>{nombre}</div>
      </div>

      {/* Barómetro vertical, editable desde el Admin (panel del juego →
          Barómetro en pantalla): ancho, alto y ubicación sobre la pantalla
          entera, como el del Duelo. x / y son su centro. */}
      {pct !== null && (
        <div style={{
          position: "absolute", left: `${barometro.x}%`, top: `${barometro.y}%`,
          transform: "translate(-50%, -50%)",
          width: `calc(3.1vw * ${barometro.ancho / 100})`, height: `${barometro.alto}vh`,
        }}>
          <FtlBarometro pct={pct} tamano="tv" decae={decae}/>
        </div>
      )}
    </div>
  );
}
