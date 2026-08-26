import { useState } from "react";
import QRCode from "react-qr-code";
import { guestUrl, tvUrl, getTvLink } from "../../services/pantallaDj";
import { ESTADO_EVENTO } from "../../components/pantalla/pantallaUi";
import EventNameEditor from "./EventNameEditor";

/**
 * Cabecera compacta del evento, compartida por todas las pestañas.
 *
 * Es el equivalente a la barra superior del admin de DJ Democracy: de un
 * vistazo, qué evento es, en qué estado está, y los accesos a las otras tres
 * superficies (Cliente, TV y Consola DJ).
 */
export default function EventoHeader({ event, items, activos, onIrConsola, onError }) {
  const [qrAbierto, setQrAbierto] = useState(false);
  const [copiado,   setCopiado]   = useState(null);
  const [tv,        setTv]        = useState(null);

  const est = ESTADO_EVENTO[event.status] || ESTADO_EVENTO.draft;
  const enVivo = event.status === "live";

  const copiar = (texto, clave) => {
    navigator.clipboard?.writeText(texto);
    setCopiado(clave);
    setTimeout(() => setCopiado(null), 1600);
  };

  const abrirTv = async () => {
    try {
      const link = tv || await getTvLink(event.id);
      setTv(link);
      window.open(tvUrl(event.code, link.token), "_blank", "noopener");
    } catch (err) { onError?.(err.message); }
  };

  return (
    <>
      <div className={`pdj-hdr${enVivo ? " pdj-hdr-live" : ""}`}>
        <div className="pdj-hdr-main">
          <EventNameEditor event={event} compact onError={onError} />
          <div className="pdj-hdr-meta">
            <span><b>{items.length}</b> canciones</span>
            <span>·</span>
            <span><b>{activos}</b> {activos === 1 ? "persona activa" : "personas activas"}</span>
            <span>·</span>
            <span>código <b>{event.code}</b></span>
          </div>
        </div>

        <span className={`pdj-estado${enVivo ? " pdj-estado-live" : ""}`}
          style={{ color: est.color, background: est.bg, border: `1px solid ${est.borde}` }}>
          <span className="pdj-punto" />{est.label}
        </span>

        <div className="pdj-hdr-acts">
          <button className="pdj-mini" onClick={() => copiar(event.code, "cod")}
            title="Copiar el código del evento">
            {copiado === "cod" ? "✓ Copiado" : "⧉ Código"}
          </button>
          <button className={`pdj-mini${qrAbierto ? " pdj-mini-a" : ""}`}
            onClick={() => setQrAbierto((v) => !v)} title="Mostrar el QR para los clientes">
            {qrAbierto ? "Ocultar QR" : "▦ QR"}
          </button>
          <button className="pdj-mini"
            onClick={() => window.open(guestUrl(event.code), "_blank", "noopener")}
            title="Abrir la vista del cliente en otra pestaña">
            📱 Cliente
          </button>
          <button className="pdj-mini" onClick={abrirTv} title="Abrir la pantalla de TV">
            📺 TV
          </button>
          {onIrConsola && (
            <button className="pdj-mini pdj-mini-p" onClick={onIrConsola}>
              🎧 Consola DJ
            </button>
          )}
        </div>
      </div>

      {qrAbierto && (
        <div className="pdj-card" style={{ textAlign: "center" }}>
          <div className="pdj-qr"><QRCode value={guestUrl(event.code)} size={168} /></div>
          <div className="pdj-codigo" style={{ fontSize: 30, marginTop: 12 }}>{event.code}</div>
          <div className="pdj-sub" style={{ marginTop: 8, marginBottom: 0 }}>
            Escaneándolo, el cliente entra directo a <strong>Pantalla › 🎧 Música</strong>.
          </div>
        </div>
      )}
    </>
  );
}
