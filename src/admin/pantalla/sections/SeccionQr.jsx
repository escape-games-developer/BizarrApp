import QRCode from "react-qr-code";
import { guestUrl } from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonCopiar } from "../panelControls";

/**
 * QR para unirse, tamaño cabina.
 *
 * Es lo que se muestra en la barra o se proyecta un rato al arrancar la noche,
 * así que el código va grande: tiene que leerse de lejos y dictarse fácil.
 */
export default function SeccionQr({ event }) {
  return (
    <PanelSection id="qr-unirse" title="QR para unirse" icon="📱" defaultOpen>
      <div style={{ textAlign: "center" }}>
        <div className="pdj-qr" style={{ display: "inline-block" }}>
          <QRCode value={guestUrl(event.code)} size={150} />
        </div>
        <div className="pdj-codigo" style={{ fontSize: 28, marginTop: 12 }}>{event.code}</div>
        <div style={{ fontSize: 10, color: P.tenue2, marginTop: 5 }}>
          Entra directo a Pantalla › 🎧 Música
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 12 }}>
        <BotonCopiar valor={event.code} texto="⧉ Código" />
        <BotonCopiar valor={guestUrl(event.code)} texto="⧉ Link" />
        <button type="button" className="pdj-mini"
          onClick={() => window.open(guestUrl(event.code), "_blank", "noopener")}>
          Abrir
        </button>
      </div>
    </PanelSection>
  );
}
