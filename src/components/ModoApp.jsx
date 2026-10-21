import { useEffect, useState } from "react";

/**
 * Reglas de "modo app" de la WebApp del cliente (sólo en `/`, la monta App):
 *
 *   1. Vertical fija. Instalada, la fija el manifest (`orientation: portrait`).
 *      En el navegador, `screen.orientation.lock` sólo funciona en pantalla
 *      completa: se pide junto con ella. Donde el navegador no deja bloquear
 *      (iPhone), si el celular se gira se tapa la app con «Girá el celular».
 *   2. Pantalla completa. Instalada abre sin barra de direcciones
 *      (`display_override: fullscreen`). En el navegador, la API exige un
 *      gesto del usuario: se pide en cada toque mientras no esté en pantalla
 *      completa. iPhone no la soporta en Safari: ahí la única forma es instalarla.
 *   3. Instalable. Android/Chrome: botón «Instalar» con el aviso nativo
 *      (`beforeinstallprompt`). iPhone/Safari: cómo agregarla al inicio.
 *      El cartel se puede cerrar y vuelve a aparecer a los 3 días.
 *
 * Nada de esto corre en Admin, /tv ni /pantalla: son pantallas horizontales.
 */

const CERRADO_KEY = "bizarr_instalar_cerrado";
const VOLVER_A_MOSTRAR_MS = 3 * 24 * 60 * 60 * 1000;

const esCelular = () => window.matchMedia?.("(pointer: coarse)").matches ?? false;
const instalada = () =>
  window.matchMedia?.("(display-mode: standalone)").matches
  || window.matchMedia?.("(display-mode: fullscreen)").matches
  || window.navigator.standalone === true;
const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function cerradoHace() {
  try { return Number(localStorage.getItem(CERRADO_KEY)) || 0; } catch { return 0; }
}

async function pantallaCompletaYVertical() {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    }
  } catch { /* el navegador no la permite: queda la barra */ }
  try { await screen.orientation?.lock?.("portrait"); } catch { /* sin bloqueo: queda el aviso */ }
}

export default function ModoApp() {
  const [aviso, setAviso] = useState(null);   // evento beforeinstallprompt
  const [mostrarInstalar, setMostrarInstalar] = useState(false);

  // 1 + 2: en cada toque, si no está en pantalla completa, se pide.
  useEffect(() => {
    if (!esCelular() || instalada()) {
      screen.orientation?.lock?.("portrait").catch(() => {});
      return undefined;
    }
    const alTocar = () => { if (!document.fullscreenElement) pantallaCompletaYVertical(); };
    window.addEventListener("pointerup", alTocar, { passive: true });
    return () => window.removeEventListener("pointerup", alTocar);
  }, []);

  // 3: ¿se puede ofrecer instalarla?
  useEffect(() => {
    if (!esCelular() || instalada()) return undefined;
    const recienCerrado = Date.now() - cerradoHace() < VOLVER_A_MOSTRAR_MS;
    if (esIOS()) { setMostrarInstalar(!recienCerrado); return undefined; }

    // main.jsx captura `beforeinstallprompt` (puede llegar antes de montar) y
    // lo deja en window; el aviso nativo sale cuando toquen nuestro botón.
    const alPoderInstalar = () => {
      if (!window.__bizarrAvisoInstalar) return;
      setAviso(window.__bizarrAvisoInstalar);
      setMostrarInstalar(!recienCerrado);
    };
    const alInstalar = () => { setMostrarInstalar(false); setAviso(null); window.__bizarrAvisoInstalar = null; };
    alPoderInstalar();
    window.addEventListener("bizarr-instalable", alPoderInstalar);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("bizarr-instalable", alPoderInstalar);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  const cerrar = () => {
    try { localStorage.setItem(CERRADO_KEY, String(Date.now())); } catch { /* sin storage: sólo por ahora */ }
    setMostrarInstalar(false);
  };

  const instalar = async () => {
    if (!aviso) return;
    aviso.prompt();
    const { outcome } = await aviso.userChoice.catch(() => ({ outcome: "dismissed" }));
    // El aviso nativo se usa una sola vez: Chrome manda otro si corresponde.
    window.__bizarrAvisoInstalar = null;
    setAviso(null);
    if (outcome === "accepted") setMostrarInstalar(false); else cerrar();
  };

  return (
    <>
      {/* Celular girado: sólo táctil y apaisado bajo (un celular, no una tablet). */}
      <style>{`
        .modoapp-girado{display:none}
        @media (orientation: landscape) and (pointer: coarse) and (max-height: 540px){
          .modoapp-girado{display:flex}
        }
      `}</style>
      <div className="modoapp-girado" role="alert" style={{
        position: "fixed", inset: 0, zIndex: 100000, background: "#08040F",
        flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
        textAlign: "center", padding: 24,
      }}>
        <div style={{ fontSize: 54, transform: "rotate(-90deg)" }} aria-hidden="true">📱</div>
        <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 18, color: "#FFD700" }}>
          Girá el celular
        </div>
        <div style={{ fontSize: 13, color: "rgba(245,230,192,.55)" }}>BizarrApp se usa en vertical.</div>
      </div>

      {mostrarInstalar && (esIOS() || aviso) && (
        <div style={{
          position: "fixed", bottom: 150, left: "50%", transform: "translateX(-50%)",
          zIndex: 9997, width: "calc(100% - 24px)", maxWidth: 420, boxSizing: "border-box",
          display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14,
          background: "#1A0D2E", border: "1px solid rgba(255,214,0,.45)",
          boxShadow: "0 10px 30px rgba(0,0,0,.6)", fontFamily: "'Space Grotesk', sans-serif",
        }}>
          <img src="/icons/icon-192.png" alt="" width={36} height={36} style={{ borderRadius: 8, flexShrink: 0 }}/>
          <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "#F5E6C0", lineHeight: 1.35 }}>
            <strong style={{ color: "#FFD700" }}>Instalá BizarrApp</strong>
            <div style={{ color: "rgba(245,230,192,.65)", fontSize: 11.5 }}>
              {esIOS()
                ? <>Tocá <b>Compartir</b> ⬆️ y después <b>Agregar a inicio</b>.</>
                : "Abrila como app, en pantalla completa."}
            </div>
          </div>
          {!esIOS() && (
            <button type="button" onClick={instalar} style={{
              background: "#FFD700", color: "#08040F", border: "none", borderRadius: 999,
              padding: "7px 14px", fontWeight: 800, fontSize: 12.5, cursor: "pointer", flexShrink: 0,
            }}>Instalar</button>
          )}
          <button type="button" onClick={cerrar} aria-label="Cerrar" style={{
            background: "transparent", border: "none", color: "rgba(245,230,192,.6)",
            fontSize: 18, fontWeight: 700, cursor: "pointer", padding: "0 2px", flexShrink: 0,
          }}>×</button>
        </div>
      )}
    </>
  );
}
