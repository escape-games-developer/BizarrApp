import { useState } from "react";
import QRCode from "react-qr-code";
import { saveEventFields, guestUrl } from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonCopiar, BotonGuardar, Campo, useGuardado } from "../panelControls";

/**
 * Código del evento: lo que el cliente tipea o escanea para entrar.
 *
 * Seis caracteres de un alfabeto sin I, O, 0 ni 1 — el mismo que usa
 * `pantalla__new_code()` en el servidor, para que no haya códigos que se lean
 * mal a tres metros de la barra. El código es único en toda la base: si ya
 * existe, el guardado falla y se muestra el error.
 */

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const limpiar = (v) => String(v || "").toUpperCase().split("")
  .filter((c) => ALFABETO.includes(c)).join("").slice(0, 6);

export default function SeccionCodigo({ event, refresh, refreshEvents }) {
  const [codigo, setCodigo] = useState(event.code);
  const { estado, mensaje, guardar } = useGuardado(async (valor) => {
    await saveEventFields(event.id, { code: valor });
    await refresh();
    await refreshEvents?.();
  });

  const valido = codigo.length === 6;
  const cambiado = codigo !== event.code;

  return (
    <PanelSection id="codigo-evento" title="Código del evento" icon="🔑" defaultOpen>
      <div style={{ textAlign: "center", marginBottom: 13 }}>
        <div className="pdj-codigo" style={{ fontSize: 32, marginBottom: 11 }}>{event.code}</div>
        <div className="pdj-qr" style={{ display: "inline-block" }}>
          <QRCode value={guestUrl(event.code)} size={128} />
        </div>
      </div>

      <Campo label="Link del invitado"
        hint="El QR apunta acá. Lleva directo a Pantalla › 🎧 Música con el evento ya elegido.">
        <input className="pdj-input" readOnly value={guestUrl(event.code)}
          style={{ fontSize: 10.5 }} onFocus={(e) => e.target.select()} />
      </Campo>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 13 }}>
        <BotonCopiar valor={event.code} texto="⧉ Código" />
        <BotonCopiar valor={guestUrl(event.code)} texto="⧉ Link" />
        <button type="button" className="pdj-mini"
          onClick={() => window.open(guestUrl(event.code), "_blank", "noopener")}>
          Abrir vista del invitado
        </button>
      </div>

      <Campo label="Cambiar el código"
        hint="Seis caracteres, sin I, O, 0 ni 1 — se confunden de lejos. Al cambiarlo, los links y QR ya repartidos dejan de servir.">
        <input className="pdj-input" value={codigo} maxLength={6}
          onChange={(e) => setCodigo(limpiar(e.target.value))}
          style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, letterSpacing: 4, fontSize: 15 }} />
      </Campo>

      {!valido && (
        <div className="pdj-campo-hint" style={{ color: P.amarillo, marginTop: -6 }}>
          El código tiene que tener 6 caracteres.
        </div>
      )}

      <BotonGuardar estado={estado} mensaje={mensaje}
        disabled={!valido || !cambiado} onClick={() => guardar(codigo)} />
    </PanelSection>
  );
}
