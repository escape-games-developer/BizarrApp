import { useState } from "react";
import General from "./ajustes/General";
import VistaPanelOpciones from "./ajustes/VistaPanelOpciones";
import RegistroClientes from "./ajustes/RegistroClientes";
import CartaMenu from "./ajustes/CartaMenu";
import VotacionEscenario from "./ajustes/VotacionEscenario";
import QrPantalla from "./ajustes/QrPantalla";

const card = {
  background: "rgba(240,232,255,.035)",
  border: "1px solid rgba(240,232,255,.1)",
  borderRadius: 18,
  padding: 22,
};

/**
 * Ajustes — centro de configuración administrativa de BizarrApp.
 *
 * Cada categoría es una entrada de CATEGORIAS con su propio componente y se
 * muestra como una solapa, al estilo de las hojas de Excel: la fila de
 * solapas va pegada a la hoja y la activa se funde con ella. Todas reciben
 * las mismas props que AjustesPanel (`contexto`).
 *
 * Futuras: Juegos, Reglas y comportamientos, Pantalla, Otras. Las
 * reglas de cada juego siguen viviendo en su panel (p. ej. Arma la Palabra y
 * `participantes_minimos`) hasta que se diseñe el sistema general de reglas;
 * esta pantalla no las duplica ni las lee.
 */
const CATEGORIAS = [
  {
    id: "general", icon: "⚙️", label: "General",
    descripcion: "Reglas de acceso de los clientes: ubicación obligatoria y entrada como invitado.",
    Componente: General,
  },
  {
    id: "vistaPanel", icon: "🧭", label: "Vista del panel de opciones",
    descripcion: "Configurá qué opciones aparecen en el panel de administración y en qué orden.",
    Componente: VistaPanelOpciones,
  },
  {
    id: "registro", icon: "📝", label: "Registro de clientes",
    descripcion: "Activá o desactivá las formas en que los clientes pueden crear su cuenta.",
    Componente: RegistroClientes,
  },
  {
    id: "votacion", icon: "🗳️", label: "Votación Escenario",
    descripcion: "Elegí cómo vota el público en Follow the Leader y Personal Trainer: barómetro de toques o 👍/👎.",
    Componente: VotacionEscenario,
  },
  {
    id: "qr", icon: "🔳", label: "QR y logo",
    descripcion: "Mostrá u ocultá el QR y el logo de BizarrApp en las pantallas de cada juego.",
    Componente: QrPantalla,
  },
  {
    id: "carta", icon: "🍹", label: "Carta (menú)",
    descripcion: "Elegí qué carta ven los clientes en MENÚ: la actual o la de Pedidos Bizarren.",
    Componente: CartaMenu,
  },
];

// Hoja y solapa activa comparten fondo y borde: así la solapa "sale" de la hoja.
const HOJA_BG     = "#140C22";
const HOJA_BORDE  = "rgba(155,47,255,.35)";

const SOLAPAS_CSS = `
  .ajs-solapas{display:flex;align-items:flex-end;gap:2px;overflow-x:auto;
    padding:0 12px;margin-bottom:-1px;position:relative;z-index:1;scrollbar-width:thin;}
  .ajs-solapa{flex:0 0 auto;display:flex;align-items:center;gap:7px;
    padding:8px 16px 9px;font:inherit;font-size:12px;font-weight:600;white-space:nowrap;
    color:rgba(240,232,255,.5);background:rgba(240,232,255,.04);cursor:pointer;
    border:1px solid rgba(240,232,255,.1);border-bottom-color:${HOJA_BORDE};
    border-radius:9px 9px 0 0;transition:background .15s,color .15s;}
  .ajs-solapa:hover{color:rgba(240,232,255,.85);background:rgba(240,232,255,.08);}
  .ajs-solapa[aria-selected="true"]{color:#F0E8FF;background:${HOJA_BG};
    border-color:${HOJA_BORDE};border-bottom-color:${HOJA_BG};
    box-shadow:inset 0 2px 0 #9B2FFF;padding-top:10px;cursor:default;}
  .ajs-hoja{background:${HOJA_BG};border:1px solid ${HOJA_BORDE};
    border-radius:0 14px 14px 14px;padding:22px;}
  @media (max-width:560px){ .ajs-solapa{padding:8px 11px 9px;font-size:11px;} .ajs-hoja{padding:16px;} }
`;

export default function AjustesPanel(contexto) {
  const [activa, setActiva] = useState(CATEGORIAS[0].id);
  const cat = CATEGORIAS.find((c) => c.id === activa) || CATEGORIAS[0];
  const { Componente } = cat;

  return (
    <div style={{ maxWidth: 920 }}>
      <style>{SOLAPAS_CSS}</style>

      <div style={{ ...card, borderColor: "rgba(155,47,255,.35)", background: "rgba(155,47,255,.06)", marginBottom: 16 }}>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          Ajustes
        </div>
        <p style={{ color: "rgba(240,232,255,.58)", fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
          Configurá las reglas, comportamientos y opciones generales de BizarrApp.
        </p>
      </div>

      <div className="ajs-solapas" role="tablist" aria-label="Categorías de ajustes">
        {CATEGORIAS.map((c) => (
          <button key={c.id} type="button" role="tab" id={`ajs-tab-${c.id}`}
            aria-selected={c.id === cat.id} aria-controls="ajs-hoja"
            className="ajs-solapa" onClick={() => setActiva(c.id)}>
            <span>{c.icon}</span>{c.label}
          </button>
        ))}
      </div>

      <div className="ajs-hoja" role="tabpanel" id="ajs-hoja" aria-labelledby={`ajs-tab-${cat.id}`}>
        <p style={{ color: "rgba(240,232,255,.55)", fontSize: 12.5, lineHeight: 1.6, margin: "0 0 18px" }}>
          {cat.descripcion}
        </p>
        <Componente key={cat.id} {...contexto}/>
      </div>
    </div>
  );
}
