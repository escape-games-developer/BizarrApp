import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLiveEvent } from "../../services/pantallaDj";

/**
 * Item desplegable de «Pantalla» en el sidebar del admin.
 *
 * El sidebar existente (`SECS` + `.sb-btn`) sólo sabe de items planos. Esto no
 * lo rediseña: agrega un único botón padre que despliega sus hijos y reusa las
 * mismas clases (`sb-btn`, `sb-btn-icon`, `sb-btn-label`) para que se vea igual
 * que el resto.
 *
 * Se despliega por hover y por click. El click es lo que hace que funcione en
 * touch, donde el hover no existe: ahí el primer toque abre y el segundo cierra.
 *
 * Con el sidebar expandido el submenú es un acordeón inline — empuja los items
 * de abajo y viaja con el scroll de `.sb-nav`, que es `overflow-y:auto`. Con el
 * sidebar colapsado (60px) no entra ningún label, así que ahí sale como flyout
 * `position:fixed` anclado al botón: fixed y no absolute, porque el `overflow`
 * del `.sb-nav` recortaría un absolute.
 */

const HIJOS = [
  { id: "pantallaEditor", icon: "✏️", label: "Editor",     titulo: "Configuración del evento" },
  { id: "pantallaLive",   icon: "🔴", label: "En vivo",    titulo: "Consola del DJ" },
];

const SIN_EVENTO = "No hay evento activo";

export default function PantallaSidebarMenu({ sec, setSec, collapsed }) {
  const [fijado,  setFijado]  = useState(false);   // abierto por click
  const [encima,  setEncima]  = useState(false);   // abierto por hover
  const [evento,  setEvento]  = useState(null);
  const [caja,    setCaja]    = useState(null);    // rect del botón, para el flyout
  const botonRef = useRef(null);

  const hijoActivo = HIJOS.some((h) => h.id === sec);
  const desplegado = fijado || encima || (hijoActivo && !collapsed);
  const habilitado = !!evento;

  const cargarEvento = useCallback(async () => {
    try { setEvento(await fetchLiveEvent()); }
    catch { setEvento(null); }
  }, []);

  // Al montar y cada vez que se abre: el evento en vivo puede haber cambiado
  // desde otra pestaña, y el menú no justifica un canal de Realtime propio.
  useEffect(() => { cargarEvento(); }, [cargarEvento]);
  useEffect(() => { if (desplegado) cargarEvento(); }, [desplegado, cargarEvento]);

  // El flyout del sidebar colapsado se ancla al botón en coordenadas de ventana.
  useEffect(() => {
    if (!collapsed || !desplegado) { setCaja(null); return; }
    const medir = () => { if (botonRef.current) setCaja(botonRef.current.getBoundingClientRect()); };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [collapsed, desplegado]);

  // Un toque fuera cierra el submenú fijado por click (el camino de touch).
  useEffect(() => {
    if (!fijado) return;
    const fuera = (e) => {
      if (!botonRef.current?.parentElement?.contains(e.target)) setFijado(false);
    };
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [fijado]);

  const elegir = (hijo) => {
    if (!habilitado) return;
    setSec(hijo.id);
    setFijado(false);
    setEncima(false);
  };

  const estiloHijo = (hijo) => ({
    display: "flex", alignItems: "center", width: "100%",
    border: "none", borderRadius: 7, cursor: habilitado ? "pointer" : "not-allowed",
    fontFamily: "inherit", fontSize: 11.5, fontWeight: 500, textAlign: "left",
    padding: collapsed ? "6px 10px" : "5px 8px 5px 20px",
    color: sec === hijo.id ? "#FFD600" : "#F0E8FF",
    background: sec === hijo.id ? "#9B2FFF33" : "none",
    opacity: habilitado ? 1 : .35,
    transition: "background .12s",
  });

  const listaHijos = (
    <>
      {HIJOS.map((h) => (
        <button key={h.id} type="button" disabled={!habilitado}
          title={habilitado ? h.titulo : SIN_EVENTO}
          onClick={() => elegir(h)}
          onMouseEnter={(e) => { if (habilitado) e.currentTarget.style.background = sec === h.id ? "#9B2FFF44" : "#9B2FFF22"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = sec === h.id ? "#9B2FFF33" : "none"; }}
          style={estiloHijo(h)}>
          <span style={{ fontSize: 13, width: 18, flexShrink: 0, display: "flex", justifyContent: "center" }}>
            {h.icon}
          </span>
          <span style={{ marginLeft: 7, flex: 1 }}>{h.label}</span>
        </button>
      ))}
      {!habilitado && (
        <div style={{ fontSize: 9.5, color: "rgba(240,232,255,.3)", padding: collapsed ? "4px 10px 6px" : "2px 8px 6px 20px", lineHeight: 1.4 }}>
          {SIN_EVENTO}
        </div>
      )}
    </>
  );

  return (
    <div
      onMouseEnter={() => setEncima(true)}
      onMouseLeave={() => setEncima(false)}
      style={{ position: "relative" }}>

      <button ref={botonRef} type="button"
        className={`sb-btn${hijoActivo ? " sb-btn-active" : ""}`}
        onClick={() => setFijado((v) => !v)}
        aria-expanded={desplegado}
        title="Pantalla"
        style={{ justifyContent: collapsed ? "center" : "flex-start" }}>
        <span className="sb-btn-icon">🎧</span>
        {!collapsed && <span className="sb-btn-label">Pantalla</span>}
        {!collapsed && (
          <span style={{
            fontSize: 9, marginLeft: 4, opacity: .55, flexShrink: 0,
            transform: desplegado ? "rotate(90deg)" : "none", transition: "transform .15s",
          }}>▸</span>
        )}
      </button>

      {/* Acordeón inline — sidebar expandido */}
      {!collapsed && desplegado && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1, padding: "2px 0 4px" }}>
          {listaHijos}
        </div>
      )}

      {/* Flyout — sidebar colapsado */}
      {collapsed && desplegado && caja && (
        <div style={{
          position: "fixed", top: caja.top, left: caja.right + 6, zIndex: 1200,
          minWidth: 168, padding: 5, borderRadius: 11,
          background: "#0A0514", border: "1px solid #9B2FFF55",
          boxShadow: "0 10px 34px rgba(0,0,0,.6)",
          display: "flex", flexDirection: "column", gap: 1,
        }}>
          <div style={{
            fontSize: 9.5, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase",
            color: "#FFD600", padding: "4px 10px 5px",
          }}>Pantalla</div>
          {listaHijos}
        </div>
      )}
    </div>
  );
}
