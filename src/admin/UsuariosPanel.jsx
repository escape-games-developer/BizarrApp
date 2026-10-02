import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { listarUsuariosSistema } from "../services/usuariosSistema";
import { ModalEditarUsuario, ModalPermisos, ModalResetearPassword } from "./usuarios/ModalesUsuario";

/**
 * Usuarios del sistema — tabla de administradores del panel.
 *
 * Muestra sólo datos reales (ver services/usuariosSistema.js): id de Auth,
 * nombre de `profiles`, email (sólo el propio; el resto requiere backend) y el
 * único rol que existe hoy. La lista llega entera de la base; búsqueda o
 * paginación se agregarían sobre `usuarios` sin cambiar la tabla.
 */

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" };
const IconoMas = () => (
  <svg {...svg} width="18" height="18" data-icono="mas-vertical">
    <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
  </svg>
);
const IconoCopiar = () => (
  <svg {...svg} width="13" height="13">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
  </svg>
);

const ACCIONES = [
  { id: "reset",    label: "Resetear contraseña" },
  { id: "editar",   label: "Editar datos" },
  { id: "permisos", label: "Permisos" },
];

const th = { textAlign: "left", fontSize: 10, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase",
  color: "rgba(240,232,255,.45)", padding: "10px 12px", borderBottom: "1px solid rgba(240,232,255,.1)", whiteSpace: "nowrap" };
const td = { padding: "0 12px", height: 48, fontSize: 12.5, color: "#F0E8FF", borderBottom: "1px solid rgba(240,232,255,.06)",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const card = { background: "rgba(240,232,255,.035)", border: "1px solid rgba(240,232,255,.1)", borderRadius: 18 };

/** ID: versión corta en la tabla, completo en tooltip y botón para copiar. */
function CeldaId({ id }) {
  const [copiado, setCopiado] = useState(null);   // null | "ok" | "error"
  const copiar = async () => {
    try { await navigator.clipboard.writeText(id); setCopiado("ok"); }
    catch { setCopiado("error"); }
    setTimeout(() => setCopiado(null), 1500);
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <code title={id} style={{ fontSize: 11.5, color: "rgba(240,232,255,.75)" }}>{id.slice(0, 8)}…</code>
      <button type="button" onClick={copiar} title={copiado === "ok" ? "Copiado" : copiado === "error" ? "No se pudo copiar" : "Copiar ID completo"}
        aria-label="Copiar ID completo"
        style={{ border: "none", background: "none", padding: 3, borderRadius: 6, cursor: "pointer", display: "flex",
          color: copiado === "ok" ? "#00F5A0" : copiado === "error" ? "#FCA5A5" : "rgba(240,232,255,.4)" }}>
        <IconoCopiar/>
      </button>
      {copiado && <span role="status" style={{ fontSize: 10, color: copiado === "ok" ? "#00F5A0" : "#FCA5A5" }}>
        {copiado === "ok" ? "Copiado" : "No se pudo copiar"}</span>}
    </span>
  );
}

/** Menú contextual de una fila: fixed, anclado al botón, por encima de todo. */
function MenuFila({ ancla, onElegir, onCerrar }) {
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
      {ACCIONES.map((a) => (
        <button key={a.id} type="button" role="menuitem" onClick={() => onElegir(a.id)}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#9B2FFF22"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
          onFocus={(e) => { e.currentTarget.style.background = "#9B2FFF22"; }}
          onBlur={(e) => { e.currentTarget.style.background = "none"; }}
          style={{ border: "none", background: "none", borderRadius: 7, padding: "8px 10px", textAlign: "left",
            color: "#F0E8FF", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>
          {a.label}
        </button>
      ))}
    </div>
  );
}

export default function UsuariosPanel() {
  const [usuarios, setUsuarios] = useState(null);   // null = cargando
  const [error, setError] = useState(null);
  const [menu, setMenu] = useState(null);           // { usuario, ancla }
  const [modal, setModal] = useState(null);         // { tipo, usuario }
  const menuRef = useRef(null);
  menuRef.current = menu;

  const cargar = useCallback(async () => {
    setError(null);
    try { setUsuarios(await listarUsuariosSistema()); }
    catch (e) { setError(e.message); setUsuarios([]); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const cerrarMenu = useCallback((devolverFoco) => {
    if (devolverFoco) menuRef.current?.ancla.focus();
    setMenu(null);
  }, []);
  const elegir = (tipo) => {
    const { usuario, ancla } = menu;
    ancla.focus();          // el modal devuelve el foco a este botón al cerrarse
    setMenu(null);
    setModal({ tipo, usuario });
  };
  const cerrarModal = useCallback(() => setModal(null), []);

  const soloYo = usuarios?.length > 0 && usuarios.every((u) => u.esYo);

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 900 }}>Usuarios del sistema</div>
          <div style={{ fontSize: 12, color: "rgba(240,232,255,.5)", marginTop: 4 }}>
            Cuentas con acceso al panel de administración.
            {usuarios && !error ? ` · ${usuarios.length} ${usuarios.length === 1 ? "usuario" : "usuarios"}` : ""}
          </div>
        </div>
        <button type="button" className="btn btn-g" style={{ padding: "6px 12px", fontSize: 11 }}
          onClick={() => { setUsuarios(null); cargar(); }} disabled={usuarios === null}>
          Actualizar
        </button>
      </div>

      {soloYo && (
        <div style={{ ...card, borderRadius: 10, padding: "9px 12px", fontSize: 11.5, lineHeight: 1.5, color: "rgba(240,232,255,.6)", marginBottom: 12 }}>
          Ves sólo tu usuario: con la configuración actual de la base, cada administrador puede leer únicamente su
          propia fila. Listar a los demás (y ver sus mails) requiere backend.
        </div>
      )}

      <div style={{ ...card, overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 150 }}/><col/><col style={{ width: "34%" }}/><col style={{ width: 140 }}/><col style={{ width: 64 }}/>
          </colgroup>
          <thead>
            <tr>
              <th scope="col" style={th}>ID</th>
              <th scope="col" style={th}>Nombre de usuario</th>
              <th scope="col" style={th}>Mail</th>
              <th scope="col" style={th}>Rol</th>
              <th scope="col" style={{ ...th, textAlign: "center" }}><span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {usuarios === null && [0, 1].map((i) => (
              <tr key={i} aria-hidden="true"><td colSpan={5} style={td}>
                <div style={{ height: 12, borderRadius: 6, background: "rgba(240,232,255,.06)", width: i ? "55%" : "75%" }}/>
              </td></tr>
            ))}
            {usuarios !== null && error && (
              <tr><td colSpan={5} style={{ ...td, height: 72, whiteSpace: "normal", textAlign: "center" }}>
                <span role="alert" style={{ color: "#FCA5A5" }}>{error}</span>{" "}
                <button type="button" className="btn btn-g" style={{ padding: "5px 10px", fontSize: 10, marginLeft: 8 }} onClick={() => { setUsuarios(null); cargar(); }}>Reintentar</button>
              </td></tr>
            )}
            {usuarios !== null && !error && usuarios.length === 0 && (
              <tr><td colSpan={5} style={{ ...td, height: 72, textAlign: "center", color: "rgba(240,232,255,.45)" }}>No hay usuarios del sistema.</td></tr>
            )}
            {usuarios !== null && !error && usuarios.map((u) => (
              <tr key={u.id} data-usuario={u.id}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(240,232,255,.03)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <td style={td}><CeldaId id={u.id}/></td>
                <td style={td} title={u.nombre || ""}>
                  {u.nombre || <span style={{ color: "rgba(240,232,255,.35)" }}>Sin nombre</span>}
                  {u.esYo && <span style={{ marginLeft: 8, fontSize: 9.5, fontWeight: 800, letterSpacing: .6, textTransform: "uppercase", color: "#00E5FF" }}>vos</span>}
                </td>
                <td style={td} title={u.email || "No disponible desde el panel"}>
                  {u.email || <span style={{ color: "rgba(240,232,255,.35)" }}>No disponible</span>}
                </td>
                <td style={td}>{u.rol}</td>
                <td style={{ ...td, textAlign: "center", overflow: "visible" }}>
                  <button type="button"
                    aria-label={`Acciones de ${u.nombre || u.id}`} aria-haspopup="menu" aria-expanded={menu?.usuario.id === u.id}
                    title="Acciones"
                    onClick={(e) => { const ancla = e.currentTarget; setMenu((m) => (m?.usuario.id === u.id ? null : { usuario: u, ancla })); }}
                    style={{ width: 32, height: 32, borderRadius: 8, border: "none", padding: 0, cursor: "pointer",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      color: menu?.usuario.id === u.id ? "#FFD600" : "rgba(240,232,255,.7)",
                      background: menu?.usuario.id === u.id ? "#9B2FFF33" : "transparent" }}>
                    <IconoMas/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {menu && <MenuFila ancla={menu.ancla} onElegir={elegir} onCerrar={cerrarMenu}/>}
      {modal?.tipo === "reset"    && <ModalResetearPassword usuario={modal.usuario} onCerrar={cerrarModal}/>}
      {modal?.tipo === "editar"   && <ModalEditarUsuario usuario={modal.usuario} onCerrar={cerrarModal} onGuardado={cargar}/>}
      {modal?.tipo === "permisos" && <ModalPermisos usuario={modal.usuario} onCerrar={cerrarModal}/>}
    </div>
  );
}
