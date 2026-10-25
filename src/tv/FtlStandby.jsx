import FtlStandbyVista from "./FtlStandbyVista";
import { usePantallaLogo, usePantallaQr } from "../hooks/usePantallaQr";
import { useEscenarioListo, ESCENARIO_LISTO_POR_DEFECTO } from "../hooks/useEscenarioListo";
import LienzoPantalla from "../lienzo/LienzoPantalla";
import { useLienzo } from "../lienzo/useLienzo";

/**
 * Convocatoria / participante listo de FTL y PT en la TV: lee su
 * configuración y la dibuja con FtlStandbyVista (la misma que usa la vista
 * previa del Diseño de juegos).
 *
 * Diseñador → Escenario → FTL / PT (editor libre, fila lienzo_<juego>): con la
 * pantalla guardada se dibuja ésa — el QR y el logo respetan además sus
 * interruptores, y el cartel «LISTO PARA …» sigue saliendo de su editor.
 */
export default function FtlStandby({ juego, webappUrl, participante = null }) {
  // Diseño de juegos → QR y logo (por juego: 'ftl' | 'pt').
  const mostrarQr   = usePantallaQr()[juego.type] !== false;
  const mostrarLogo = usePantallaLogo()[juego.type] !== false;
  // Respaldo por juego: si la config no llega, cada uno con su propio cartel.
  const listo = useEscenarioListo()[juego.type]
    || ESCENARIO_LISTO_POR_DEFECTO[juego.type] || ESCENARIO_LISTO_POR_DEFECTO.ftl;
  const lienzo = useLienzo(juego.type);
  const editada = lienzo[participante ? "listo" : "convocatoria"];

  if (editada) {
    const pantalla = { ...editada, elementos: editada.elementos.map((e) =>
      (e.id === "qr" && !mostrarQr) || (e.id === "logo-app" && !mostrarLogo) ? { ...e, visible: false } : e) };
    return (
      <div data-tv-ftl-lienzo style={{ position: "absolute", inset: 0, zIndex: 50, overflow: "hidden" }}>
        <LienzoPantalla pantalla={pantalla} datos={{ vivo: true, participante, listo, juego,
          qrUrl: `${webappUrl}/?view=escenario` }} llenar/>
      </div>
    );
  }

  return (
    <FtlStandbyVista juego={juego} webappUrl={webappUrl} participante={participante}
      listo={listo} mostrarQr={mostrarQr} mostrarLogo={mostrarLogo}/>
  );
}
