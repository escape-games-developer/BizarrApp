import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Item padre del sidebar del admin con sus hijos en un flyout lateral
 * (DJ Democracy, Escenario, Juegos, Usuarios). El padre sólo agrupa: no es una
 * sección. Cada hijo se muestra con `labelMenu` si lo tiene, y si no con `label`.
 *
 * El submenú siempre sale hacia el costado, con el sidebar expandido o
 * colapsado. Reusa las clases del sidebar (`sb-btn`, `sb-btn-icon`,
 * `sb-btn-label`) para que el botón padre se vea igual que el resto.
 *
 * El flyout es `position:fixed` anclado al botón: `.sb` es `overflow:hidden` y
 * `.sb-nav` es `overflow-y:auto`, así que un absolute quedaría recortado. Fixed
 * tampoco ocupa lugar en el layout ni genera scroll horizontal.
 *
 * Mouse: abre al entrar al botón y se cierra con una demora corta al salir,
 * para poder cruzar del botón al flyout sin que desaparezca. El flyout arranca
 * pegado al botón y su `paddingLeft` transparente hace de puente.
 * Touch: el hover no existe; el toque abre y cierra, y un toque afuera cierra.
 * Sólo se escuchan punteros `mouse` para el hover, así el hover emulado del
 * touch no deja el menú trabado abierto.
 *
 * Hay un único flyout abierto a la vez: abrir uno cierra al anterior en el
 * acto, sin esperar su demora, para que no se pisen. Para que el cursor pueda
 * ir en diagonal desde un padre hasta su flyout cruzando por encima del padre
 * de abajo (Escenario → Juegos), con otro flyout abierto el hover espera
 * DEMORA_CAMBIO antes de abrir: pasar de largo no lo cambia. Además la primera
 * opción queda a la altura del botón, así el camino natural es horizontal.
 */

const DEMORA_CIERRE = 180;
const DEMORA_CAMBIO = 150;
let cerrarAbierto = null;   // cierre del flyout abierto ahora, si hay uno

export default function SidebarFlyoutMenu({ icon, label, hijos, sec, setSec, collapsed }) {
  const [fijado, setFijado] = useState(false);   // abierto por click/tap
  const [encima, setEncima] = useState(false);   // abierto por hover
  const [caja, setCaja] = useState(null);        // rect del botón
  const [top, setTop] = useState(null);          // top ya ajustado al viewport
  const raizRef = useRef(null);
  const botonRef = useRef(null);
  const flyoutRef = useRef(null);
  const timerRef = useRef(null);
  const timerAbrirRef = useRef(null);

  const hijoActivo = hijos.some((h) => h.id === sec);
  const abierto = fijado || encima;

  const cancelarCierre = () => { clearTimeout(timerRef.current); };
  const cancelarApertura = () => { clearTimeout(timerAbrirRef.current); };

  const cerrar = useCallback(() => {
    cancelarCierre();
    cancelarApertura();
    setFijado(false);
    setEncima(false);
  }, []);

  useEffect(() => {
    if (!abierto) return;
    if (cerrarAbierto && cerrarAbierto !== cerrar) cerrarAbierto();
    cerrarAbierto = cerrar;
    return () => { if (cerrarAbierto === cerrar) cerrarAbierto = null; };
  }, [abierto, cerrar]);

  useEffect(() => () => { cancelarCierre(); cancelarApertura(); }, []);

  const entrar = (e) => {
    if (e.pointerType !== "mouse") return;
    cancelarCierre();
    if (cerrarAbierto && cerrarAbierto !== cerrar) {
      cancelarApertura();
      timerAbrirRef.current = setTimeout(() => setEncima(true), DEMORA_CAMBIO);
    } else {
      setEncima(true);
    }
  };
  const salir = (e) => {
    if (e.pointerType !== "mouse") return;
    cancelarCierre();
    cancelarApertura();
    timerRef.current = setTimeout(() => setEncima(false), DEMORA_CIERRE);
  };

  // Contraer/expandir el sidebar mueve el botón con una transición: cerramos
  // en lugar de perseguirlo.
  useEffect(() => { cerrar(); }, [collapsed, cerrar]);

  // Anclaje al botón en coordenadas de ventana; se re-mide si algo se mueve.
  useEffect(() => {
    if (!abierto) { setCaja(null); return; }
    const medir = () => { if (botonRef.current) setCaja(botonRef.current.getBoundingClientRect()); };
    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);   // incluye el scroll de .sb-nav
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [abierto]);

  // La primera opción se centra en la altura del botón. Si el botón está cerca
  // del borde inferior, el flyout sube para no cortarse.
  useLayoutEffect(() => {
    if (!caja || !flyoutRef.current) { setTop(null); return; }
    const alto = flyoutRef.current.offsetHeight;
    const primera = flyoutRef.current.querySelector("[role=menuitem]");
    const desfase = primera
      ? primera.offsetTop + primera.offsetHeight / 2 - caja.height / 2
      : 5;
    setTop(Math.max(8, Math.min(caja.top - desfase, window.innerHeight - alto - 8)));
  }, [caja]);

  // Un toque/click fuera cierra el menú fijado (el camino de touch).
  useEffect(() => {
    if (!fijado) return;
    const fuera = (e) => { if (!raizRef.current?.contains(e.target)) cerrar(); };
    const tecla = (e) => { if (e.key === "Escape") cerrar(); };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [fijado, cerrar]);

  const elegir = (hijo) => {
    setSec(hijo.id);
    cerrar();
  };

  if (hijos.length === 0) return null;

  return (
    <div ref={raizRef} onPointerEnter={entrar} onPointerLeave={salir} style={{ position: "relative" }}>
      <button ref={botonRef} type="button"
        className={`sb-btn${hijoActivo ? " sb-btn-active" : ""}`}
        onClick={() => setFijado((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        title={label}>
        <span className="sb-btn-icon">{icon}</span>
        {!collapsed && <span className="sb-btn-label">{label}</span>}
        {!collapsed && <span style={{ fontSize: 9, marginLeft: 4, opacity: .55, flexShrink: 0 }}>▸</span>}
      </button>

      {abierto && caja && (
        <div ref={flyoutRef} role="menu" aria-label={label}
          style={{
            position: "fixed", top: top ?? caja.top - 5, left: caja.right, zIndex: 1200,
            paddingLeft: collapsed ? 8 : 12,
            visibility: top === null ? "hidden" : "visible",
          }}>
          <div style={{
            minWidth: 190, padding: 5, borderRadius: 11,
            background: "#0A0514", border: "1px solid #9B2FFF55",
            boxShadow: "0 10px 34px rgba(0,0,0,.6)",
            display: "flex", flexDirection: "column", gap: 1,
            animation: "fadeUp .15s ease",
          }}>
            <div style={{
              fontSize: 9.5, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase",
              color: "#FFD600", padding: "4px 10px 5px",
            }}>{label}</div>
            {hijos.map((h) => {
              const activo = sec === h.id;
              return (
                <button key={h.id} type="button" role="menuitem"
                  onClick={() => elegir(h)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = activo ? "#9B2FFF44" : "#9B2FFF22"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = activo ? "#9B2FFF33" : "none"; }}
                  style={{
                    display: "flex", alignItems: "center", width: "100%",
                    border: "none", borderRadius: 7, cursor: "pointer",
                    fontFamily: "inherit", fontSize: 12, fontWeight: 500, textAlign: "left",
                    padding: "7px 10px", whiteSpace: "nowrap",
                    color: activo ? "#FFD600" : "#F0E8FF",
                    background: activo ? "#9B2FFF33" : "none",
                    transition: "background .12s",
                  }}>
                  {/* Caja fija: cada emoji tiene su propia altura de línea y
                      desparejaría el alto de las opciones entre flyouts. */}
                  <span style={{ fontSize: 14, width: 20, height: 18, lineHeight: 1, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {h.icon}
                  </span>
                  <span style={{ marginLeft: 8, flex: 1 }}>{h.labelMenu ?? h.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
