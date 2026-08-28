import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";

/**
 * Estadísticas en vivo.
 *
 * Todo sale de lo que el panel ya tiene en memoria (`pantalla_votes` y
 * `pantalla_participants`): no se abre ninguna consulta extra salvo el nombre
 * del más activo, que vive en `profiles`.
 *
 * Dos métricas quedan en «—» a propósito: **mayor subida** y **mayor caída**
 * necesitan comparar el ranking contra sí mismo unos minutos atrás, y no hay
 * ninguna tabla que guarde esa serie de tiempo. No se inventa nada para
 * llenarlas.
 */
export default function SeccionEstadisticas({ stats }) {
  const [nombreActivo, setNombreActivo] = useState(null);

  useEffect(() => {
    if (!stats.masActivoId) { setNombreActivo(null); return; }
    let cancelado = false;
    supabase.from("profiles").select("name").eq("id", stats.masActivoId).maybeSingle()
      .then(({ data }) => { if (!cancelado) setNombreActivo(data?.name || null); });
    return () => { cancelado = true; };
  }, [stats.masActivoId]);

  const METRICAS = [
    { v: stats.activos,    l: "Invitados",     c: P.amarillo },
    { v: stats.positivos,  l: "👍 A favor",    c: P.verde },
    { v: stats.negativos,  l: "👎 En contra",  c: P.fucsia },
    { v: stats.supers,     l: "🔥 Súper",      c: P.naranja },
    { v: stats.superOdios, l: "💀 Súper odio", c: P.violeta },
    { v: stats.participantes, l: "Total",      c: P.cyan },
  ];

  const DESTACADOS = [
    {
      ico: "⚡", label: "Más activo",
      valor: stats.masActivoVotos > 0
        ? `${nombreActivo || "Alguien"} · ${stats.masActivoVotos} votos`
        : null,
    },
    { ico: "🏆", label: "Más popular", valor: stats.masVotada?.title || null },
    { ico: "💀", label: "Más rechazada", valor: stats.masRechazada?.title || null },
    { ico: "📈", label: "Mayor subida", valor: null, sinDato: true },
    { ico: "📉", label: "Mayor caída",  valor: null, sinDato: true },
  ];

  return (
    <PanelSection id="estadisticas-vivo" title="Estadísticas en vivo" icon="📊" defaultOpen>
      <div className="pdj-metricas" style={{ marginBottom: 11 }}>
        {METRICAS.map((m) => (
          <div key={m.l} className="pdj-metrica" style={{ background: `${m.c}12`, borderColor: `${m.c}30` }}>
            <div className="pdj-metrica-v" style={{ color: m.c }}>{m.v}</div>
            <div className="pdj-metrica-l">{m.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {DESTACADOS.map((d) => (
          <div key={d.label} style={{
            display: "flex", alignItems: "baseline", gap: 6, fontSize: 10.5, color: P.tenue,
          }}>
            <span style={{ flexShrink: 0 }}>{d.ico}</span>
            <span style={{ flexShrink: 0 }}>{d.label}:</span>
            <strong style={{
              color: d.valor ? P.texto : P.tenue2, minWidth: 0,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
              title={d.sinDato
                ? "Necesita comparar el ranking contra un momento anterior; no hay serie de tiempo guardada."
                : undefined}>
              {d.valor || "—"}
            </strong>
          </div>
        ))}
      </div>

      <div className="pdj-campo-hint">
        Subida y caída quedan en «—»: harían falta fotos del ranking a lo largo de la noche, y
        hoy no se guarda ninguna.
      </div>
    </PanelSection>
  );
}
