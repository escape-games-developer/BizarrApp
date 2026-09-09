import QRCode from "react-qr-code";

/**
 * Pantalla de convocatoria de Follow the Leader.
 *
 * Es la cara del juego mientras no hay nadie en el escenario: entre que el
 * admin abre la convocatoria y llama al primero, y otra vez entre performance
 * y performance. Ocupa la TV entera y tapa al DJ — su video, su canción actual,
 * sus próximas y su QR musical no tienen nada que ver con este momento.
 *
 * Tapa, no desmonta: los players A/B siguen vivos debajo, así que el DJ puede
 * seguir sonando mientras la gente se anota, y llamar al participante siguiente
 * no tiene que rearrancar el motor.
 *
 * El QR lleva derecho a la sección Escenario de la WebApp — con
 * `active_escenario = 'ftl'`, esa vista abre Follow the Leader sola. Es el
 * mismo mecanismo de deep-link que ya usa el Duelo (`?view=games&game=duelo`).
 */

const C = { bg: "#08040F", gold: "#FFD600", white: "#F0E8FF" };

export default function FtlStandby({ juego, webappUrl, participante = null }) {
  const url = `${webappUrl}/?view=escenario`;

  // Candidato preparado: la TV ya muestra quién va a jugar, pero el video
  // todavía no arranca. El QR sale de escena — el turno de este ya está
  // resuelto y el cartel tiene que ser sobre él.
  if (participante) {
    return (
      <div data-tv-ftl-candidato style={{
        position: "absolute", inset: 0, zIndex: 50,
        background: `radial-gradient(circle at 50% 40%, #1A0D2E 0%, ${C.bg} 70%)`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: "3vh", padding: "4vh 4vw", overflow: "hidden",
      }}>
        <div style={{
          width: "16vh", height: "16vh", borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "8vh", background: "rgba(240,232,255,.06)",
          border: `3px solid ${C.gold}`, boxShadow: "0 0 60px rgba(255,214,0,.4)",
        }}>{participante.avatar_emoji || "🎤"}</div>

        <div style={{
          fontFamily: "Syne, sans-serif", fontWeight: 900,
          fontSize: "clamp(26px, 4.2vw, 76px)", color: C.white,
          textShadow: "0 4px 22px rgba(0,0,0,.8)", textAlign: "center",
          maxWidth: "80vw", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{participante.name || "Participante"}</div>

        <div style={{
          fontFamily: "Syne, sans-serif", fontWeight: 800,
          fontSize: "clamp(13px, 1.7vw, 30px)", letterSpacing: ".16em",
          color: C.gold, textAlign: "center",
        }}>{juego.tvListo}</div>
      </div>
    );
  }

  return (
    <div data-tv-ftl-standby style={{
      position: "absolute", inset: 0, zIndex: 50,
      background: `radial-gradient(circle at 50% 35%, #1A0D2E 0%, ${C.bg} 70%)`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: "3.5vh", padding: "4vh 4vw", overflow: "hidden",
    }}>
      <img src={juego.placa} alt={juego.label} style={{
        maxWidth: "52vw", maxHeight: "38vh", objectFit: "contain",
        filter: "drop-shadow(0 10px 40px rgba(255,149,0,.35))",
      }}/>

      <div style={{
        fontFamily: "Syne, sans-serif", fontWeight: 900,
        fontSize: "clamp(22px, 3.4vw, 62px)", letterSpacing: ".06em",
        color: C.gold, textShadow: "0 4px 22px rgba(0,0,0,.8)", textAlign: "center",
      }}>ANOTATE PARA JUGAR</div>

      <div style={{ background: "#fff", padding: "1.6vh", borderRadius: "1.4vh", display: "flex" }}>
        <QRCode value={url} style={{ width: "17vh", height: "17vh" }}/>
      </div>

      <div style={{
        fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
        fontSize: "clamp(13px, 1.5vw, 26px)", color: "rgba(240,232,255,.62)",
        letterSpacing: ".04em", textAlign: "center",
      }}>Escaneá para participar</div>
    </div>
  );
}
