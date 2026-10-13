import { useState } from "react";
import { useRegistroConfigAdmin } from "../../hooks/useRegistroConfig";

/**
 * Ajustes → Registro de clientes. Cada modalidad se activa o desactiva con su
 * interruptor y se guarda al instante (ver hooks/useRegistroConfig.js).
 */

const MODALIDADES = [
  {
    id: "completo", icon: "📝", titulo: "Registro completo",
    detalle: "El cliente completa todo el formulario (nombre, avatar, team, mail, teléfono y contraseña) y al final le llega el mail para confirmar la cuenta.",
  },
  {
    id: "mailPrimero", icon: "📨", titulo: "Registro con mail primero",
    detalle: "El cliente pone sólo su mail y le llega el link de validación. Al tocarlo pasa directo al formulario de registro, con el mail ya cargado y bloqueado; elige la contraseña al final.",
  },
];

export function Interruptor({ encendido, deshabilitado, onCambiar, etiqueta }) {
  return (
    <button type="button" role="switch" aria-checked={encendido} aria-label={etiqueta}
      disabled={deshabilitado} onClick={() => onCambiar(!encendido)}
      style={{ flexShrink: 0, width: 46, height: 26, borderRadius: 999, border: "none", padding: 3,
        cursor: deshabilitado ? "default" : "pointer", opacity: deshabilitado ? .5 : 1,
        background: encendido ? "linear-gradient(135deg,#9B2FFF,#FF2D78)" : "rgba(240,232,255,.15)",
        transition: "background .2s" }}>
      <span style={{ display: "block", width: 20, height: 20, borderRadius: "50%", background: "#fff",
        transform: encendido ? "translateX(20px)" : "translateX(0)", transition: "transform .2s" }}/>
    </button>
  );
}

export default function RegistroClientes({ puedeEditar }) {
  const { config, error, guardar, recargar } = useRegistroConfigAdmin();
  const [guardando, setGuardando] = useState(null);   // id de la modalidad que se está guardando
  const [aviso, setAviso] = useState(null);           // { tono, texto }

  const cambiar = async (id, valor) => {
    setGuardando(id); setAviso(null);
    try {
      await guardar({ ...config, [id]: valor });
      setAviso({ tono: "ok", texto: "Guardado. Los clientes lo ven la próxima vez que abran la app." });
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

  const cerrado = !config.completo && !config.mailPrimero;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {MODALIDADES.map((m) => (
        <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", borderRadius: 14,
          background: config[m.id] ? "rgba(155,47,255,.08)" : "rgba(240,232,255,.03)",
          border: `1px solid ${config[m.id] ? "rgba(155,47,255,.4)" : "rgba(240,232,255,.1)"}` }}>
          <div style={{ fontSize: 22, lineHeight: 1 }} aria-hidden="true">{m.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 14 }}>{m.titulo}</strong>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: .6, textTransform: "uppercase",
                color: config[m.id] ? "#00F5A0" : "rgba(240,232,255,.4)" }}>
                {guardando === m.id ? "Guardando…" : config[m.id] ? "Activo" : "Inactivo"}
              </span>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.6, color: "rgba(240,232,255,.55)" }}>{m.detalle}</p>
          </div>
          <Interruptor encendido={config[m.id]} etiqueta={m.titulo}
            deshabilitado={!puedeEditar || guardando !== null}
            onCambiar={(v) => cambiar(m.id, v)}/>
        </div>
      ))}

      {config.completo && config.mailPrimero && (
        <div style={{ fontSize: 11.5, color: "rgba(240,232,255,.5)", lineHeight: 1.5 }}>
          Con las dos activas, el cliente elige cómo registrarse.
        </div>
      )}
      {cerrado && (
        <div style={{ padding: "9px 12px", borderRadius: 10, fontSize: 11.5, lineHeight: 1.5,
          background: "rgba(255,214,0,.07)", border: "1px solid rgba(255,214,0,.3)", color: "#FFD600" }}>
          Registro cerrado: con las dos modalidades inactivas, la app no ofrece crear cuentas nuevas.
          Los clientes que ya tienen cuenta pueden seguir entrando.
        </div>
      )}
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
