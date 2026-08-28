import { useCallback, useEffect, useState } from "react";
import { fetchPhysicalPrizeCode, savePhysicalPrizeCode } from "../../../services/pantallaConfig";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonCopiar, BotonGuardar, Campo, useGuardado } from "../panelControls";

/**
 * Código de canje del premio físico.
 *
 * Vive en `pantalla_event_secrets`, la misma tabla del token de la TV, que **no
 * tiene policy de lectura pública**. Es a propósito: si estuviera en
 * `pantalla_events` cualquier anónimo lo leería por REST y se llevaría el premio
 * sin haberlo ganado — que es exactamente la fuga que tiene DJ Democracy con
 * `physical_prize_secret_code`.
 *
 * Por eso acá sólo se lee y se escribe con el cliente autenticado, y la sección
 * arranca con el código tapado: el panel se abre en la barra y se comparte
 * pantalla, y un código de canje a la vista es un premio regalado.
 */

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const nuevoCodigo = () => Array.from(
  { length: 8 },
  () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)],
).join("");

const limpiar = (v) => String(v || "").toUpperCase().split("")
  .filter((c) => ALFABETO.includes(c)).join("").slice(0, 16);

export default function SeccionCodigoCanje({ event, onError }) {
  const [codigo,   setCodigo]   = useState("");
  const [guardado, setGuardado] = useState("");
  const [visible,  setVisible]  = useState(false);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const c = await fetchPhysicalPrizeCode(event.id);
      setCodigo(c || ""); setGuardado(c || "");
    } catch (err) { onError?.(err); }
    finally { setCargando(false); }
  }, [event.id, onError]);

  useEffect(() => { cargar(); }, [cargar]);
  // Al cambiar de evento se vuelve a tapar: el código anterior no queda a la vista.
  useEffect(() => { setVisible(false); }, [event.id]);

  const { estado, mensaje, guardar } = useGuardado(async () => {
    await savePhysicalPrizeCode(event.id, codigo.trim() || null);
    setGuardado(codigo.trim());
  });

  const cambiado = codigo.trim() !== guardado;

  return (
    <PanelSection id="codigo-canje" title="Código de canje del premio" icon="🔐">
      <div className="pdj-sub">
        Lo pide el personal de la barra para entregar un premio real. Sirve para todo el
        evento: alcanza con que lo sepan los que entregan.
      </div>

      <Campo label="Código"
        hint="Sin I, O, 0 ni 1: se dicta en un bar ruidoso sin tener que deletrear. Vacío = sin código.">
        <div style={{ display: "flex", gap: 5 }}>
          <input className="pdj-input" value={codigo} disabled={cargando}
            type={visible ? "text" : "password"} autoComplete="off"
            aria-label="Código de canje del premio físico"
            placeholder={cargando ? "Cargando…" : "Sin código"}
            onChange={(e) => setCodigo(limpiar(e.target.value))}
            style={{
              flex: 1, minWidth: 0, fontFamily: "'Syne',sans-serif",
              fontWeight: 900, letterSpacing: 3, fontSize: 13,
            }} />
          <button type="button" className="pdj-mini" disabled={cargando}
            title={visible ? "Ocultar el código" : "Mostrar el código"}
            aria-label={visible ? "Ocultar el código" : "Mostrar el código"}
            onClick={() => setVisible((v) => !v)}>{visible ? "🙈" : "👁"}</button>
          <button type="button" className="pdj-mini" disabled={cargando}
            title="Generar un código nuevo"
            onClick={() => { setCodigo(nuevoCodigo()); setVisible(true); }}>🎲</button>
        </div>
      </Campo>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <BotonCopiar valor={guardado} texto="⧉ Copiar" disabled={!guardado} />
        {guardado && !cambiado && (
          <span style={{ fontSize: 10, color: P.tenue2 }}>
            Guardado · {visible ? guardado : "•".repeat(guardado.length)}
          </span>
        )}
      </div>

      <BotonGuardar estado={estado} mensaje={mensaje}
        disabled={cargando || !cambiado} onClick={guardar} />

      <div className="pdj-sec-aviso" style={{ marginTop: 11, marginBottom: 0 }}>
        <span style={{ flexShrink: 0 }}>🔒</span>
        <span>
          El código se guarda en <code>pantalla_event_secrets</code>, que no tiene lectura
          pública: ningún invitado puede pedirlo por REST. Tampoco lo compartas en una captura
          ni lo dejes proyectado.
        </span>
      </div>
    </PanelSection>
  );
}
