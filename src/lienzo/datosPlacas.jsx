import { cssDeTexto } from "./estilosTexto";

/**
 * Elementos «dato» de las placas de Lanzar (fila `lienzo_placas`): lo que
 * escribe el operador al mandar el Mensaje o la Promo, en la TV y en el banner
 * del celular (`datos = { texto, subtitulo, emoji, efecto, cerrar }`).
 *
 * El efecto del texto sigue siendo el de Diseñador → Placas → «Efecto del
 * texto» (fijo · banda · latido · neón): viaja con cada envío.
 */

const JUST = { left: "flex-start", center: "center", right: "flex-end" };
const EJEMPLO = { texto: "¡EN MINUTOS EMPEZAMOS A JUGAR!", subtitulo: "Escaneá el QR · Unite a BizarrApp", emoji: "🍺" };

export const DATOS_PLACAS_CSS = `
  @keyframes lzBanda{from{transform:translateX(0)}to{transform:translateX(-50%)}}
  @keyframes lzNeonPlaca{0%,18%,22%,25%,53%,57%,100%{opacity:1}20%,24%,55%{opacity:.35}}
`;

/** El texto del operador con el efecto elegido. Banda = corre de derecha a izquierda sin cortes. */
function TextoPlaca({ el, datos }) {
  const texto = datos?.texto || (datos?.vivo ? "" : EJEMPLO.texto);
  if (!texto) return null;
  const efecto = datos?.efecto || "fijo";
  const css = cssDeTexto(el.estilo);
  const t = el.estilo.tamano;
  if (efecto === "banda") {
    const dur = Math.max(8, texto.length * 0.45) + 5;
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", overflow: "hidden" }}>
        <div style={{ display: "flex", width: "max-content", animation: `lzBanda ${dur}s linear infinite` }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} aria-hidden={i > 0} style={{ ...css, whiteSpace: "nowrap", paddingRight: t * 2.2 }}>{texto}</span>
          ))}
        </div>
      </div>
    );
  }
  const fx = efecto === "neon"
    ? { color: "#fff", WebkitTextFillColor: "#fff", backgroundImage: "none",
        textShadow: `0 0 ${t * 0.08}px #fff,0 0 ${t * 0.24}px #FF2D78,0 0 ${t * 0.48}px #FF2D78,0 0 ${t * 0.9}px #9B2FFF`,
        animation: "lzNeonPlaca 2.6s infinite" }
    : efecto === "latido" ? { animation: "lzLatido 1.4s ease-in-out infinite" } : null;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: JUST[el.estilo.alinear] }}>
      <div style={{ ...css, width: "100%", ...fx }}>{texto}</div>
    </div>
  );
}

const valor = (leer, ejemplo) => function Valor({ el, datos }) {
  const v = datos ? leer(datos) : null;
  const texto = v || (datos?.vivo ? "" : ejemplo);
  if (!texto) return null;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: JUST[el.estilo.alinear] }}>
      <div style={{ ...cssDeTexto(el.estilo), width: "100%" }}>{texto}</div>
    </div>
  );
};

/** La × del banner del celular: el cliente lo cierra (se recuerda por envío). */
function Cerrar({ el, datos }) {
  return (
    <button type="button" aria-label="Cerrar mensaje" onClick={() => datos?.cerrar?.()}
      style={{ ...cssDeTexto(el.estilo), width: "100%", height: "100%", background: "none", border: "none", padding: 0,
        cursor: datos?.cerrar ? "pointer" : "default", lineHeight: 1 }}>×</button>
  );
}

export const DATOS_PLACAS = {
  placaTexto:    { nombre: "Texto del operador", Componente: TextoPlaca, sinFichas: true,
                   ayuda: "Lo que se escribe al mandar la placa en Lanzar. El efecto (fijo, banda, latido, neón) se elige en «Efecto del texto»." },
  placaSubtitulo: { nombre: "Subtítulo", Componente: valor((d) => d.subtitulo, EJEMPLO.subtitulo), sinFichas: true,
                   ayuda: "El subtítulo de la placa, si el envío trae uno." },
  placaEmoji:    { nombre: "Emoji de la promo", Componente: valor((d) => d.emoji, EJEMPLO.emoji), sinFichas: true,
                   ayuda: "El emoji que se elige al mandar la Promo." },
  placaCerrar:   { nombre: "Botón cerrar", Componente: Cerrar, sinFichas: true, sinEfecto: true,
                   ayuda: "La × con la que el cliente cierra el banner." },
};
