import SolapasJuegos from "./SolapasJuegos";
import VistasJuego from "./VistasJuego";
import EditorLienzo from "../../lienzo/editor/EditorLienzo";
import { PALABRA_POR_DEFECTO, PANTALLAS_PALABRA, PANTALLAS_PALABRA_CEL } from "../../lienzo/lienzoPalabra";

/**
 * Diseñador → Juegos: Rey del Orto, Sumate que sumamos, Arma la palabra y
 * Desafío Demente, cada uno en sus cuatro vistas con vista previa.
 *
 * QR y logo de BizarrApp (Convocatoria) en todos. Arma la palabra es el piloto
 * del editor libre de pantallas: todas sus vistas de TV se editan en el lienzo
 * (textos, imágenes, fondo, QR y logo como elementos ocultables). Las reglas y bibliotecas siguen en el panel de
 * cada juego.
 */
const JUEGOS = [
  { id: "rey",     icon: "🎰", label: "Rey del Orto",       col: "#FFD600" },
  { id: "suma",    icon: "🔢", label: "Sumate que sumamos", col: "#FF9500" },
  { id: "palabra", icon: "🔤", label: "Arma la palabra",    col: "#A855F7" },
  { id: "trivia",  icon: "🧠", label: "Desafío Demente",    col: "#9B2FFF" },
];

// Datos de ejemplo mientras se edita (las tarjetas de ganadores traen los suyos).
const DATOS_EJEMPLO = { palabra: "BIZARRO", qrUrl: `${window.location.origin}/?view=games` };
/** Cada vista edita sus estados en el lienzo: las de TV a 1920 × 1080, el celular a 390 × 640. */
const DATOS_CEL = { miLetra: "V" };
const editorPalabra = (vista) => {
  if (vista === "celular") return (
    <EditorLienzo key="celular" juego="palabra" formato="celular" pantallas={PANTALLAS_PALABRA_CEL}
      porDefecto={PALABRA_POR_DEFECTO} datos={DATOS_CEL}/>
  );
  const pantallas = PANTALLAS_PALABRA.filter((p) => p.vista === vista);
  if (!pantallas.length) return null;
  return <EditorLienzo key={vista} juego="palabra" pantallas={pantallas} porDefecto={PALABRA_POR_DEFECTO} datos={DATOS_EJEMPLO}/>;
};

export default function DisenadorJuegos() {
  return (
    <SolapasJuegos juegos={JUEGOS} seccion="juegos">
      {(id, nav) => <VistasJuego juego={id} col={JUEGOS.find((j) => j.id === id).col} nav={nav}
        editor={id === "palabra" ? editorPalabra : undefined}/>}
    </SolapasJuegos>
  );
}
