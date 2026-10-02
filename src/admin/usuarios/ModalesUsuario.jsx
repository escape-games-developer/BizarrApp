import { useEffect, useId, useRef, useState } from "react";
import {
  NOMBRE_MAX, ROL_ADMIN, actualizarNombre, enviarMailRecuperacion, motivoNombreInvalido,
} from "../../services/usuariosSistema";

/**
 * Modales de «Usuarios del sistema». Reusan los estilos de modal del Admin
 * (`.dd-modal-back`, `.dd-modal`, `.dd-modal-t`) y de formularios (`.inp`, `.btn`).
 *
 * Regla común: nunca se muestra éxito si el backend no lo confirmó, y lo que la
 * infraestructura actual no permite hacer queda visible pero deshabilitado,
 * con el motivo.
 */

const etiqueta = { display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: .4, color: "rgba(240,232,255,.5)", marginBottom: 5 };
const nota = { fontSize: 11, lineHeight: 1.5, color: "rgba(240,232,255,.45)", marginTop: 5 };
const caja = (tono) => ({
  padding: "9px 12px", borderRadius: 10, fontSize: 11.5, lineHeight: 1.5, marginTop: 12,
  ...(tono === "ok"    ? { background: "rgba(0,245,160,.08)", border: "1px solid rgba(0,245,160,.3)", color: "#00F5A0" }
    : tono === "error" ? { background: "rgba(255,45,120,.08)", border: "1px solid rgba(255,45,120,.3)", color: "#FCA5A5" }
    :                    { background: "rgba(240,232,255,.04)", border: "1px solid rgba(240,232,255,.1)", color: "rgba(240,232,255,.6)" }),
});

/** Base: overlay, Escape/click afuera cierran (salvo `ocupado`), foco inicial y devuelto. */
function Modal({ titulo, onCerrar, ocupado = false, children, pie }) {
  const tituloId = useId();
  const ref = useRef(null);
  useEffect(() => {
    const previo = document.activeElement;
    ref.current?.querySelector("input:not([disabled]),button:not([disabled])")?.focus();
    return () => previo?.focus?.();
  }, []);
  useEffect(() => {
    const tecla = (e) => { if (e.key === "Escape" && !ocupado) { e.stopPropagation(); onCerrar(); } };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [ocupado, onCerrar]);
  return (
    <div className="dd-modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget && !ocupado) onCerrar(); }}>
      <div ref={ref} className="dd-modal" role="dialog" aria-modal="true" aria-labelledby={tituloId} style={{ maxWidth: 480 }}>
        <div id={tituloId} className="dd-modal-t">{titulo}</div>
        {children}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>{pie}</div>
      </div>
    </div>
  );
}

/** Quién se está modificando, siempre visible arriba del modal. */
function UsuarioObjetivo({ usuario }) {
  return (
    <div style={{ ...caja(), marginTop: 0, marginBottom: 14, display: "grid", gap: 2 }}>
      <strong style={{ color: "#F0E8FF", fontSize: 12.5 }}>
        {usuario.nombre || "Sin nombre"}{usuario.esYo ? " (vos)" : ""}
      </strong>
      <span>{usuario.email || "Email no disponible desde el panel"}</span>
      <span style={{ fontFamily: "monospace", fontSize: 10.5, opacity: .7 }}>{usuario.id}</span>
    </div>
  );
}

// ── Resetear contraseña ─────────────────────────────────────────────────────
export function ModalResetearPassword({ usuario, onCerrar }) {
  const [estado, setEstado] = useState("listo");   // listo | enviando | ok | error
  const [error, setError] = useState(null);
  const puedeMail = !!usuario.email;

  const enviar = async () => {
    setEstado("enviando"); setError(null);
    try {
      await enviarMailRecuperacion(usuario.email);
      setEstado("ok");
    } catch (e) {
      setError(e.message); setEstado("error");
    }
  };

  return (
    <Modal titulo="Resetear contraseña" onCerrar={onCerrar} ocupado={estado === "enviando"}
      pie={<>
        <button type="button" className="btn btn-g" onClick={onCerrar} disabled={estado === "enviando"}>
          {estado === "ok" ? "Cerrar" : "Cancelar"}
        </button>
        {estado !== "ok" && (
          <button type="button" className="btn btn-p" disabled={!puedeMail || estado === "enviando"} onClick={enviar}
            style={{ "--sg": "linear-gradient(135deg,#9B2FFF,#FF2D78)", "--gw": "rgba(155,47,255,.3)" }}>
            {estado === "enviando" ? "Enviando…" : "Enviar mail de recuperación"}
          </button>
        )}
      </>}>
      <UsuarioObjetivo usuario={usuario}/>
      <p style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(240,232,255,.7)", margin: 0 }}>
        Supabase le manda al usuario un mail con un link para elegir una contraseña nueva. Desde el panel
        nunca se ve ni se escribe una contraseña.
      </p>
      {!puedeMail && (
        <div style={caja()}>
          No se puede enviar: el email de este usuario no se puede leer desde el navegador. Hace falta
          backend (Edge Function) para conocerlo o para enviar el mail por su id.
        </div>
      )}
      <div style={{ ...caja(), opacity: .7 }}>
        <strong>Definir una contraseña temporal</strong> — no disponible: requiere una Edge Function con
        privilegios de administración de Auth.
      </div>
      {estado === "ok" && (
        <div role="status" style={caja("ok")}>
          Supabase aceptó el envío del mail de recuperación a {usuario.email}. El link lleva a la pantalla de
          contraseña nueva de BizarrApp.
        </div>
      )}
      {estado === "error" && <div role="alert" style={caja("error")}>{error}</div>}
    </Modal>
  );
}

// ── Editar datos ────────────────────────────────────────────────────────────
export function ModalEditarUsuario({ usuario, onCerrar, onGuardado }) {
  const [nombre, setNombre] = useState(usuario.nombre ?? "");
  const [estado, setEstado] = useState("listo");   // listo | guardando | ok | error
  const [error, setError] = useState(null);
  const editableNombre = usuario.esYo;
  const motivo = motivoNombreInvalido(nombre);
  const cambio = nombre.trim() !== (usuario.nombre ?? "");

  const guardar = async () => {
    if (motivo || !cambio) return;
    setEstado("guardando"); setError(null);
    try {
      await actualizarNombre(usuario.id, nombre);
      setEstado("ok");
      onGuardado?.();
    } catch (e) {
      setError(e.message); setEstado("error");
    }
  };

  return (
    <Modal titulo="Editar datos" onCerrar={onCerrar} ocupado={estado === "guardando"}
      pie={<>
        <button type="button" className="btn btn-g" onClick={onCerrar} disabled={estado === "guardando"}>
          {estado === "ok" ? "Cerrar" : "Cancelar"}
        </button>
        {estado !== "ok" && (
          <button type="button" className="btn btn-p"
            disabled={!editableNombre || !!motivo || !cambio || estado === "guardando"} onClick={guardar}
            style={{ "--sg": "linear-gradient(135deg,#9B2FFF,#FF2D78)", "--gw": "rgba(155,47,255,.3)" }}>
            {estado === "guardando" ? "Guardando…" : "Guardar"}
          </button>
        )}
      </>}>
      <UsuarioObjetivo usuario={usuario}/>
      <form onSubmit={(e) => { e.preventDefault(); guardar(); }} style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={etiqueta} htmlFor="usr-id">ID</label>
          <input id="usr-id" className="inp" value={usuario.id} readOnly style={{ fontFamily: "monospace", fontSize: 11, opacity: .7 }}/>
          <div style={nota}>Identificador de Auth: no se modifica.</div>
        </div>
        <div>
          <label style={etiqueta} htmlFor="usr-nombre">Nombre de usuario</label>
          <input id="usr-nombre" className="inp" value={nombre} maxLength={NOMBRE_MAX}
            disabled={!editableNombre || estado === "guardando" || estado === "ok"}
            aria-invalid={!!motivo} aria-describedby="usr-nombre-nota"
            onChange={(e) => { setNombre(e.target.value); if (estado === "error") setEstado("listo"); }}/>
          <div id="usr-nombre-nota" style={{ ...nota, color: motivo && editableNombre ? "#FCA5A5" : nota.color }}>
            {!editableNombre
              ? "Sólo podés cambiar tu propio nombre: la base no deja editar el perfil de otro usuario."
              : motivo || `${nombre.trim().length}/${NOMBRE_MAX}. Es el nombre que también ven los clientes.`}
          </div>
        </div>
        <div>
          <label style={etiqueta} htmlFor="usr-mail">Mail</label>
          <input id="usr-mail" className="inp" value={usuario.email ?? ""} placeholder="No disponible desde el panel" readOnly disabled/>
          <div style={nota}>Cambiar el mail requiere el flujo de confirmación de Auth o backend de administración: todavía no disponible.</div>
        </div>
        <div>
          <label style={etiqueta} htmlFor="usr-rol">Rol</label>
          <select id="usr-rol" className="inp" value={ROL_ADMIN} disabled>
            <option value={ROL_ADMIN}>{ROL_ADMIN}</option>
          </select>
          <div style={nota}>La base no tiene roles: todos los usuarios del sistema son administradores.</div>
        </div>
      </form>
      {estado === "ok" && <div role="status" style={caja("ok")}>Nombre guardado.</div>}
      {estado === "error" && <div role="alert" style={caja("error")}>{error}</div>}
    </Modal>
  );
}

// ── Permisos (pendiente de definición) ───────────────────────────────────────
export function ModalPermisos({ usuario, onCerrar }) {
  return (
    <Modal titulo="Permisos" onCerrar={onCerrar}
      pie={<button type="button" className="btn btn-g" onClick={onCerrar}>Cerrar</button>}>
      <UsuarioObjetivo usuario={usuario}/>
      <p style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(240,232,255,.7)", margin: 0 }}>
        La configuración de permisos por usuario todavía no está disponible. Se va a diseñar como un modelo
        propio (acciones y visibilidad por usuario), separado de la configuración global de
        Ajustes → Vista del panel de opciones.
      </p>
    </Modal>
  );
}
