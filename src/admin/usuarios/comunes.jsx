import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Piezas compartidas por las tablas de Usuarios del sistema y Clientes:
 * estilos, menú ⋮ de fila, tarjetas de vistas y celdas de verificación y
 * última conexión.
 */

export const th = { textAlign: "left", fontSize: 10, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase",
  color: "rgba(240,232,255,.45)", padding: "10px 12px", borderBottom: "1px solid rgba(240,232,255,.1)", whiteSpace: "nowrap" };
export const td = { padding: "0 12px", height: 48, fontSize: 12.5, color: "#F0E8FF", borderBottom: "1px solid rgba(240,232,255,.06)",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
export const card = { background: "rgba(240,232,255,.035)", border: "1px solid rgba(240,232,255,.1)", borderRadius: 18 };
export const tenue = { color: "rgba(240,232,255,.35)" };
export const soloLector = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" };

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" };
const IconoMas = () => (
  <svg {...svg} width="18" height="18" data-icono="mas-vertical">
    <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
  </svg>
);

/** Encabezado de la sección: título, acciones a la derecha. */
export function Encabezado({ titulo, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 20, fontWeight: 700 }}>{titulo}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

/**
 * Tarjetas de vistas arriba de la tabla. Cada una filtra la tabla; tocar la
 * activa otra vez la suelta (`null` = sin filtro). `vistas`:
 * `[{ id, label, valor, color, filtrable = true }]`.
 */
export function Vistas({ vistas, activa, onCambiar }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 14 }}>
      {vistas.map((v) => {
        const on = activa === v.id;
        const filtrable = v.filtrable !== false;
        return (
          <button key={v.id} type="button" aria-pressed={filtrable ? on : undefined} disabled={!filtrable}
            onClick={() => onCambiar(on ? null : v.id)}
            title={filtrable ? (on ? "Mostrar todos" : `Ver sólo: ${v.label}`) : undefined}
            style={{ ...card, borderRadius: 14, padding: "12px 14px", textAlign: "left", fontFamily: "inherit",
              cursor: filtrable ? "pointer" : "default", color: "#F0E8FF",
              borderColor: on ? v.color : "rgba(240,232,255,.1)",
              background: on ? `${v.color}1A` : card.background }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: .8, textTransform: "uppercase", color: "rgba(240,232,255,.5)" }}>
              {v.label}
            </div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 26, fontWeight: 700, color: v.color, marginTop: 2 }}>
              {v.valor ?? "–"}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Mail verificado: el usuario confirmó el registro o aceptó la invitación. */
export function CeldaVerificado({ verificado }) {
  return verificado
    ? <span style={{ color: "#00F5A0", fontWeight: 700, fontSize: 11.5 }}>✓ Verificado</span>
    : <span style={{ color: "#FFD600", fontWeight: 700, fontSize: 11.5 }}>Pendiente</span>;
}

const fechaHora = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Última conexión: relativa en la tabla, fecha y hora exactas en el tooltip. */
export function CeldaConexion({ fecha }) {
  if (!fecha) return <span style={tenue}>Nunca</span>;
  const d = new Date(fecha);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  const texto = min < 2 ? "Ahora"
    : min < 60 ? `Hace ${min} min`
    : min < 60 * 24 ? `Hace ${Math.round(min / 60)} h`
    : min < 60 * 24 * 30 ? `Hace ${Math.round(min / 1440)} d`
    : fechaHora.format(d).split(",")[0];
  return <span title={fechaHora.format(d)}>{texto}</span>;
}

/** Botón ⋮ de una fila. */
export function BotonAcciones({ nombre, abierto, onClick }) {
  return (
    <button type="button" aria-label={`Acciones de ${nombre}`} aria-haspopup="menu" aria-expanded={abierto}
      title="Acciones" onClick={onClick}
      style={{ width: 32, height: 32, borderRadius: 8, border: "none", padding: 0, cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        color: abierto ? "#FFD600" : "rgba(240,232,255,.7)",
        background: abierto ? "#9B2FFF33" : "transparent" }}>
      <IconoMas/>
    </button>
  );
}

/**
 * Menú contextual de una fila: fixed, anclado al botón, por encima de todo.
 * `acciones`: `[{ id, label, peligro? }]`.
 */
export function MenuFila({ ancla, acciones, onElegir, onCerrar }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const r = ancla.getBoundingClientRect();
    const alto = ref.current?.offsetHeight ?? 0, ancho = ref.current?.offsetWidth ?? 0;
    const abajo = r.bottom + 4 + alto <= window.innerHeight - 8;
    setPos({ top: abajo ? r.bottom + 4 : Math.max(8, r.top - 4 - alto), left: Math.max(8, r.right - ancho) });
  }, [ancla]);
  // El foco va al primer ítem recién cuando el menú es visible: mientras se
  // mide está en `visibility:hidden` y un elemento invisible no recibe foco.
  useEffect(() => {
    if (pos) ref.current?.querySelector("[role=menuitem]")?.focus();
  }, [pos]);
  useEffect(() => {
    const fuera = (e) => { if (!ref.current?.contains(e.target) && !ancla.contains(e.target)) onCerrar(false); };
    const tecla = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onCerrar(true); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const items = [...ref.current.querySelectorAll("[role=menuitem]")];
      const i = items.indexOf(document.activeElement);
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    };
    const mover = () => onCerrar(false);   // scroll o resize: el ancla se movió
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    window.addEventListener("scroll", mover, true);
    window.addEventListener("resize", mover);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", mover, true);
      window.removeEventListener("resize", mover);
    };
  }, [ancla, onCerrar]);
  return (
    <div ref={ref} role="menu" aria-label="Acciones del usuario" style={{
      position: "fixed", top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden",
      zIndex: 1200, minWidth: 190, padding: 5, borderRadius: 11, background: "#0A0514",
      border: "1px solid #9B2FFF55", boxShadow: "0 10px 34px rgba(0,0,0,.6)", display: "flex", flexDirection: "column", gap: 1,
    }}>
      {acciones.map((a) => (
        <button key={a.id} type="button" role="menuitem" onClick={() => onElegir(a.id)}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#9B2FFF22"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
          onFocus={(e) => { e.currentTarget.style.background = "#9B2FFF22"; }}
          onBlur={(e) => { e.currentTarget.style.background = "none"; }}
          style={{ border: "none", background: "none", borderRadius: 7, padding: "8px 10px", textAlign: "left",
            color: a.peligro ? "#FF6B9A" : "#F0E8FF", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>
          {a.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Estado del menú ⋮ y del modal abierto, compartido por las dos tablas.
 * Al elegir una acción el foco vuelve al ⋮ para que el modal lo devuelva ahí.
 */
export function useMenuYModal() {
  const [menu, setMenu] = useState(null);     // { usuario, ancla }
  const [modal, setModal] = useState(null);   // { tipo, usuario? }
  const menuRef = useRef(null);
  menuRef.current = menu;
  const cerrarMenu = useRef((devolverFoco) => {
    if (devolverFoco) menuRef.current?.ancla.focus();
    setMenu(null);
  }).current;
  const elegir = (tipo) => {
    const { usuario, ancla } = menuRef.current;
    ancla.focus();
    setMenu(null);
    setModal({ tipo, usuario });
  };
  const alternar = (usuario, ancla) => setMenu((m) => (m?.usuario.id === usuario.id ? null : { usuario, ancla }));
  const cerrarModal = useRef(() => setModal(null)).current;
  return { menu, modal, setModal, alternar, cerrarMenu, elegir, cerrarModal };
}
