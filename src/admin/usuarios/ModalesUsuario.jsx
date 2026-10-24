import { useEffect, useId, useRef, useState } from "react";
import {
  NOMBRE_MAX, ROLES, ROLES_CON_SECCIONES, actualizarNombre, crearUsuario, eliminarUsuario, enviarMailRecuperacion, guardarAcceso,
  motivoMailInvalido, motivoNombreInvalido,
} from "../../services/usuariosSistema";
import { TEAMS } from "../../constants/theme";

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
function Modal({ titulo, onCerrar, ocupado = false, ancho = 480, children, pie }) {
  const tituloId = useId();
  const ref = useRef(null);
  useEffect(() => {
    const previo = document.activeElement;
    ref.current?.querySelector("input:not([disabled]),select:not([disabled]),button:not([disabled])")?.focus();
    return () => previo?.focus?.();
  }, []);
  useEffect(() => {
    const tecla = (e) => { if (e.key === "Escape" && !ocupado) { e.stopPropagation(); onCerrar(); } };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [ocupado, onCerrar]);
  return (
    <div className="dd-modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget && !ocupado) onCerrar(); }}>
      <div ref={ref} className="dd-modal" role="dialog" aria-modal="true" aria-labelledby={tituloId}
        style={{ maxWidth: ancho, maxHeight: "calc(100vh - 32px)", overflowY: "auto" }}>
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
      <span>{usuario.email || "Sin mail"}</span>
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
      {!puedeMail && <div style={caja()}>Este usuario no tiene mail cargado: no se puede enviar.</div>}
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

// ── Perfiles ─────────────────────────────────────────────────────────────────

const NOTA_PERFIL = {
  anfitrion:  "Ve y usa sólo las secciones que le habilites abajo.",
  produccion: "Arranca con todas las secciones; podés sacarle las que no necesite.",
  admin:      "Ve y usa todo, incluidas Usuarios del sistema y Clientes.",
};

function OpcionesPerfil() {
  return ["anfitrion", "produccion", "admin"].map((r) => <option key={r} value={r}>{ROLES[r]}</option>);
}

/**
 * Secciones al elegir un perfil: Producción arranca con todas, Anfitrión sin
 * ninguna (se las habilita el admin). Si el usuario ya tenía ese perfil, se
 * respetan las que tenía.
 */
function seccionesIniciales(rol, grupos, usuario = null) {
  if (usuario && usuario.rol === rol) return usuario.secciones ?? [];
  if (rol === "produccion") return grupos.flatMap((g) => g.items.map((s) => s.id));
  return [];
}

// ── Editar: datos, rol y secciones ──────────────────────────────────────────

const mismoConjunto = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Secciones que ve el usuario, agrupadas como en el sidebar. Cada grupo es un
 * bloque con su nombre, cuántas tiene prendidas y un botón «Todo / Nada»; cada
 * sección es una pastilla que se prende o apaga con un clic. Las secciones
 * sueltas del sidebar van juntas en «General».
 * `grupos`: `[{ id, titulo, items: [{ id, icon, label }] }]`; `titulo` null
 * para las secciones sueltas.
 */
function SelectorSecciones({ grupos, elegidas, onCambiar, deshabilitado }) {
  const todas = grupos.flatMap((g) => g.items.map((s) => s.id));
  const sueltas = grupos.filter((g) => !g.titulo).flatMap((g) => g.items);
  const bloques = [
    ...(sueltas.length ? [{ id: "general", titulo: "General", items: sueltas }] : []),
    ...grupos.filter((g) => g.titulo),
  ];
  const marcar = (ids, on) => onCambiar(on
    ? [...new Set([...elegidas, ...ids])]
    : elegidas.filter((id) => !ids.includes(id)));
  const total = elegidas.filter((id) => todas.includes(id)).length;
  const enlace = { border: "none", background: "none", padding: 0, fontSize: 11, fontWeight: 700,
    color: "#00E5FF", cursor: "pointer", fontFamily: "inherit" };

  return (
    <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <legend style={{ ...etiqueta, marginBottom: 0, padding: 0 }}>Secciones que ve ({total}/{todas.length})</legend>
        {!deshabilitado && (
          <span style={{ display: "flex", gap: 12 }}>
            <button type="button" style={enlace} onClick={() => onCambiar(todas)}>Todas</button>
            <button type="button" style={enlace} onClick={() => onCambiar([])}>Ninguna</button>
          </span>
        )}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {bloques.map((g) => {
          const ids = g.items.map((s) => s.id);
          const prendidas = ids.filter((id) => elegidas.includes(id)).length;
          const completo = prendidas === ids.length;
          return (
            <div key={g.id} style={{ padding: "10px 12px", borderRadius: 11,
              background: prendidas ? "rgba(155,47,255,.07)" : "rgba(240,232,255,.03)",
              border: `1px solid ${prendidas ? "rgba(155,47,255,.3)" : "rgba(240,232,255,.08)"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ flex: 1, fontSize: 11, fontWeight: 800, letterSpacing: .6, textTransform: "uppercase",
                  color: prendidas ? "#F0E8FF" : "rgba(240,232,255,.55)" }}>
                  {g.titulo} <span style={{ fontWeight: 600, color: "rgba(240,232,255,.4)" }}>· {prendidas}/{ids.length}</span>
                </span>
                {!deshabilitado && (
                  <button type="button" style={enlace} onClick={() => marcar(ids, !completo)}>
                    {completo ? "Nada" : "Todo"}
                  </button>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {g.items.map((s) => {
                  const on = elegidas.includes(s.id);
                  return (
                    <button key={s.id} type="button" role="switch" aria-checked={on} disabled={deshabilitado}
                      onClick={() => marcar([s.id], !on)}
                      style={{ padding: "6px 12px", borderRadius: 999, fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                        cursor: deshabilitado ? "default" : "pointer", opacity: deshabilitado ? .55 : 1,
                        transition: "background .12s,border-color .12s,color .12s",
                        background: on ? "rgba(155,47,255,.28)" : "transparent",
                        border: `1px solid ${on ? "#9B2FFF" : "rgba(240,232,255,.16)"}`,
                        color: on ? "#F0E8FF" : "rgba(240,232,255,.55)" }}>
                      {on ? "✓ " : ""}{s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ModalEditarUsuario({ usuario, grupos, onCerrar, onGuardado }) {
  const [nombre, setNombre] = useState(usuario.nombre ?? "");
  const [rol, setRol] = useState(usuario.rol);
  const [secciones, setSecciones] = useState(usuario.secciones ?? []);
  const [estado, setEstado] = useState("listo");   // listo | guardando | ok | error
  const [error, setError] = useState(null);

  const editableNombre = usuario.esYo;
  const editableRol = !usuario.esYo;   // nadie se quita a sí mismo el rol de administrador
  const motivo = editableNombre ? motivoNombreInvalido(nombre) : null;
  const cambioNombre = editableNombre && nombre.trim() !== (usuario.nombre ?? "");
  const cambioAcceso = rol !== usuario.rol
    || (ROLES_CON_SECCIONES.has(rol) && !mismoConjunto(secciones, usuario.secciones ?? []));
  const bloqueado = estado === "guardando" || estado === "ok";

  const guardar = async () => {
    if (motivo || (!cambioNombre && !cambioAcceso)) return;
    setEstado("guardando"); setError(null);
    try {
      if (cambioNombre) await actualizarNombre(usuario.id, nombre);
      if (cambioAcceso) await guardarAcceso(usuario.id, rol, secciones);
      setEstado("ok");
      onGuardado?.();
    } catch (e) {
      setError(e.message); setEstado("error");
    }
  };
  const tocar = () => { if (estado === "error") setEstado("listo"); };

  return (
    <Modal titulo="Editar usuario" ancho={560} onCerrar={onCerrar} ocupado={estado === "guardando"}
      pie={<>
        <button type="button" className="btn btn-g" onClick={onCerrar} disabled={estado === "guardando"}>
          {estado === "ok" ? "Cerrar" : "Cancelar"}
        </button>
        {estado !== "ok" && (
          <button type="button" className="btn btn-p"
            disabled={!!motivo || (!cambioNombre && !cambioAcceso) || estado === "guardando"} onClick={guardar}
            style={{ "--sg": "linear-gradient(135deg,#9B2FFF,#FF2D78)", "--gw": "rgba(155,47,255,.3)" }}>
            {estado === "guardando" ? "Guardando…" : "Guardar"}
          </button>
        )}
      </>}>
      <UsuarioObjetivo usuario={usuario}/>
      <form onSubmit={(e) => { e.preventDefault(); guardar(); }} style={{ display: "grid", gap: 14 }}>
        <div>
          <label style={etiqueta} htmlFor="usr-nombre">Nombre de usuario</label>
          <input id="usr-nombre" className="inp" value={nombre} maxLength={NOMBRE_MAX}
            disabled={!editableNombre || bloqueado}
            aria-invalid={!!motivo} aria-describedby="usr-nombre-nota"
            onChange={(e) => { setNombre(e.target.value); tocar(); }}/>
          <div id="usr-nombre-nota" style={{ ...nota, color: motivo ? "#FCA5A5" : nota.color }}>
            {!editableNombre
              ? "Cada usuario cambia su propio nombre."
              : motivo || `${nombre.trim().length}/${NOMBRE_MAX}. Es el nombre que también ven los clientes.`}
          </div>
        </div>
        <div>
          <label style={etiqueta} htmlFor="usr-rol">Perfil</label>
          <select id="usr-rol" className="inp" value={rol} disabled={!editableRol || bloqueado}
            aria-describedby="usr-rol-nota"
            onChange={(e) => { const r = e.target.value; setRol(r); setSecciones(seccionesIniciales(r, grupos, usuario)); tocar(); }}>
            <OpcionesPerfil/>
          </select>
          <div id="usr-rol-nota" style={nota}>
            {!editableRol
              ? "No podés cambiar tu propio perfil: otro administrador tiene que hacerlo."
              : NOTA_PERFIL[rol]}
          </div>
        </div>
        {ROLES_CON_SECCIONES.has(rol) && (
          <SelectorSecciones grupos={grupos} elegidas={secciones} deshabilitado={bloqueado}
            onCambiar={(ids) => { setSecciones(ids); tocar(); }}/>
        )}
        {ROLES_CON_SECCIONES.has(rol) && secciones.length === 0 && (
          <div style={{ ...caja(), marginTop: 0 }}>Sin secciones marcadas, entra al panel pero no ve nada.</div>
        )}
      </form>
      {estado === "ok" && <div role="status" style={caja("ok")}>Cambios guardados. El usuario los ve la próxima vez que abra el panel.</div>}
      {estado === "error" && <div role="alert" style={caja("error")}>{error}</div>}
    </Modal>
  );
}

// ── Nuevo usuario ───────────────────────────────────────────────────────────
//
// `tipo`: "staff" (Anfitrión, Producción o Administrador general) o "cliente". En los dos casos la
// Edge Function crea la cuenta y Supabase le manda el mail de invitación: la
// persona valida el mail y elige su contraseña desde el link.

export function ModalNuevoUsuario({ tipo, grupos = [], onCerrar, onCreado }) {
  const esStaff = tipo === "staff";
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState("anfitrion");
  const [secciones, setSecciones] = useState([]);
  const [team, setTeam] = useState("");
  const [telefono, setTelefono] = useState("");
  const [tocado, setTocado] = useState(false);
  const [estado, setEstado] = useState("listo");   // listo | guardando | ok | error
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);

  const motivoNombre = motivoNombreInvalido(nombre);
  const motivoMail = motivoMailInvalido(email);
  const bloqueado = estado === "guardando" || estado === "ok";

  const crear = async () => {
    setTocado(true);
    if (motivoNombre || motivoMail) return;
    setEstado("guardando"); setError(null);
    try {
      const r = await crearUsuario({
        tipo: esStaff ? rol : "cliente", email, nombre,
        team: esStaff ? null : team || null,
        telefono: esStaff ? null : telefono.trim() || null,
        secciones,
      });
      setResultado(r); setEstado("ok");
      onCreado?.();
    } catch (e) {
      setError(e.message); setEstado("error");
    }
  };
  const tocar = () => { if (estado === "error") setEstado("listo"); };

  return (
    <Modal titulo={esStaff ? "Nuevo usuario del sistema" : "Nuevo cliente"} ancho={esStaff ? 560 : 480}
      onCerrar={onCerrar} ocupado={estado === "guardando"}
      pie={<>
        <button type="button" className="btn btn-g" onClick={onCerrar} disabled={estado === "guardando"}>
          {estado === "ok" ? "Cerrar" : "Cancelar"}
        </button>
        {estado !== "ok" && (
          <button type="button" className="btn btn-p" onClick={crear}
            disabled={estado === "guardando" || (tocado && (!!motivoNombre || !!motivoMail))}
            style={{ "--sg": "linear-gradient(135deg,#9B2FFF,#FF2D78)", "--gw": "rgba(155,47,255,.3)" }}>
            {estado === "guardando" ? "Creando…" : "Crear y enviar mail"}
          </button>
        )}
      </>}>
      <form onSubmit={(e) => { e.preventDefault(); crear(); }} style={{ display: "grid", gap: 14 }}>
        <div>
          <label style={etiqueta} htmlFor="nu-nombre">{esStaff ? "Nombre de usuario" : "Nombre / Alias"}</label>
          <input id="nu-nombre" className="inp" value={nombre} maxLength={NOMBRE_MAX} disabled={bloqueado}
            aria-invalid={tocado && !!motivoNombre}
            onChange={(e) => { setNombre(e.target.value); tocar(); }}/>
          {tocado && motivoNombre && <div style={{ ...nota, color: "#FCA5A5" }}>{motivoNombre}</div>}
        </div>
        <div>
          <label style={etiqueta} htmlFor="nu-mail">Mail</label>
          <input id="nu-mail" className="inp" type="email" autoComplete="off" value={email} disabled={bloqueado}
            aria-invalid={tocado && !!motivoMail}
            onChange={(e) => { setEmail(e.target.value); tocar(); }}/>
          <div style={{ ...nota, color: tocado && motivoMail ? "#FCA5A5" : nota.color }}>
            {tocado && motivoMail ? motivoMail : "Le llega un mail para validar la cuenta y elegir su contraseña."}
          </div>
        </div>

        {esStaff ? (<>
          <div>
            <label style={etiqueta} htmlFor="nu-rol">Perfil</label>
            <select id="nu-rol" className="inp" value={rol} disabled={bloqueado}
              onChange={(e) => { const r = e.target.value; setRol(r); setSecciones(seccionesIniciales(r, grupos)); tocar(); }}>
              <OpcionesPerfil/>
            </select>
            <div style={nota}>
              {NOTA_PERFIL[rol]}{ROLES_CON_SECCIONES.has(rol) && " Se pueden cambiar después desde Editar."}
            </div>
          </div>
          {ROLES_CON_SECCIONES.has(rol) && (
            <SelectorSecciones grupos={grupos} elegidas={secciones} deshabilitado={bloqueado}
              onCambiar={(ids) => { setSecciones(ids); tocar(); }}/>
          )}
        </>) : (<>
          <div>
            <label style={etiqueta} htmlFor="nu-team">Team</label>
            <select id="nu-team" className="inp" value={team} disabled={bloqueado}
              onChange={(e) => { setTeam(e.target.value); tocar(); }}>
              <option value="">Sin team</option>
              {Object.values(TEAMS).map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}
            </select>
          </div>
          <div>
            <label style={etiqueta} htmlFor="nu-tel">Teléfono</label>
            <input id="nu-tel" className="inp" type="tel" value={telefono} maxLength={30} disabled={bloqueado}
              onChange={(e) => { setTelefono(e.target.value); tocar(); }}/>
          </div>
        </>)}
      </form>
      {estado === "ok" && (
        <div role="status" style={caja("ok")}>
          {resultado?.existente
            ? `${email.trim()} ya tenía cuenta en BizarrApp: se le dio acceso como ${ROLES[rol]}. Entra al panel con su contraseña de siempre.`
            : `Usuario creado. Supabase le mandó el mail de invitación a ${email.trim()}; queda «Pendiente» hasta que lo valide.`}
        </div>
      )}
      {estado === "error" && <div role="alert" style={caja("error")}>{error}</div>}
    </Modal>
  );
}

// ── Eliminar usuario ────────────────────────────────────────────────────────
export function ModalEliminarUsuario({ usuario, onCerrar, onEliminado }) {
  const [estado, setEstado] = useState("listo");   // listo | borrando | ok | error
  const [error, setError] = useState(null);

  const eliminar = async () => {
    setEstado("borrando"); setError(null);
    try {
      await eliminarUsuario(usuario.id);
      setEstado("ok");
      onEliminado?.();
    } catch (e) {
      setError(e.message); setEstado("error");
    }
  };

  return (
    <Modal titulo="Eliminar usuario" onCerrar={onCerrar} ocupado={estado === "borrando"}
      pie={<>
        <button type="button" className="btn btn-g" onClick={onCerrar} disabled={estado === "borrando"}>
          {estado === "ok" ? "Cerrar" : "Cancelar"}
        </button>
        {estado !== "ok" && (
          <button type="button" className="btn btn-p" onClick={eliminar} disabled={estado === "borrando" || usuario.esYo}
            style={{ "--sg": "linear-gradient(135deg,#FF2D78,#FF6B35)", "--gw": "rgba(255,45,120,.3)" }}>
            {estado === "borrando" ? "Eliminando…" : "Eliminar definitivamente"}
          </button>
        )}
      </>}>
      <UsuarioObjetivo usuario={usuario}/>
      {usuario.esYo ? (
        <div style={{ ...caja(), marginTop: 0 }}>No podés eliminar tu propio usuario desde el panel.</div>
      ) : (
        <p style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(240,232,255,.7)", margin: 0 }}>
          Se borra la cuenta y todo lo que tiene asociado (perfil, mensajes, votos, cupones). No se puede
          deshacer: para volver a usar BizarrApp tendría que registrarse de nuevo.
        </p>
      )}
      {estado === "ok" && <div role="status" style={caja("ok")}>Usuario eliminado.</div>}
      {estado === "error" && <div role="alert" style={caja("error")}>{error}</div>}
    </Modal>
  );
}
