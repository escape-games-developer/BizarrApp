import { useState } from "react";
import { MENUS, useMenuConfigAdmin } from "../../hooks/useMenuConfig";
import { Interruptor } from "./RegistroClientes";

/**
 * Ajustes → Carta (menú). Siempre hay exactamente una carta activa: prender
 * una apaga la otra. La activa no se apaga desde su interruptor (no hay
 * "ninguna"): se cambia prendiendo la otra.
 */

const DETALLES = {
  wordpress: "La carta publicada en el sitio de Bizarren (WordPress).",
  pedidos: "La app de pedidos hecha en Lovable.",
};

export default function CartaMenu({ puedeEditar }) {
  const { fuente, error, guardar, recargar } = useMenuConfigAdmin();
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);   // { tono, texto }

  const activar = async (id) => {
    if (id === fuente) return;
    setGuardando(true); setAviso(null);
    try {
      await guardar(id);
      setAviso({ tono: "ok", texto: `Ahora los clientes ven «${MENUS[id].titulo}» la próxima vez que abran MENÚ.` });
    } catch (e) {
      setAviso({ tono: "error", texto: e.message });
    } finally {
      setGuardando(false);
    }
  };

  if (error) return (
    <div role="alert" style={{ fontSize: 12.5, color: "#FCA5A5" }}>
      {error}{" "}
      <button type="button" className="btn btn-g" style={{ padding: "5px 10px", fontSize: 10, marginLeft: 8 }} onClick={recargar}>Reintentar</button>
    </div>
  );
  if (!fuente) return <div style={{ fontSize: 12, color: "rgba(240,232,255,.45)" }}>Cargando…</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {Object.entries(MENUS).map(([id, m]) => {
        const activa = fuente === id;
        return (
          <div key={id} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", borderRadius: 14,
            background: activa ? "rgba(155,47,255,.08)" : "rgba(240,232,255,.03)",
            border: `1px solid ${activa ? "rgba(155,47,255,.4)" : "rgba(240,232,255,.1)"}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14 }}>{m.titulo}</strong>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: .6, textTransform: "uppercase",
                  color: activa ? "#00F5A0" : "rgba(240,232,255,.4)" }}>
                  {activa ? "Activa" : "Inactiva"}
                </span>
              </div>
              <p style={{ margin: "6px 0 4px", fontSize: 12, lineHeight: 1.6, color: "rgba(240,232,255,.55)" }}>{DETALLES[id]}</p>
              <a href={m.url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11.5, color: "#00E5FF", wordBreak: "break-all" }}>{m.url}</a>
            </div>
            <Interruptor encendido={activa} etiqueta={m.titulo}
              deshabilitado={!puedeEditar || guardando}
              onCambiar={() => activar(id)}/>
          </div>
        );
      })}
      <div style={{ fontSize: 11.5, color: "rgba(240,232,255,.5)", lineHeight: 1.5 }}>
        Sólo puede haber una carta activa: al activar una, la otra se desactiva.
      </div>
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
