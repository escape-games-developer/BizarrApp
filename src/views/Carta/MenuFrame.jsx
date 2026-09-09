import { useEffect, useRef, useState } from "react";

/**
 * MENÚ — la carta del bar embebida desde WordPress.
 *
 * El contenido NO se replica acá: viene siempre de
 * https://bizarrenbar.com.ar/chupi-morfi/, así que lo que el staff publica en
 * WordPress es lo que ve el cliente, sin tocar la app.
 *
 * Vive DENTRO de la app: se monta como cualquier otra vista, dentro de
 * `<main class="app-content">`, con el header y la nav de siempre alrededor.
 * No abre pestañas ni saca al usuario de la interfaz — salvo el botón de
 * emergencia del fallback, que es la única salida y sólo aparece si el iframe
 * no cargó.
 *
 * Sobre el alto: `.app-content` es un flex item (`flex: 1`) dentro de
 * `.phone-shell`, que mide 100dvh — o sea que su alto YA es "lo que queda
 * descontando header y nav". Lo único que hace falta es llenarlo, y cancelar
 * su padding para que la carta vaya a sangre. De ahí los márgenes negativos y
 * el `calc(100% + …)`: si ese padding cambia en styles.js, hay que actualizar
 * PAD_* acá.
 */

const MENU_URL = "https://bizarrenbar.com.ar/chupi-morfi/";

// Padding de `.app-content` en src/constants/styles.js: 14px 16px 16px.
const PAD_TOP = 14;
const PAD_X   = 16;
const PAD_BOT = 16;

// WordPress + Cloudflare en un celular del bar puede tardar. Pasado esto sin
// un `load`, se muestra el fallback — el iframe sigue montado detrás por si
// termina de cargar tarde.
const TIMEOUT_MS = 12000;

export default function MenuFrame() {
  const [estado, setEstado] = useState("cargando"); // cargando | listo | error
  const timerRef = useRef(null);

  // Se rearma en cada intento: al reintentar, el iframe se remonta y necesita
  // su propio timeout. Con el efecto corriendo una sola vez, un segundo intento
  // que también fallara se quedaba con "Cargando menú…" para siempre.
  useEffect(() => {
    if (estado !== "cargando") return undefined;
    timerRef.current = setTimeout(() => setEstado("error"), TIMEOUT_MS);
    return () => clearTimeout(timerRef.current);
  }, [estado]);

  const alCargar = () => {
    clearTimeout(timerRef.current);
    setEstado("listo");
  };

  // `onError` casi nunca dispara en iframes bloqueados por X-Frame-Options
  // (el navegador rellena con una página de error propia y emite `load`), por
  // eso el timeout de arriba es el detector real. Se deja igual por los fallos
  // de red, que sí lo emiten.
  const alFallar = () => {
    clearTimeout(timerRef.current);
    setEstado("error");
  };

  const contenedor = {
    position: "relative",
    // Cancela el padding de `.app-content` para que la carta vaya a sangre.
    margin: `-${PAD_TOP}px -${PAD_X}px -${PAD_BOT}px`,
    height: `calc(100% + ${PAD_TOP + PAD_BOT}px)`,
    minHeight: `calc(100% + ${PAD_TOP + PAD_BOT}px)`,
    width: `calc(100% + ${PAD_X * 2}px)`,
    maxWidth: `calc(100% + ${PAD_X * 2}px)`,
    overflow: "hidden",          // nunca scroll horizontal: el vertical lo hace el iframe
    background: "#0D0700",
    // Respeta el notch/barra inferior de los celulares. La nav de la app ya
    // está debajo, así que sólo hace falta cuando el navegador no la reserva.
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
    boxSizing: "border-box",
  };

  const capa = {
    position: "absolute", inset: 0,
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: 12, padding: "24px 20px", textAlign: "center",
    background: "#0D0700",
  };

  return (
    <div style={contenedor}>
      {estado !== "error" && (
        <iframe
          src={MENU_URL}
          title="Menú Bizarren"
          onLoad={alCargar}
          onError={alFallar}
          // `allow-scripts` + `allow-same-origin` para que WordPress funcione;
          // `allow-popups` para que un link del menú no quede muerto.
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
          referrerPolicy="no-referrer-when-downgrade"
          loading="eager"
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            border: "none",
            background: "#0D0700",
            // Sin esto, iOS no deja scrollear dentro del iframe.
            WebkitOverflowScrolling: "touch",
          }}
        />
      )}

      {estado === "cargando" && (
        <div style={capa}>
          <div style={{ fontSize: 34 }}>🍹</div>
          <div style={{
            fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 14,
            color: "rgba(255,215,0,.7)",
          }}>
            Cargando menú…
          </div>
        </div>
      )}

      {estado === "error" && (
        <div style={capa}>
          <div style={{ fontSize: 38 }}>📋</div>
          <div style={{
            fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 15,
            color: "#F5E6C0",
          }}>
            No pudimos cargar el menú.
          </div>
          <div style={{ fontSize: 12, color: "rgba(245,230,192,.42)", lineHeight: 1.5, maxWidth: 260 }}>
            Puede ser la conexión. Probá de nuevo o abrilo en el navegador.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
            <button
              onClick={() => setEstado("cargando")}
              style={{
                padding: "11px 18px", borderRadius: 11, cursor: "pointer",
                background: "rgba(255,215,0,.08)", border: "1px solid rgba(255,215,0,.28)",
                color: "rgba(255,215,0,.85)",
                fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 12.5,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              ↻ REINTENTAR
            </button>
            {/* Única salida de la app, y sólo como último recurso. */}
            <a
              href={MENU_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "11px 18px", borderRadius: 11, textDecoration: "none",
                background: "linear-gradient(135deg,#FFD700,#FF9500)", color: "#0D0700",
                fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 12.5,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              ABRIR MENÚ
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
