import { useState, useEffect } from "react";
import { saveEventFields } from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";
import { useGuardado } from "../panelControls";

const MODOS = [
  { value: "audio", ico: "♫", titulo: "Música (MP3)", texto: "Subí archivos de audio desde tu compu." },
  { value: "video", ico: "▣", titulo: "Videos (YouTube)", texto: "Pegá links de YouTube. La reproducción llega pronto." },
];

export default function SeccionContenido({ event, refresh }) {
  const [modo, setModo] = useState(event.content_mode || "video");
  const { estado, guardar } = useGuardado(async (valor) => {
    await saveEventFields(event.id, { content_mode: valor });
    await refresh();
  });

  useEffect(() => { setModo(event.content_mode || "video"); }, [event.content_mode]);

  const elegir = async (valor) => {
    if (valor === modo || estado === "guardando") return;
    setModo(valor);
    const ok = await guardar(valor);
    if (!ok) setModo(event.content_mode || "video");
  };

  return (
    <section className="pdj-overview-card" style={{ padding: 20 }}>
      <div className="pdj-overview-label" style={{ textAlign: "left", marginBottom: 12 }}>
        MODO DE CONTENIDO
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
              <div style={{ fontSize: 12, fontWeight: 800 }}>
                <span style={{ marginRight: 7 }}>{m.ico}</span>{m.titulo}
              </div>
              <div style={{ fontSize: 10.5, color: P.tenue2, marginTop: 2 }}>{m.texto}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
