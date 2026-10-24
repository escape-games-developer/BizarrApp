import { PALABRA_POR_DEFECTO, PANTALLAS_PALABRA, PANTALLAS_PALABRA_CEL } from "../lienzoPalabra";
import { PANTALLAS_REY, PANTALLAS_REY_CEL, REY_POR_DEFECTO } from "./rey";
import { PANTALLAS_SUMA, PANTALLAS_SUMA_CEL, SUMA_POR_DEFECTO } from "./suma";
import { PANTALLAS_TRIVIA, PANTALLAS_TRIVIA_CEL, TRIVIA_POR_DEFECTO } from "./trivia";

/**
 * Juegos que se diseñan en el editor de pantallas (src/lienzo), cada uno con
 * su fila `lienzo_<id>`:
 *   tv / cel     → los estados de la TV (con su `vista` del Diseñador) y del celular
 *   porDefecto   → el diseño de fábrica de cada estado
 *   ejemplo(estado) → los datos de muestra con que el editor dibuja ese estado
 */

const QR_URL = () => `${window.location.origin}/?view=games`;

const SUMA_GANADORES = [
  { user_id: "a", name: "Vale", avatar_emoji: "💃", assigned_number: 5 },
  { user_id: "b", name: "Nico", avatar_emoji: "🎸", assigned_number: 7 },
  { user_id: "c", name: "Sol",  avatar_emoji: "🌞", assigned_number: 9 },
];

export const LIENZOS_JUEGOS = {
  palabra: {
    tv: PANTALLAS_PALABRA, cel: PANTALLAS_PALABRA_CEL, porDefecto: PALABRA_POR_DEFECTO,
    ejemplo: (estado) => (estado.startsWith("cel-") ? { miLetra: "V" } : { palabra: "BIZARRO", qrUrl: QR_URL() }),
  },
  rey: {
    tv: PANTALLAS_REY, cel: PANTALLAS_REY_CEL, porDefecto: REY_POR_DEFECTO,
    ejemplo: () => ({ qrUrl: QR_URL() }),
  },
  suma: {
    tv: PANTALLAS_SUMA, cel: PANTALLAS_SUMA_CEL, porDefecto: SUMA_POR_DEFECTO,
    ejemplo: () => ({ qrUrl: QR_URL(), objetivo: 21, ganadores: SUMA_GANADORES }),
  },
  trivia: {
    tv: PANTALLAS_TRIVIA, cel: PANTALLAS_TRIVIA_CEL, porDefecto: TRIVIA_POR_DEFECTO,
    ejemplo: (estado) => ({
      qrUrl: QR_URL(),
      revelada: estado === "respuesta" || estado === "cel-respuesta",
      miVoto: estado === "cel-votaste" ? 1 : estado === "cel-respuesta" ? 2 : null,
      ganador: estado === "cel-empate" ? null : "batata",
    }),
  },
};
