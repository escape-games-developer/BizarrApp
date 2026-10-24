import QrEsquina from "./QrEsquina";
import { QR_DE_JUEGO, usePantallaQr } from "../hooks/usePantallaQr";
import { useLienzoActivo } from "../lienzo/lienzoActivo";

/**
 * QR de un juego de la sección Juegos (Rey, Desafío, Sumate, Arma) mientras
 * está en pantalla. Respeta Diseñador → QR y logo del juego y lleva a ?view=games.
 * `activeGame` = game_state.active_game.
 *
 * Si el juego está mostrando una pantalla del editor (src/lienzo), el QR es un
 * elemento de esa pantalla (se puede mover u ocultar) y éste no se dibuja.
 *
 * Vive aparte de QrEsquina para que QrEsquina no arrastre Supabase: la vista
 * previa del Diseño de juegos la usa sin sesión (ver src/main.jsx).
 */
export function QrDeJuego({ activeGame, webappUrl = window.location.origin }) {
  const config = usePantallaQr();
  const id = QR_DE_JUEGO[activeGame];
  const lienzoPropio = useLienzoActivo(id);
  if (!id || config[id] === false || lienzoPropio) return null;
  return <QrEsquina url={`${webappUrl}/?view=games`}/>;
}
