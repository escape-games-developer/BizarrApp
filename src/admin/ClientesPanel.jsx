import { useCallback, useEffect, useMemo, useState } from "react";
import { DIAS_ACTIVO, esActivo, listarClientes } from "../services/usuariosSistema";
import { TEAMS } from "../constants/theme";
import { ModalEliminarUsuario, ModalNuevoUsuario } from "./usuarios/ModalesUsuario";
import {
  BotonAcciones, CeldaConexion, CeldaVerificado, Encabezado, MenuFila, Vistas,
  card, soloLector, td, tenue, th, useMenuYModal,
} from "./usuarios/comunes";

/**
 * Clientes — cuentas registradas desde la app que no son usuarios del sistema.
 * La lista sale de `admin_list_clients` (mail desde auth.users), que responde a
 * administradores y a operadores con la sección «clientes».
 *
 * Activo = se conectó en los últimos DIAS_ACTIVO días.
 */

const ACCIONES = [{ id: "eliminar", label: "Eliminar usuario", peligro: true }];

const FILTROS = {
  activos:   esActivo,
  inactivos: (c) => !esActivo(c),
};

const normalizar = (t) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function CeldaTeam({ team }) {
  const t = TEAMS[team];
  if (!t) return <span style={tenue}>Sin team</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999,
      fontSize: 11, fontWeight: 700, color: t.color, background: t.bg, border: `1px solid ${t.border}` }}>
      <span aria-hidden="true">{t.emoji}</span>{t.name.replace("Team ", "")}
    </span>
  );
}

export default function ClientesPanel() {
  const [clientes, setClientes] = useState(null);   // null = cargando
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState(null);
  const { menu, modal, setModal, alternar, cerrarMenu, elegir, cerrarModal } = useMenuYModal();

  const cargar = useCallback(async () => {
    setError(null);
    try { setClientes(await listarClientes()); }
    catch (e) { setError(e.message); setClientes([]); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const recargar = () => { setClientes(null); cargar(); };

  const listo = clientes !== null && !error;
  const contar = (f) => (listo ? (f ? clientes.filter(f).length : clientes.length) : null);

  const filtrados = useMemo(() => {
    if (!clientes) return clientes;
    const q = normalizar(busqueda.trim());
    return clientes.filter((c) => (!vista || FILTROS[vista](c))
      && (!q || [c.nombre, c.email, c.telefono].some((v) => normalizar(v).includes(q))));
  }, [clientes, busqueda, vista]);

  return (
    <div style={{ maxWidth: 1100 }}>
      <Encabezado titulo="Clientes">
        <input className="inp" type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, mail o teléfono" aria-label="Buscar clientes"
          style={{ width: 260, maxWidth: "100%", padding: "7px 11px", fontSize: 12 }}/>
        <button type="button" className="btn btn-g" style={{ padding: "6px 12px", fontSize: 11 }}
          onClick={recargar} disabled={clientes === null}>
          Actualizar
        </button>
        <button type="button" className="btn btn-p" style={{ padding: "6px 14px", fontSize: 11,
          "--sg": "linear-gradient(135deg,#9B2FFF,#FF2D78)", "--gw": "rgba(155,47,255,.3)" }}
          onClick={() => setModal({ tipo: "nuevo" })}>
          + Nuevo cliente
        </button>
      </Encabezado>

      <Vistas activa={vista} onCambiar={setVista} vistas={[
        { id: "total",     label: "Usuarios totales",   valor: contar(null), color: "#F0E8FF", filtrable: false },
        { id: "activos",   label: "Usuarios activos",   valor: contar(FILTROS.activos),   color: "#00F5A0" },
        { id: "inactivos", label: "Usuarios inactivos", valor: contar(FILTROS.inactivos), color: "#FF6B9A" },
      ]}/>
      <div style={{ fontSize: 11, color: "rgba(240,232,255,.4)", margin: "-6px 0 12px" }}>
        Activo: se conectó en los últimos {DIAS_ACTIVO} días.
      </div>

      <div style={{ ...card, overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "18%" }}/><col/><col style={{ width: 130 }}/><col style={{ width: 140 }}/>
            <col style={{ width: 120 }}/><col style={{ width: 130 }}/><col style={{ width: 56 }}/>
          </colgroup>
          <thead>
            <tr>
              <th scope="col" style={th}>Nombre / Alias</th>
              <th scope="col" style={th}>Mail</th>
              <th scope="col" style={th}>Team</th>
              <th scope="col" style={th}>Teléfono</th>
              <th scope="col" style={th}>Mail verificado</th>
              <th scope="col" style={th}>Última conexión</th>
              <th scope="col" style={{ ...th, textAlign: "center" }}><span style={soloLector}>Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {clientes === null && [0, 1, 2].map((i) => (
              <tr key={i} aria-hidden="true"><td colSpan={7} style={td}>
                <div style={{ height: 12, borderRadius: 6, background: "rgba(240,232,255,.06)", width: ["75%", "55%", "65%"][i] }}/>
              </td></tr>
            ))}
            {clientes !== null && error && (
              <tr><td colSpan={7} style={{ ...td, height: 72, whiteSpace: "normal", textAlign: "center" }}>
                <span role="alert" style={{ color: "#FCA5A5" }}>{error}</span>{" "}
                <button type="button" className="btn btn-g" style={{ padding: "5px 10px", fontSize: 10, marginLeft: 8 }} onClick={recargar}>Reintentar</button>
              </td></tr>
            )}
            {listo && filtrados.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, height: 72, textAlign: "center", color: "rgba(240,232,255,.45)" }}>
                {clientes.length === 0 ? "Todavía no hay clientes registrados." : "Ningún cliente coincide."}
              </td></tr>
            )}
            {listo && filtrados.map((c) => (
              <tr key={c.id}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(240,232,255,.03)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <td style={td} title={c.nombre || ""}>{c.nombre || <span style={tenue}>Sin nombre</span>}</td>
                <td style={td} title={c.email || ""}>
                  {c.email ? <a href={`mailto:${c.email}`} style={{ color: "inherit", textDecoration: "none" }}>{c.email}</a>
                    : <span style={tenue}>Sin mail</span>}
                </td>
                <td style={td}><CeldaTeam team={c.team}/></td>
                <td style={td} title={c.telefono || ""}>
                  {c.telefono ? <a href={`tel:${c.telefono}`} style={{ color: "inherit", textDecoration: "none" }}>{c.telefono}</a>
                    : <span style={tenue}>Sin teléfono</span>}
                </td>
                <td style={td}><CeldaVerificado verificado={c.emailVerificado}/></td>
                <td style={td}><CeldaConexion fecha={c.ultimaConexion}/></td>
                <td style={{ ...td, textAlign: "center", overflow: "visible" }}>
                  <BotonAcciones nombre={c.nombre || c.email || c.id} abierto={menu?.usuario.id === c.id}
                    onClick={(e) => alternar(c, e.currentTarget)}/>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {listo && clientes.length > 0 && (busqueda.trim() || vista) && (
        <div style={{ fontSize: 11, color: "rgba(240,232,255,.4)", marginTop: 8 }}>
          {filtrados.length} de {clientes.length} clientes
        </div>
      )}

      {menu && <MenuFila ancla={menu.ancla} acciones={ACCIONES} onElegir={elegir} onCerrar={cerrarMenu}/>}
      {modal?.tipo === "eliminar" && <ModalEliminarUsuario usuario={modal.usuario} onCerrar={cerrarModal} onEliminado={cargar}/>}
      {modal?.tipo === "nuevo"    && <ModalNuevoUsuario tipo="cliente" onCerrar={cerrarModal} onCreado={cargar}/>}
    </div>
  );
}
