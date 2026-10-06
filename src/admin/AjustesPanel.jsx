import { useState } from "react";
import VistaPanelOpciones from "./ajustes/VistaPanelOpciones";

const card = {
  background: "rgba(240,232,255,.035)",
  border: "1px solid rgba(240,232,255,.1)",
  borderRadius: 18,
  padding: 22,
};

/**
 * Ajustes — centro de configuración administrativa de BizarrApp.
 *
 * Cada categoría es una entrada de CATEGORIAS con su propio componente. La
 * portada las lista como tarjetas; al elegir una se abre su pantalla. Todas
 * reciben las mismas props que AjustesPanel (`contexto`).
 *
 * Futuras: General, Juegos, Reglas y comportamientos, Pantalla, Otras. Las
 * reglas de cada juego siguen viviendo en su panel (p. ej. Arma la Palabra y
 * `participantes_minimos`) hasta que se diseñe el sistema general de reglas;
 * esta pantalla no las duplica ni las lee.
 */
const CATEGORIAS = [
  {
    id: "vistaPanel", icon: "🧭", label: "Vista del panel de opciones",
    descripcion: "Configurá qué opciones aparecen en el panel de administración y en qué orden.",
    Componente: VistaPanelOpciones,
  },
];

export default function AjustesPanel(contexto) {
  const [abierta, setAbierta] = useState(null);
  const cat = CATEGORIAS.find((c) => c.id === abierta);

  if (cat) {
    const { Componente } = cat;
    return (
      <div style={{ maxWidth: 920 }}>
        <button type="button" onClick={() => setAbierta(null)}
          style={{ background: "none", border: "none", color: "rgba(240,232,255,.55)", fontSize: 12,
            cursor: "pointer", padding: "2px 0", marginBottom: 10 }}>
          ← Ajustes
        </button>
        <div style={{ ...card, borderColor: "rgba(155,47,255,.35)", background: "rgba(155,47,255,.06)", marginBottom: 14 }}>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            {cat.icon} {cat.label}
          </div>
          <p style={{ color: "rgba(240,232,255,.58)", fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>{cat.descripcion}</p>
        </div>
        <div style={card}>
          <Componente {...contexto}/>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ ...card, borderColor: "rgba(155,47,255,.35)", background: "rgba(155,47,255,.06)" }}>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          Ajustes
        </div>
        <p style={{ color: "rgba(240,232,255,.58)", fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
          Configurá las reglas, comportamientos y opciones generales de BizarrApp.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12, marginTop: 14 }}>
        {CATEGORIAS.map((c) => (
          <button key={c.id} type="button" onClick={() => setAbierta(c.id)}
            style={{ ...card, textAlign: "left", cursor: "pointer", color: "#F0E8FF", font: "inherit" }}>
            <div style={{ fontSize: 22, marginBottom: 10 }}>{c.icon}</div>
            <strong style={{ display: "block", fontSize: 14, marginBottom: 6 }}>{c.label}</strong>
            <span style={{ color: "rgba(240,232,255,.48)", fontSize: 11.5, lineHeight: 1.55 }}>{c.descripcion}</span>
          </button>
        ))}
      </div>

      <div style={{ ...card, marginTop: 14, textAlign: "center", color: "rgba(240,232,255,.42)", fontSize: 12 }}>
        Las demás configuraciones se irán incorporando en esta sección.
      </div>
    </div>
  );
}
