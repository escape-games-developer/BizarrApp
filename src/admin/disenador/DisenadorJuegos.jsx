import SolapasJuegos from "./SolapasJuegos";
import VistasJuego from "./VistasJuego";
import EditorLienzo from "../../lienzo/editor/EditorLienzo";
import { LIENZOS_JUEGOS } from "../../lienzo/juegos";

/**
 * Diseñador → Juegos: Rey del Orto, Sumate que sumamos, Arma la palabra y
 * Desafío Demente, cada uno en sus cuatro vistas.
 *
 * Todas las vistas se editan en el editor libre de pantallas (src/lienzo):
 * textos, imágenes, fondo, QR y logo como elementos ocultables, y los datos
 * del juego (◆) en vivo. Las reglas y bibliotecas siguen en el panel de cada
 * juego.
 */
const JUEGOS = [
  { id: "rey",     icon: "🎰", label: "Rey del Orto",       col: "#FFD600" },
  { id: "suma",    icon: "🔢", label: "Sumate que sumamos", col: "#FF9500" },
  { id: "palabra", icon: "🔤", label: "Arma la palabra",    col: "#A855F7" },
  { id: "trivia",  icon: "🧠", label: "Desafío Demente",    col: "#9B2FFF" },
];

/** Cada vista edita sus estados en el lienzo: las de TV a 1920 × 1080, el celular a 390 × 640. */
const editorDe = (juego) => function editorDeVista(vista) {
  const def = LIENZOS_JUEGOS[juego];
  if (!def) return null;
  if (vista === "celular") return (
    <EditorLienzo key="celular" juego={juego} formato="celular" pantallas={def.cel}
      porDefecto={def.porDefecto} datos={def.ejemplo}/>
  );
  const pantallas = def.tv.filter((p) => p.vista === vista);
  if (!pantallas.length) return null;
  return <EditorLienzo key={vista} juego={juego} pantallas={pantallas} porDefecto={def.porDefecto} datos={def.ejemplo}/>;
};

export default function DisenadorJuegos() {
  return (
    <SolapasJuegos juegos={JUEGOS} seccion="juegos">
      {(id, nav) => <VistasJuego juego={id} col={JUEGOS.find((j) => j.id === id).col} nav={nav} editor={editorDe(id)}/>}
    </SolapasJuegos>
  );
}
