import { ESCENARIO_JUEGOS } from "../../constants/escenarioJuegos";
import SolapasJuegos from "./SolapasJuegos";
import DisenoEscenario from "./escenario/DisenoEscenario";
import DisenoDuelo from "./duelo/DisenoDuelo";

/**
 * Diseñador → Escenario: cómo se ven en la TV (y en el celular) el Duelo de
 * Talentos, Follow the Leader y Personal Trainer.
 *
 * Sólo lo VISUAL. Las reglas (votación, cronómetro, tope de toques…) cambian
 * cómo funciona el juego y se tocan durante la noche: viven en el panel de
 * cada juego, al lado de la operación.
 */
const JUEGOS = [
  { id: "duelo", icon: "⚔️", label: "Duelo de Talentos", col: "#FF2D78" },
  ...["ftl", "pt"].map((id) => ({
    id, icon: ESCENARIO_JUEGOS[id].icon, label: ESCENARIO_JUEGOS[id].label, col: ESCENARIO_JUEGOS[id].colorAdmin,
  })),
];

export default function DisenadorEscenario() {
  return (
    <SolapasJuegos juegos={JUEGOS} seccion="escenario">
      {(id, nav) => (id === "duelo" ? <DisenoDuelo nav={nav}/> : <DisenoEscenario tipo={id} nav={nav}/>)}
    </SolapasJuegos>
  );
}
