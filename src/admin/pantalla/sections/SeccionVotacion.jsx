import { useEffect, useState } from "react";
import { saveEventFields } from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";
import { useGuardado } from "../panelControls";

const MODOS = [
  { value: "best", titulo: "Votación Best", texto: "1 👍 + 1 👎 + Super Vote + Super Hate" },
  { value: "rank", titulo: "Votación Rank", texto: "Votá 👍 o 👎 en cada canción" },
];

export default function SeccionVotacion({ event, refresh }) {
  const [modo, setModo] = useState(event.voting_mode || "best");
  const { estado, guardar } = useGuardado(async (valor) => {
    await saveEventFields(event.id, { voting_mode: valor });
    await refresh();
  });

  useEffect(() => { setModo(event.voting_mode || "best"); }, [event.voting_mode]);

  const elegir = async (valor) => {
    if (valor === modo || estado === "guardando") return;
    setModo(valor);
    const ok = await guardar(valor);
    if (!ok) setModo(event.voting_mode || "best");
  };

  return (
    <section className="pdj-overview-card" style={{ padding: 20 }}>
      <div className="pdj-overview-label" style={{ textAlign: "left", marginBottom: 12 }}>
        MODO DE VOTACIÓN
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {MODOS.map((m) => {
          const activo = modo === m.value;
          return (
            <button key={m.value} type="button" disabled={estado === "guardando"}
              onClick={() => elegir(m.value)} style={{
                textAlign: "left", width: "100%", padding: "10px 12px", borderRadius: 16,
                cursor: "pointer", color: P.texto,
                background: activo ? "rgba(255,122,0,.12)" : "rgba(0,0,0,.18)",
                border: `1px solid ${activo ? "#ff7a00" : "rgba(240,232,255,.16)"}`,
              }}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{m.titulo}</div>
              <div style={{ fontSize: 10.5, color: P.tenue2, marginTop: 2 }}>{m.texto}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
