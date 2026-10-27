import { useState } from "react";
import { usePermisosAnfitrionAdmin, PERMISOS_ANFITRION } from "../../hooks/usePermisosAnfitrion";
import { Interruptor } from "./RegistroClientes";

/**
 * Ajustes → Permisos del anfitrión. Qué puede hacer el perfil Anfitrión en la
 * tablet además de ver y lanzar. Cada permiso se guarda al instante; el panel
 * del anfitrión lo toma en ≤ 20 s (ver hooks/usePermisosAnfitrion.js).
 */
export default function PermisosAnfitrion({ puedeEditar }) {
  const { config, error, guardar, recargar } = usePermisosAnfitrionAdmin();
  const [guardando, setGuardando] = useState(null);
  const [aviso, setAviso] = useState(null);

  const cambiar = async (id, valor) => {
    setGuardando(id); setAviso(null);
    try {
      await guardar({ ...config, [id]: valor });
      setAviso({ tono: "ok", texto: "Guardado. La tablet del anfitrión lo toma en unos segundos." });
    } catch (e) {
      setAviso({ tono: "error", texto: e.message });
    } finally {
      setGuardando(null);
    }
  };

  if (error) return (
    <div role="alert" style={{ fontSize: 12.5, color: "#FCA5A5" }}>
      {error}{" "}
      <button type="button" className="btn btn-g" style={{ padding: "5px 10px", fontSize: 10, marginLeft: 8 }} onClick={recargar}>Reintentar</button>
    </div>
  );
  if (!config) return <div style={{ fontSize: 12, color: "rgba(240,232,255,.45)" }}>Cargando…</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {PERMISOS_ANFITRION.map((o) => (
        <div key={o.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", borderRadius: 14,
          background: config[o.id] ? "rgba(155,47,255,.08)" : "rgba(240,232,255,.03)",
          border: `1px solid ${config[o.id] ? "rgba(155,47,255,.4)" : "rgba(240,232,255,.1)"}` }}>
          <div style={{ fontSize: 22, lineHeight: 1 }} aria-hidden="true">{o.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: .6, textTransform: "uppercase",
              color: "rgba(240,232,255,.4)", marginBottom: 3 }}>{o.juego}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 14 }}>{o.titulo}</strong>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: .6, textTransform: "uppercase",
                color: config[o.id] ? "#00F5A0" : "rgba(240,232,255,.4)" }}>
                {guardando === o.id ? "Guardando…" : config[o.id] ? "Permitido" : "No permitido"}
              </span>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.6, color: "rgba(240,232,255,.55)" }}>
              {config[o.id] ? o.activo : o.inactivo}
            </p>
          </div>
          <Interruptor encendido={config[o.id]} etiqueta={o.titulo}
            deshabilitado={!puedeEditar || guardando !== null}
            onCambiar={(v) => cambiar(o.id, v)}/>
        </div>
      ))}

      {!puedeEditar && (
        <div style={{ fontSize: 11.5, color: "rgba(240,232,255,.45)" }}>Tu usuario no puede cambiar esta configuración.</div>
      )}
      {aviso && (
        <div role={aviso.tono === "error" ? "alert" : "status"}
          style={{ fontSize: 11.5, color: aviso.tono === "error" ? "#FCA5A5" : "#00F5A0" }}>
          {aviso.texto}
        </div>
      )}
    </div>
  );
}
