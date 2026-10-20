import { useState } from "react";
import { MODOS_VOTACION, useVotacionEscenarioAdmin } from "../../hooks/useVotacionEscenario";
import { ESCENARIO_JUEGOS } from "../../constants/escenarioJuegos";
import { Interruptor } from "./RegistroClientes";

const JUEGOS = Object.values(ESCENARIO_JUEGOS).map((j) => ({ id: j.type, nombre: j.label, icono: j.icon }));

/**
 * Ajustes → Votación de Escenario. Por juego (Follow the Leader, Personal
 * Trainer) hay dos modos con su interruptor: como mucho uno activo. Prender
 * uno apaga el otro; apagar el activo deja el juego sin votación.
 */
export default function VotacionEscenario({ puedeEditar }) {
  const { config, error, guardar, recargar } = useVotacionEscenarioAdmin();
  const [guardando, setGuardando] = useState(null);   // `${juego}:${modo}`
  const [aviso, setAviso] = useState(null);           // { tono, texto }

  const cambiar = async (juego, modo, encender) => {
    setGuardando(`${juego}:${modo}`); setAviso(null);
    try {
      await guardar({ ...config, [juego]: encender ? modo : "off" });
      setAviso({ tono: "ok", texto: "Guardado. Se aplica en la próxima performance (o en unos segundos si hay una en curso)." });
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
    <div style={{ display: "grid", gap: 20 }}>
      {JUEGOS.map((j) => (
        <section key={j.id}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>{j.icono}</span>
            <strong style={{ fontSize: 14 }}>{j.nombre}</strong>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: .6, textTransform: "uppercase",
              color: config[j.id] === "off" ? "rgba(240,232,255,.4)" : "#00F5A0" }}>
              {config[j.id] === "off" ? "Sin votación" : MODOS_VOTACION[config[j.id]].titulo.split(" · ")[0]}
            </span>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {Object.entries(MODOS_VOTACION).map(([modo, m]) => {
              const activo = config[j.id] === modo;
              return (
                <div key={modo} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", borderRadius: 14,
                  background: activo ? "rgba(155,47,255,.08)" : "rgba(240,232,255,.03)",
                  border: `1px solid ${activo ? "rgba(155,47,255,.4)" : "rgba(240,232,255,.1)"}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 13 }}>{m.titulo}</strong>
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: .6, textTransform: "uppercase",
                        color: activo ? "#00F5A0" : "rgba(240,232,255,.4)" }}>
                        {activo ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.6, color: "rgba(240,232,255,.55)" }}>{m.detalle}</p>
                  </div>
                  <Interruptor encendido={activo} etiqueta={`${j.nombre}: ${m.titulo}`}
                    deshabilitado={!puedeEditar || !!guardando}
                    onCambiar={(v) => cambiar(j.id, modo, v)}/>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <div style={{ fontSize: 11.5, color: "rgba(240,232,255,.5)", lineHeight: 1.5 }}>
        Cada juego usa un solo modo: al activar uno, el otro se desactiva. Si apagás el activo, el juego queda sin votación.
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
