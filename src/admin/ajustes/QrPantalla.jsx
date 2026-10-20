import { useState } from "react";
import { JUEGOS_CON_QR, usePantallaVisibilidadAdmin } from "../../hooks/usePantallaQr";
import { Interruptor } from "./RegistroClientes";

/**
 * Ajustes → QR y logo en pantalla. Por juego, dos interruptores: el QR y el
 * logo de BizarrApp. Cada uno manda en las tres pantallas del juego: su placa
 * de anuncio, su convocatoria y el juego en pantalla.
 */
export default function QrPantalla({ puedeEditar }) {
  const qr   = usePantallaVisibilidadAdmin("qr");
  const logo = usePantallaVisibilidadAdmin("logo");
  const [guardando, setGuardando] = useState(null);   // `${tipo}:${juego}`
  const [aviso, setAviso] = useState(null);

  const cambiar = async (tipo, id, valor) => {
    const h = tipo === "qr" ? qr : logo;
    setGuardando(`${tipo}:${id}`); setAviso(null);
    try {
      await h.guardar({ ...h.config, [id]: valor });
      setAviso({ tono: "ok", texto: "Guardado. La TV lo toma en unos segundos." });
    } catch (e) {
      setAviso({ tono: "error", texto: e.message });
    } finally {
      setGuardando(null);
    }
  };

  const error = qr.error || logo.error;
  if (error) return (
    <div role="alert" style={{ fontSize: 12.5, color: "#FCA5A5" }}>
      {error}{" "}
      <button type="button" className="btn btn-g" style={{ padding: "5px 10px", fontSize: 10, marginLeft: 8 }}
        onClick={() => { qr.recargar(); logo.recargar(); }}>Reintentar</button>
    </div>
  );
  if (!qr.config || !logo.config) return <div style={{ fontSize: 12, color: "rgba(240,232,255,.45)" }}>Cargando…</div>;

  const control = (tipo, j, etiqueta) => {
    const encendido = (tipo === "qr" ? qr.config : logo.config)[j.id];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase",
          color: encendido ? "#00F5A0" : "rgba(240,232,255,.4)", minWidth: 44, textAlign: "right" }}>
          {etiqueta}
        </span>
        <Interruptor encendido={encendido} etiqueta={`${etiqueta} de ${j.nombre}`}
          deshabilitado={!puedeEditar || !!guardando}
          onCambiar={(v) => cambiar(tipo, j.id, v)}/>
      </div>
    );
  };

  const fila = (j) => {
    const algo = qr.config[j.id] || logo.config[j.id];
    return (
      <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 14,
        flexWrap: "wrap",
        background: algo ? "rgba(155,47,255,.08)" : "rgba(240,232,255,.03)",
        border: `1px solid ${algo ? "rgba(155,47,255,.4)" : "rgba(240,232,255,.1)"}` }}>
        <span style={{ fontSize: 20 }}>{j.icono}</span>
        <strong style={{ flex: 1, minWidth: 120, fontSize: 13.5 }}>{j.nombre}</strong>
        <div style={{ display: "flex", gap: 18 }}>
          {control("qr", j, "QR")}
          {control("logo", j, "Logo")}
        </div>
      </div>
    );
  };

  const secciones = [...new Set(JUEGOS_CON_QR.map((j) => j.seccion))];

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {secciones.map((s) => (
        <section key={s} style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
            color: "rgba(240,232,255,.45)" }}>{s}</div>
          {JUEGOS_CON_QR.filter((j) => j.seccion === s).map(fila)}
        </section>
      ))}
      <div style={{ fontSize: 11.5, color: "rgba(240,232,255,.5)", lineHeight: 1.6 }}>
        Cada interruptor manda en las tres pantallas del juego: la placa de anuncio, la convocatoria y el juego en pantalla.
        El QR va abajo a la izquierda y lleva al celular directo al juego; el logo de BizarrApp va arriba a la izquierda.
      </div>
      {!puedeEditar && (
        <div style={{ fontSize: 11.5, color: "rgba(240,232,255,.45)" }}>Tu usuario no puede cambiar esta configuración.</div>
      )}
      {aviso && (
        <div role={aviso.tono === "error" ? "alert" : "status"}
          style={{ fontSize: 11.5, color: aviso.tono === "error" ? "#FCA5A5" : "#00F5A0" }}>
          {aviso.texto}
        </div>
      )}
    </div>
  );
}
