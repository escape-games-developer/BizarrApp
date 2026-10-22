import LogoCampana from "../components/LogoCampana";
import LogoJuego from "../components/LogoJuego";
import QrEsquina from "../components/QrEsquina";
import { usePantallaLogo, usePantallaQr } from "../hooks/usePantallaQr";
import { useEscenarioListo, fuenteListo, ESCENARIO_LISTO_POR_DEFECTO } from "../hooks/useEscenarioListo";
import { efectoDuelo, escalaDeZoom, EFECTOS_CSS } from "../hooks/useDueloPantalla";

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
  // Ajustes → QR y logo (por juego: 'ftl' | 'pt').
  const mostrarQr   = usePantallaQr()[juego.type] !== false;
  const mostrarLogo = usePantallaLogo()[juego.type] !== false;
  // Respaldo por juego: si la config no llega, cada uno con su propio cartel.
  const listo = useEscenarioListo()[juego.type]
    || ESCENARIO_LISTO_POR_DEFECTO[juego.type] || ESCENARIO_LISTO_POR_DEFECTO.ftl;

  // Candidato preparado: la TV ya muestra quién va a jugar, pero el video
  // todavía no arranca. El QR sale de escena — el turno de este ya está
  // resuelto y el cartel tiene que ser sobre él.
  if (participante) {
    // «LISTO PARA …» editable (Admin → FTL/PT → Pantalla del participante
    // listo): texto o imagen, con efecto, tamaño, ubicación, fuente y color.
    // Tres capas como en el Duelo: zoom → efecto → contenido.
    const ef = efectoDuelo(listo.efecto);
    const fuente = fuenteListo(listo.fuente);
    const cartelListo = (
      <div style={{ transform: `scale(${escalaDeZoom(listo.zoom)})`, transition: "transform .3s ease",
        transformOrigin: listo.posicion === "arriba" ? "50% 100%" : "50% 0" }}>
        <div style={{ animation: ef.anim, transformOrigin: ef.origen || "50% 50%" }}>
          {listo.centro === "imagen" && listo.imagen ? (
            <img src={listo.imagen} alt="" style={{ display: "block", height: "16vh", maxWidth: "80vw",
              objectFit: "contain", filter: "drop-shadow(0 6px 24px rgba(0,0,0,.6))" }}/>
          ) : (
            <div style={{
              fontFamily: fuente.css, fontWeight: fuente.peso,
              fontSize: "clamp(13px, 1.7vw, 30px)", letterSpacing: ".16em",
              color: listo.color, textAlign: "center", maxWidth: "86vw",
              textShadow: "0 3px 16px rgba(0,0,0,.7)",
            }}>{listo.texto}</div>
          )}
        </div>
      </div>
    );
    return (
      <div data-tv-ftl-candidato style={{
        position: "absolute", inset: 0, zIndex: 50,
        background: `radial-gradient(circle at 50% 40%, #1A0D2E 0%, ${C.bg} 70%)`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: "3vh", padding: "4vh 4vw", overflow: "hidden",
      }}>
        <style>{EFECTOS_CSS}</style>
        {listo.posicion === "arriba" && cartelListo}
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

        {listo.posicion === "abajo" && cartelListo}
      </div>
    );
  }

  // Convocatoria: logo BizarrApp con campana arriba a la izquierda (igual que
  // las placas de anuncio), el logo del juego al centro y el QR —si está
  // visible en Ajustes → QR en pantalla— abajo a la izquierda, con la leyenda
  // arriba.
  return (
    <div data-tv-ftl-standby style={{
      position: "absolute", inset: 0, zIndex: 50,
      background: `radial-gradient(circle at 50% 40%, #1A0D2E 0%, ${C.bg} 70%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "4vh 4vw", overflow: "hidden",
    }}>
      {mostrarLogo && <LogoCampana/>}

      <LogoJuego src={juego.placa} alt={juego.label} style={{
        maxWidth: "60vw", maxHeight: "62vh",
        filter: "drop-shadow(0 10px 40px rgba(255,149,0,.35))",
      }}/>

      {mostrarQr && <QrEsquina url={url}/>}
    </div>
  );
}
