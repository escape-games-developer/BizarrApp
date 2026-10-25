import { useEffect, useState } from "react";
import { saveEventFields } from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";
import { useGuardado } from "../panelControls";

const MODOS = [
  { value: "best", titulo: "Votación Best", texto: "1 👍 + 1 👎 + Super Vote + Super Hate" },
  { value: "rank", titulo: "Votación Rank", texto: "Votá 👍 o 👎 en cada canción" },
];

/**
 * Cierre automático: en los últimos N segundos de cada canción la votación se
 * cierra sola (la base rechaza los votos) y la TV muestra «❄ VOTACIÓN CERRADA —
 * PREPARANDO PRÓXIMA» con la cuenta regresiva. 0 = sin cierre.
 */
function CierreVotacion({ event, refresh }) {
  const [seg, setSeg] = useState(event.vote_close_seconds ?? 15);
  useEffect(() => { setSeg(event.vote_close_seconds ?? 15); }, [event.vote_close_seconds]);
  const { estado, guardar } = useGuardado(async (valor) => {
    await saveEventFields(event.id, { vote_close_seconds: valor });
    await refresh();
  });
  const cambiado = Number(seg) !== Number(event.vote_close_seconds ?? 15);
  return (
    <div style={{ marginTop: 16 }}>
      <div className="pdj-overview-label" style={{ textAlign: "left", marginBottom: 6 }}>CIERRE DE LA VOTACIÓN</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input className="pdj-input" type="number" min={0} max={120} value={seg} aria-label="Segundos antes del final"
          onChange={(e) => setSeg(Math.max(0, Math.min(120, Math.round(Number(e.target.value) || 0))))}
          style={{ width: 80, padding: "6px 8px", fontSize: 12 }}/>
        <span style={{ fontSize: 11, color: P.tenue2 }}>segundos antes del final de cada canción</span>
        <button type="button" className="pdj-mini pdj-mini-p" disabled={!cambiado || estado === "guardando"}
          onClick={() => guardar(Number(seg))}>{estado === "guardando" ? "Guardando…" : "Guardar"}</button>
      </div>
      <div style={{ fontSize: 10.5, color: P.tenue2, marginTop: 6, lineHeight: 1.5 }}>
        En esos últimos segundos no se puede votar: se prepara la próxima y la TV muestra la cuenta regresiva.
        En 0, la votación queda abierta hasta el final.
      </div>
    </div>
  );
}

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
      <CierreVotacion event={event} refresh={refresh}/>
    </section>
  );
}
