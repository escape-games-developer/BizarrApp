import SolapasJuegos from "./SolapasJuegos";
import VistasJuego from "./VistasJuego";

/**
 * Diseñador → Juegos: Rey del Orto, Sumate que sumamos, Arma la palabra y
 * Desafío Demente, cada uno en sus cuatro vistas con vista previa.
 *
 * Hoy lo único editable de sus pantallas es el QR y el logo de BizarrApp
 * (Convocatoria); el resto de las vistas muestra cómo se ven en la TV. Las
 * reglas y bibliotecas siguen en el panel de cada juego.
 */
const JUEGOS = [
  { id: "rey",     icon: "🎰", label: "Rey del Orto",       col: "#FFD600" },
  { id: "suma",    icon: "🔢", label: "Sumate que sumamos", col: "#FF9500" },
  { id: "palabra", icon: "🔤", label: "Arma la palabra",    col: "#A855F7" },
  { id: "trivia",  icon: "🧠", label: "Desafío Demente",    col: "#9B2FFF" },
];

export default function DisenadorJuegos() {
  return (
    <SolapasJuegos juegos={JUEGOS} seccion="juegos">
      {(id, nav) => <VistasJuego juego={id} col={JUEGOS.find((j) => j.id === id).col} nav={nav}/>}
    </SolapasJuegos>
  );
}
