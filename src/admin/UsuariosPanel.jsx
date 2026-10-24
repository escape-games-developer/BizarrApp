import { useCallback, useEffect, useMemo, useState } from "react";
import { ROLES, ROLES_CON_SECCIONES, esActivo, listarUsuariosSistema } from "../services/usuariosSistema";
import {
  ModalEditarUsuario, ModalEliminarUsuario, ModalNuevoUsuario, ModalResetearPassword,
} from "./usuarios/ModalesUsuario";
import {
  BotonAcciones, CeldaConexion, CeldaVerificado, Encabezado, MenuFila, Vistas,
  card, soloLector, td, tenue, th, useMenuYModal,
} from "./usuarios/comunes";

/**
 * Usuarios del sistema — anfitriones, producción y administradores generales.
 *
 * La lista sale de `admin_list_staff` (ver services/usuariosSistema.js), que
 * sólo responde a administradores. `grupos` son las secciones que se le pueden
 * asignar a anfitrión o producción, agrupadas como en el sidebar (las arma el AdminPanel).
 */

const ACCIONES = [
  { id: "reset",    label: "Resetear contraseña" },
  { id: "editar",   label: "Editar" },
  { id: "eliminar", label: "Eliminar usuario", peligro: true },
];

const FILTROS = {
  activos:    esActivo,
  admins:     (u) => u.rol === "admin",
  produccion: (u) => u.rol === "produccion",
  anfitrion:  (u) => u.rol === "anfitrion",
};

export default function UsuariosPanel({ grupos }) {
  const [usuarios, setUsuarios] = useState(null);   // null = cargando
  const [error, setError] = useState(null);
  const [vista, setVista] = useState(null);
  const { menu, modal, setModal, alternar, cerrarMenu, elegir, cerrarModal } = useMenuYModal();

  const cargar = useCallback(async () => {
    setError(null);
    try { setUsuarios(await listarUsuariosSistema()); }
    catch (e) { setError(e.message); setUsuarios([]); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const recargar = () => { setUsuarios(null); cargar(); };

  const listo = usuarios !== null && !error;
  const contar = (f) => (listo ? usuarios.filter(f).length : null);
  const filtrados = useMemo(
    () => (usuarios && vista ? usuarios.filter(FILTROS[vista]) : usuarios),
    [usuarios, vista],
  );

  return (
    <div style={{ maxWidth: 1100 }}>
      <Encabezado titulo="Usuarios del sistema">
        <button type="button" className="btn btn-g" style={{ padding: "6px 12px", fontSize: 11 }}
          onClick={recargar} disabled={usuarios === null}>
          Actualizar
        </button>
        <button type="button" className="btn btn-p" style={{ padding: "6px 14px", fontSize: 11,
          "--sg": "linear-gradient(135deg,#9B2FFF,#FF2D78)", "--gw": "rgba(155,47,255,.3)" }}
          onClick={() => setModal({ tipo: "nuevo" })}>
          + Nuevo usuario
        </button>
      </Encabezado>

      <Vistas activa={vista} onCambiar={setVista} vistas={[
        { id: "activos",  label: "Usuarios activos", valor: contar(FILTROS.activos),  color: "#00F5A0" },
        { id: "admins",     label: "Administradores generales", valor: contar(FILTROS.admins),     color: "#FFD600" },
        { id: "produccion", label: "Producción",                valor: contar(FILTROS.produccion), color: "#FF2D78" },
        { id: "anfitrion",  label: "Anfitriones",               valor: contar(FILTROS.anfitrion),  color: "#00E5FF" },
      ]}/>

      <div style={{ ...card, overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 820, borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "20%" }}/><col/><col style={{ width: 170 }}/><col style={{ width: 120 }}/>
            <col style={{ width: 130 }}/><col style={{ width: 56 }}/>
          </colgroup>
          <thead>
            <tr>
              <th scope="col" style={th}>Nombre de usuario</th>
              <th scope="col" style={th}>Mail</th>
              <th scope="col" style={th}>Perfil</th>
              <th scope="col" style={th}>Mail verificado</th>
              <th scope="col" style={th}>Última conexión</th>
              <th scope="col" style={{ ...th, textAlign: "center" }}><span style={soloLector}>Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {usuarios === null && [0, 1].map((i) => (
              <tr key={i} aria-hidden="true"><td colSpan={6} style={td}>
                <div style={{ height: 12, borderRadius: 6, background: "rgba(240,232,255,.06)", width: i ? "55%" : "75%" }}/>
              </td></tr>
            ))}
            {usuarios !== null && error && (
              <tr><td colSpan={6} style={{ ...td, height: 72, whiteSpace: "normal", textAlign: "center" }}>
                <span role="alert" style={{ color: "#FCA5A5" }}>{error}</span>{" "}
                <button type="button" className="btn btn-g" style={{ padding: "5px 10px", fontSize: 10, marginLeft: 8 }} onClick={recargar}>Reintentar</button>
              </td></tr>
            )}
            {listo && filtrados.length === 0 && (
              <tr><td colSpan={6} style={{ ...td, height: 72, textAlign: "center", color: "rgba(240,232,255,.45)" }}>
                {usuarios.length === 0 ? "No hay usuarios del sistema." : "Ningún usuario en esta vista."}
              </td></tr>
            )}
            {listo && filtrados.map((u) => (
              <tr key={u.id} data-usuario={u.id}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(240,232,255,.03)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <td style={td} title={u.nombre || ""}>
                  {u.nombre || <span style={tenue}>Sin nombre</span>}
                  {u.esYo && <span style={{ marginLeft: 8, fontSize: 9.5, fontWeight: 800, letterSpacing: .6, textTransform: "uppercase", color: "#00E5FF" }}>vos</span>}
                </td>
                <td style={td} title={u.email || ""}>{u.email || <span style={tenue}>Sin mail</span>}</td>
                <td style={td}>
                  {ROLES[u.rol] ?? u.rol}
                  {ROLES_CON_SECCIONES.has(u.rol) && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: "rgba(240,232,255,.45)" }}>
                      · {u.secciones.length} {u.secciones.length === 1 ? "sección" : "secciones"}
                    </span>
                  )}
                </td>
                <td style={td}><CeldaVerificado verificado={u.emailVerificado}/></td>
                <td style={td}><CeldaConexion fecha={u.ultimaConexion}/></td>
                <td style={{ ...td, textAlign: "center", overflow: "visible" }}>
                  <BotonAcciones nombre={u.nombre || u.email || u.id} abierto={menu?.usuario.id === u.id}
                    onClick={(e) => alternar(u, e.currentTarget)}/>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {menu && (
        <MenuFila ancla={menu.ancla} onElegir={elegir} onCerrar={cerrarMenu}
          acciones={menu.usuario.esYo ? ACCIONES.filter((a) => a.id !== "eliminar") : ACCIONES}/>
      )}
      {modal?.tipo === "reset"    && <ModalResetearPassword usuario={modal.usuario} onCerrar={cerrarModal}/>}
      {modal?.tipo === "editar"   && <ModalEditarUsuario usuario={modal.usuario} grupos={grupos} onCerrar={cerrarModal} onGuardado={cargar}/>}
      {modal?.tipo === "eliminar" && <ModalEliminarUsuario usuario={modal.usuario} onCerrar={cerrarModal} onEliminado={cargar}/>}
      {modal?.tipo === "nuevo"    && <ModalNuevoUsuario tipo="staff" grupos={grupos} onCerrar={cerrarModal} onCreado={cargar}/>}
    </div>
  );
}
