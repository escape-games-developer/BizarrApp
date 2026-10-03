import { useEffect, useState } from "react";

/**
 * MENÚ — la carta del bar embebida desde WordPress.
 *
 * El contenido NO se replica acá: viene siempre de MENU_URL, así que lo que el
 * staff publica en WordPress es lo que ve el cliente, sin tocar la app.
 *
 * Vive DENTRO de la app: se monta dentro de `<main class="app-content">`, con
 * el header y la nav de siempre alrededor.
 *
 * Ciclo de vida: App.jsx lo monta la primera vez que el usuario entra a MENÚ y
 * a partir de ahí sólo lo oculta (`visible`). Nunca se desmonta mientras dure
 * la SPA, así que hay UN solo iframe por sesión: salir y volver no vuelve a
 * descargar WordPress, y si todavía estaba cargando, sigue donde estaba.
 *
 * Sobre el alto: `.app-content` es un flex item (`flex: 1`) dentro de
 * `.phone-shell`, que mide 100dvh — o sea que su alto YA es "lo que queda
 * descontando header y nav". Lo único que hace falta es llenarlo, y cancelar
 * su padding para que la carta vaya a sangre. De ahí los márgenes negativos y
 * el `calc(100% + …)`: si ese padding cambia en styles.js, hay que actualizar
 * PAD_* acá.
 */

// Cuando WordPress implemente el modo app, pasa a
// "https://bizarrenbar.com.ar/chupi-morfi/?bizarrapp=1".
// NO usar `?embed=1`: `embed` es un query var de WordPress y devuelve la
// tarjeta oEmbed en vez de la página.
// Ese modo además podría avisar "menú listo" por postMessage; hasta que exista
// el contrato, el único indicador de listo es `onLoad`.
const MENU_URL ="https://bizarrenbar.com.ar/chupi-morfi/";

// Padding de `.app-content` en src/constants/styles.js: 14px 16px 16px.
const PAD_TOP = 14;
const PAD_X   = 16;
const PAD_BOT = 16;

// Pasado esto sin `load` el cartel avisa que está tardando. Es sólo un cambio
// de texto: la carga sigue, el iframe no se toca. Lentitud no es error — el
// WordPress actual puede tardar 25–40 s en una red móvil.
const LENTO_MS = 12000;

export default function MenuFrame({ visible = true }) {
  const [estado, setEstado]   = useState("cargando"); // cargando | lento | listo | error
  // Cambiarla remonta el iframe. Sólo lo hace el botón de reintentar, que
  // aparece únicamente ante un error real.
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (estado !== "cargando") return undefined;
    const t = setTimeout(() => setEstado(e => (e === "cargando" ? "lento" : e)), LENTO_MS);
    return () => clearTimeout(t);
  }, [estado, intento]);

  // `onError` casi nunca dispara en un iframe cross-origin; cuando lo hace es
  // una falla de red real. Fuera de eso no hay forma confiable de detectar un
  // error, así que ante la duda se sigue mostrando "cargando".
  const alFallar = () => setEstado("error");
  const reintentar = () => { setEstado("cargando"); setIntento(n => n + 1); };

  const contenedor = {
    display: visible ? "block" : "none",
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

  const titulo = {
    fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 14,
    color: "rgba(255,215,0,.7)", maxWidth: 280, lineHeight: 1.4,
  };

  return (
    <div style={contenedor}>
      <iframe
        key={intento}
        src={MENU_URL}
        title="Menú Bizarren"
        onLoad={() => setEstado("listo")}
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

      {(estado === "cargando" || estado === "lento") && (
        <div style={capa} role="status" aria-live="polite">
          <div style={{ fontSize: 34 }}>🍹</div>
          {estado === "cargando" ? (
            <div style={titulo}>Cargando menú…</div>
          ) : (
            <>
              <div style={titulo}>El menú está tardando un poco más de lo normal…</div>
              <div style={{ fontSize: 12, color: "rgba(245,230,192,.42)", lineHeight: 1.5 }}>
                Seguimos cargándolo.
              </div>
            </>
          )}
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
              onClick={reintentar}
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
