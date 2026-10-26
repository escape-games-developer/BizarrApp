import { useEffect, useState } from "react";

/**
 * «Instalar» del panel (/admin → app «Bizarr Panel», manifest-panel.json).
 *
 * Android / Chrome: el aviso nativo (`beforeinstallprompt`), que main.jsx
 * captura y deja en `window.__bizarrAvisoInstalar` (puede llegar antes de que
 * esto se monte). iPad / iPhone: no hay aviso; se explica cómo agregarlo al
 * inicio. Instalado (o sin forma de instalar) no se muestra.
 */

const instalada = () =>
  window.matchMedia?.("(display-mode: standalone)").matches
  || window.matchMedia?.("(display-mode: fullscreen)").matches
  || window.navigator.standalone === true;
const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export default function BotonInstalar({ estilo }) {
  const [aviso, setAviso] = useState(() => window.__bizarrAvisoInstalar || null);
  const [ayudaIOS, setAyudaIOS] = useState(false);
  const [listo, setListo] = useState(instalada);

  useEffect(() => {
    const alPoder = () => setAviso(window.__bizarrAvisoInstalar || null);
    const alInstalar = () => { window.__bizarrAvisoInstalar = null; setAviso(null); setListo(true); };
    window.addEventListener("bizarr-instalable", alPoder);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("bizarr-instalable", alPoder);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  if (listo || (!aviso && !esIOS())) return null;

  const instalar = async () => {
    if (esIOS()) { setAyudaIOS((v) => !v); return; }
    aviso.prompt();
    await aviso.userChoice.catch(() => null);
    // El aviso nativo se usa una sola vez: Chrome manda otro si corresponde.
    window.__bizarrAvisoInstalar = null;
    setAviso(null);
  };

  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button type="button" onClick={instalar} title="Instalar el panel como app en este dispositivo"
        style={{ minHeight: 40, padding: "0 14px", borderRadius: 12, cursor: "pointer", whiteSpace: "nowrap",
          border: "1px solid rgba(255,214,0,.5)", background: "rgba(255,214,0,.12)", color: "#FFD600",
          fontFamily: "'DM Sans',sans-serif", fontWeight: 800, fontSize: 13, ...estilo }}>
        ⬇ Instalar app
      </button>
      {ayudaIOS && (
        <span role="note" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 50, width: 240,
          padding: "10px 12px", borderRadius: 12, background: "#1A0D2E", border: "1px solid rgba(255,214,0,.45)",
          boxShadow: "0 10px 30px rgba(0,0,0,.6)", color: "#F0E8FF", fontSize: 12.5, lineHeight: 1.45,
          fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>
          En Safari tocá <b>Compartir</b> ⬆️ y después <b>Agregar a inicio</b>.
        </span>
      )}
    </span>
  );
}
