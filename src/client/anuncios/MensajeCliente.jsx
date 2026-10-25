import { useState } from "react";
import LienzoPantalla from "../../lienzo/LienzoPantalla";
import { useLienzo } from "../../lienzo/useLienzo";

/**
 * Mensaje o promo que el operador manda al celular (Admin → Lanzar → Mensaje /
 * Promo con destino «Celulares»). Viene en `game_state.webapp_banner` y se ve
 * arriba de cualquier sección mientras el operador no lo saque.
 *
 * El cliente puede cerrarlo: se recuerda el id del mensaje cerrado, así un F5
 * no lo vuelve a mostrar pero el próximo envío (id nuevo) sí aparece.
 *
 * Forma: { id, tipo: "mensaje"|"promo", texto, subtitulo?, emoji?, efecto? }
 * `efecto`: fijo | banda | latido | neon.
 *
 * Diseñador → Placas → Celular: si el banner está editado en el lienzo
 * (`cel-mensaje` / `cel-promo` en lienzo_placas) se dibuja ése, con los
 * datos del envío; si no, el de siempre.
 */
const CERRADO_KEY = "bizarrapp.mensajeCerrado";

const leerCerrado = () => { try { return localStorage.getItem(CERRADO_KEY); } catch { return null; } };

const CSS = `
@keyframes mcBanda{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes mcLatido{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes mcNeon{0%,18%,22%,25%,53%,57%,100%{opacity:1}20%,24%,55%{opacity:.4}}
@keyframes mcEntra{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
`;

export default function MensajeCliente({ mensaje }) {
  const [cerrado, setCerrado] = useState(leerCerrado);
  const lienzo = useLienzo(mensaje?.id ? "placas" : null, { cada: 30000 });
  if (!mensaje?.id || !mensaje.texto || cerrado === mensaje.id) return null;

  const promo  = mensaje.tipo === "promo";
  const efecto = mensaje.efecto || "fijo";
  const color  = promo ? "#00E5FF" : "#FFD600";
  const grad   = promo ? "linear-gradient(135deg,#00E5FF,#00F5A0)" : "linear-gradient(135deg,#FFD600,#FF9500,#FF2D78)";

  const cerrar = () => {
    try { localStorage.setItem(CERRADO_KEY, mensaje.id); } catch { /* sin storage: sólo en memoria */ }
    setCerrado(mensaje.id);
  };

  const editado = lienzo[promo ? "cel-promo" : "cel-mensaje"];
  if (editado) return (
    <div role="status" style={{ marginBottom: 14, animation: "mcEntra .3s ease" }}>
      <style>{CSS}</style>
      <LienzoPantalla formato="banner" pantalla={editado} datos={{ vivo: true, texto: mensaje.texto,
        subtitulo: mensaje.subtitulo, emoji: mensaje.emoji, efecto, cerrar }}/>
    </div>
  );

  const textoGrad = { background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" };
  const titulo = efecto === "banda" ? (
    <div style={{ overflow: "hidden", margin: "0 -14px", padding: "4px 0",
      borderTop: `1px solid ${color}55`, borderBottom: `1px solid ${color}55` }}>
      <div style={{ display: "flex", width: "max-content",
        animation: `mcBanda ${Math.max(6, mensaje.texto.length * 0.3) + 5}s linear infinite` }}>
        {[0, 1, 2, 3].map(i => (
          <span key={i} aria-hidden={i > 0} style={{ ...textoGrad, fontSize: 22, fontWeight: 900,
            whiteSpace: "nowrap", paddingRight: 110 }}>{mensaje.texto}</span>
        ))}
      </div>
    </div>
  ) : (
    <div style={{
      fontSize: 18, fontWeight: 900, lineHeight: 1.2,
      ...(efecto === "neon"
        ? { color: "#fff", textShadow: "0 0 6px #fff,0 0 16px #FF2D78,0 0 32px #9B2FFF", animation: "mcNeon 2.6s infinite" }
        : textoGrad),
      ...(efecto === "latido" ? { animation: "mcLatido 1.4s ease-in-out infinite", transformOrigin: "left center" } : null),
    }}>{mensaje.texto}</div>
  );

  return (
    <div role="status" style={{
      position: "relative", padding: "12px 14px", marginBottom: 14, borderRadius: 14, overflow: "hidden",
      background: promo ? "linear-gradient(160deg,#001A1A,#001A2E)" : "linear-gradient(160deg,#1A0600,#2D1000)",
      border: `1px solid ${color}55`, animation: "mcEntra .3s ease",
    }}>
      <style>{CSS}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, paddingRight: 22 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color }}>
          {promo ? "🍺 PROMO" : "📣 MENSAJE DEL BAR"}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {promo && mensaje.emoji && <span aria-hidden="true" style={{ fontSize: 30, lineHeight: 1 }}>{mensaje.emoji}</span>}
        <div style={{ flex: 1, minWidth: 0 }}>{titulo}</div>
      </div>
      {mensaje.subtitulo && (
        <div style={{ fontSize: 12, color: "rgba(245,230,192,.6)", marginTop: 6, lineHeight: 1.4 }}>{mensaje.subtitulo}</div>
      )}
      <button onClick={cerrar} aria-label="Cerrar mensaje" style={{
        position: "absolute", top: 8, right: 10, background: "none", border: "none",
        color: "rgba(245,230,192,.45)", fontSize: 18, cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
    </div>
  );
}
