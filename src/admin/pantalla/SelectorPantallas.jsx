import { useEffect, useState } from "react";
import { getTvLink, saveEventFields, telepronterUrl, tvUrl } from "../../services/pantallaDj";

/** Una pantalla se da por activa si latió en los últimos 20 s, igual que la TV en la consola. */
const VIVA_MS = 20_000;

/**
 * Las pantallas del evento. Las dos entran con el mismo link (code + token);
 * cambia la ruta y la columna donde late cada una.
 */
const PANTALLAS = [
  { id: "gigante",     label: "📺 Pantalla Gigante",     url: tvUrl,          latido: "tv_connected_at" },
  { id: "telepronter", label: "🪞 Pantalla Telepronter", url: telepronterUrl, latido: "telepronter_connected_at" },
];

const VERDE = "#00F5A0", ROJO = "#FF2D78", TENUE = "#7A6E8A";

const pill = {
  display: "flex", alignItems: "center", height: 30, boxSizing: "border-box",
  borderRadius: 20, fontSize: 11, fontWeight: 700,
};

/**
 * Selector de pantallas de la barra superior del Admin (reemplaza «Abrir TV»):
 *
 *   ACTIVO/INACTIVO · [pantalla ▾] · [↗ enviar] · [⇆ espejo, sólo Telepronter]
 *
 * El estado es el de la pantalla elegida, leído de su latido en
 * `pantalla_events`. El espejo se guarda en el evento y la Telepronter lo toma
 * por Realtime, así que se puede invertir con la pantalla ya abierta.
 */
export default function SelectorPantallas({ event, onError }) {
  const [elegida, setElegida] = useState("gigante");
  const [espejo,  setEspejo]  = useState(null);   // optimista hasta que llega el Realtime
  const [ahora,   setAhora]   = useState(() => Date.now());

  // Sin re-render no se "vence" el latido: una pantalla cerrada seguiría activa.
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 5_000);
    return () => clearInterval(id);
  }, []);

  const espejoGuardado = event?.telepronter_espejo === true;
  useEffect(() => { setEspejo(null); }, [espejoGuardado, event?.id]);
  const espejoOn = espejo ?? espejoGuardado;

  const pantalla = PANTALLAS.find((p) => p.id === elegida);
  const latido   = event?.[pantalla.latido];
  const activa   = !!latido && ahora - new Date(latido).getTime() < VIVA_MS;
  const hayEvento = !!event;

  const enviar = async () => {
    if (!event) return;
    try {
      const link = await getTvLink(event.id);
      window.open(pantalla.url(link.code || event.code, link.token), "_blank", "noopener");
    } catch (err) { onError?.(err); }
  };

  const alternarEspejo = async () => {
    if (!event) return;
    const nuevo = !espejoOn;
    setEspejo(nuevo);
    try { await saveEventFields(event.id, { telepronter_espejo: nuevo }); }
    catch (err) { setEspejo(null); onError?.(err); }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, order: 1 }}>
      <span title={activa ? `${pantalla.label} abierta y reportando` : `${pantalla.label} sin señal`}
        style={{ ...pill, padding: "0 4px", minWidth: 62, justifyContent: "flex-end", color: !hayEvento ? TENUE : activa ? VERDE : ROJO }}>
        {activa ? "ACTIVO" : "INACTIVO"}
      </span>

      <select value={elegida} onChange={(e) => setElegida(e.target.value)} disabled={!hayEvento}
        title="Elegí la pantalla del evento"
        style={{ ...pill, padding: "0 10px", background: "#1A0D2E", color: "#F0E8FF",
          border: `1px solid ${TENUE}66`, cursor: hayEvento ? "pointer" : "not-allowed",
          opacity: hayEvento ? 1 : .55, outline: "none" }}>
        {PANTALLAS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>

      <button type="button" onClick={enviar} disabled={!hayEvento}
        title={`Abrir ${pantalla.label} en otra pestaña`} aria-label={`Abrir ${pantalla.label}`}
        style={{ ...pill, width: 30, justifyContent: "center", padding: 0,
          background: hayEvento ? "#9B2FFF" : `${TENUE}18`, border: "none",
          color: hayEvento ? "#F0E8FF" : TENUE, cursor: hayEvento ? "pointer" : "not-allowed" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="7" y1="17" x2="17" y2="7"/>
          <polyline points="8 7 17 7 17 16"/>
        </svg>
      </button>

      {/* Siempre montado: con la Gigante elegida queda invisible pero ocupando
          su lugar, así la barra no se corre al cambiar de pantalla. */}
      <button type="button" onClick={alternarEspejo} disabled={!hayEvento || elegida !== "telepronter"}
          aria-hidden={elegida !== "telepronter"} tabIndex={elegida === "telepronter" ? 0 : -1}
          title={espejoOn ? "La Telepronter se ve invertida. Tocá para verla normal."
                          : "Invertir la Telepronter en espejo"}
          style={{ ...pill, padding: "0 12px", gap: 5, minWidth: 104, justifyContent: "center",
            visibility: elegida === "telepronter" ? "visible" : "hidden",
            background: espejoOn ? "#00E5FF18" : `${TENUE}22`,
            border: `1px solid ${espejoOn ? "#00E5FF88" : `${TENUE}55`}`,
            color: espejoOn ? "#00E5FF" : TENUE, cursor: hayEvento ? "pointer" : "not-allowed" }}>
          ⇆ ESPEJO {espejoOn ? "ON" : "OFF"}
        </button>
    </div>
  );
}
