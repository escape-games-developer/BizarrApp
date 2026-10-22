import { colorDeJuego, estiloCard } from "./CatalogoJuegos";

/** Lado del recuadro del logo, el mismo para todos los juegos. */
const LOGO_PX = 170;

/**
 * Contenedor de postulación de los juegos con postulación (Follow the Leader,
 * Personal Trainer, Duelo de Talentos).
 *
 * El contenedor mide lo que su contenido (logo + texto + botón) y queda
 * centrado en vertical en la sección. El botón va siempre DENTRO.
 * `arriba` (p. ej. el vestuario) se dibuja antes y le resta alto.
 *
 * `estiloCards` (Ajustes → General → Estilo de cards en los juegos): con él, el
 * contenedor usa el look de las cards del catálogo — borde neón con el color de
 * ese juego y fondo casi transparente — y el botón ese mismo color. Sin él, los
 * colores propios del juego (`propio`).
 *
 * @param {string}  id          id del juego en el catálogo ('ftl' | 'pt' | 'duelo')
 * @param {object}  propio      { bg, borde, texto, boton } colores propios del juego
 */
export default function ContenedorPostulacion({
  id, logo, alt, titulo, textoBoton, onPostular, cargando = false,
  estiloCards = true, propio = {}, arriba = null, error = null,
}) {
  const color = colorDeJuego(id);
  const caja = estiloCards
    ? estiloCard(color)
    : { borderRadius: 18, background: propio.bg, border: `1px solid ${propio.borde}` };
  const fondoBoton = estiloCards ? `linear-gradient(135deg, ${color}, ${color}B3)` : propio.boton;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 420 }}>
      {arriba}
      {/* El contenedor mide lo que su contenido y queda centrado en el espacio libre. */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{
        ...caja, boxSizing: "border-box", padding: "22px 16px 18px",
        // Logo, texto y botón forman UN bloque centrado en vertical: no quedan
        // el logo en el medio y el botón pegado al pie.
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18,
      }}>
        {/* Logo en un recuadro FIJO (LOGO_PX), igual en todos los juegos: cada
            PNG se ajusta adentro, así ninguno queda más grande que otro. */}
        <div style={{ minHeight: 0, width: "100%", display: "flex",
          alignItems: "center", justifyContent: "center" }}>
          <img src={logo} alt={alt} draggable={false}
            style={{ width: LOGO_PX, height: LOGO_PX, maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
              filter: "drop-shadow(0 4px 14px rgba(0,0,0,.55))" }}
            onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}/>
        </div>
        {titulo && (
          <div style={{
            fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 17, lineHeight: 1.35,
            textAlign: "center", color: estiloCards ? "#F5E6C0" : propio.texto, padding: "0 6px",
          }}>{titulo}</div>
        )}
        <button className="btn-primary" disabled={cargando} onClick={onPostular}
          style={{ width: "100%", margin: 0, background: fondoBoton,
            boxShadow: estiloCards ? `0 0 18px ${color}66` : undefined }}>
          {cargando ? "Enviando…" : textoBoton}
        </button>
        {error && (
          <div style={{
            width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 10,
            background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)",
            color: "#FCA5A5", fontSize: 11.5, lineHeight: 1.5, textAlign: "center",
          }}>{error}</div>
        )}
      </div>
      </div>
    </div>
  );
}
