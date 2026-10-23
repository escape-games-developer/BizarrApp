import FtlStandbyVista from "./FtlStandbyVista";
import { usePantallaLogo, usePantallaQr } from "../hooks/usePantallaQr";
import { useEscenarioListo, ESCENARIO_LISTO_POR_DEFECTO } from "../hooks/useEscenarioListo";

/**
 * Convocatoria / participante listo de FTL y PT en la TV: lee su
 * configuración y la dibuja con FtlStandbyVista (la misma que usa la vista
 * previa del Diseño de juegos).
 */
export default function FtlStandby({ juego, webappUrl, participante = null }) {
  // Diseño de juegos → QR y logo (por juego: 'ftl' | 'pt').
  const mostrarQr   = usePantallaQr()[juego.type] !== false;
  const mostrarLogo = usePantallaLogo()[juego.type] !== false;
  // Respaldo por juego: si la config no llega, cada uno con su propio cartel.
  const listo = useEscenarioListo()[juego.type]
    || ESCENARIO_LISTO_POR_DEFECTO[juego.type] || ESCENARIO_LISTO_POR_DEFECTO.ftl;

  return (
    <FtlStandbyVista juego={juego} webappUrl={webappUrl} participante={participante}
      listo={listo} mostrarQr={mostrarQr} mostrarLogo={mostrarLogo}/>
  );
}
