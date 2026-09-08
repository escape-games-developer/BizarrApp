/**
 * Overlay de Follow the Leader sobre el video del DJ.
 *
 * Es TRANSPARENTE a propósito: el video que baila el líder se reproduce en los
 * mismos players A/B del DJ, como fuente TEMPORAL — la canción del evento sigue
 * congelada detrás. Acá no hay ningún reproductor: montar otro iframe daría dos
 * audios sonando a la vez.
 *
 * Por eso este componente NO va dentro del contenedor opaco de juego en vivo
 * de PantallaTV — ese fondo taparía justamente lo que hay que ver.
 *
 * La convocatoria (FTL abierto y todavía sin nadie en escena) NO se dibuja acá:
 * es `FtlStandby`, una pantalla completa del juego.
 *
 * No se muestra ni el título del video ni el nombre del participante: el video
 * ES el contenido y cualquier cartel le compite. Queda el avatar como única
 * seña de quién está en el escenario, y los dos porcentajes.
 *
 * `votos` es la fila de `follow_leader_vote_totals` del turno en curso, tal
 * como la devuelve la base: `up_pct` y `down_pct` son columnas generadas y acá
 * no se recalcula nada. Llega en null mientras no haya turno (convocatoria);
 * con turno y sin votos todavía, la base ya devuelve 0% — eso sí es dato real.
 */

const C = { gold: "#FFD600", green: "#00F5A0", pink: "#FF2D78", white: "#F0E8FF" };

function Barra({ icono, pct, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6vw" }}>
      <span style={{ fontSize: "2.2vw", lineHeight: 1, filter: "drop-shadow(0 2px 6px #000)" }}>{icono}</span>
      <span style={{
        fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: "2.4vw",
        color, textShadow: "0 2px 10px #000", minWidth: "4.5vw",
      }}>{pct}%</span>
    </div>
  );
}

export default function FtlOverlay({ participante, votos = null }) {
  // Sólo se usa con participante en escena: la convocatoria es FtlStandby, una
  // pantalla entera, no un cartel encima del DJ.
  if (!participante) return null;

  const emoji = participante.avatar_emoji || "🎤";

  return (
    <div data-tv-ftl style={{
      position: "absolute", top: "3vh", left: "2.5vw",
      zIndex: 50,                       // debajo de la lluvia, placas y juegos
      pointerEvents: "none",            // nunca tapa nada clickeable
      display: "flex", flexDirection: "column", alignItems: "center", gap: "1.2vh",
    }}>
      <div style={{
        width: "6vw", height: "6vw", borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "3.2vw", background: "rgba(8,4,15,.55)",
        backdropFilter: "blur(6px)",
        border: `2px solid ${C.gold}`, boxShadow: "0 0 30px rgba(255,214,0,.4)",
      }}>{emoji}</div>

      {votos && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5vh" }}>
          <Barra icono="👍" pct={votos.up_pct   ?? 0} color={C.green}/>
          <Barra icono="👎" pct={votos.down_pct ?? 0} color={C.pink}/>
        </div>
      )}
    </div>
  );
}
