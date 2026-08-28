import { useCallback, useEffect, useState } from "react";
import { fetchVipGifts, saveVipGifts, TIPOS_REGALO } from "../../../services/pantallaConfig";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonGuardar, useGuardado } from "../panelControls";

/**
 * Regalos periódicos para los VIP.
 *
 * Cada tipo es una fila de `pantalla_vip_gifts` con PK (evento, tipo). Los
 * cuatro tipos posibles los fija un CHECK en la tabla, así que la lista de acá
 * no es una convención de la UI: es el dominio real de la columna.
 */

const TIPOS = [
  { id: "screen_message",   ico: "💬", label: "Mensaje en pantalla",
    ayuda: "El VIP puede mandar un texto a la TV." },
  { id: "gif_screen",       ico: "🎞", label: "GIF a pantalla",
    ayuda: "El VIP puede tirar un GIF del catálogo a la TV." },
  { id: "giant_reaction",   ico: "💥", label: "Reacciones gigantes",
    ayuda: "Reacción a tamaño grande sobre el video." },
  { id: "extra_super_vote", ico: "🔥", label: "Súper voto extra",
    ayuda: "Suma súper votos por encima del cupo del evento." },
];

const vacio = () => Object.fromEntries(TIPOS_REGALO.map((t) => [t,
  { enabled: false, interval_minutes: 60, quantity: 1 }]));

export default function SeccionRegalosVip({ event, onError }) {
  const [base, setBase] = useState(vacio);
  const [borr, setBorr] = useState(vacio);

  const cargar = useCallback(async () => {
    try {
      const filas = await fetchVipGifts(event.id);
      const mapa = vacio();
      for (const f of filas) {
        if (!mapa[f.gift_type]) continue;
        mapa[f.gift_type] = {
          enabled: !!f.enabled,
          interval_minutes: f.interval_minutes ?? 60,
          quantity: f.quantity ?? 1,
        };
      }
      setBase(mapa); setBorr(mapa);
    } catch (err) { onError?.(err); }
  }, [event.id, onError]);

  useEffect(() => { cargar(); }, [cargar]);

  const set = (tipo, patch) =>
    setBorr((b) => ({ ...b, [tipo]: { ...b[tipo], ...patch } }));

  const cambiados = TIPOS_REGALO.filter((t) =>
    base[t].enabled !== borr[t].enabled
    || base[t].interval_minutes !== borr[t].interval_minutes
    || base[t].quantity !== borr[t].quantity);

  const { estado, mensaje, guardar } = useGuardado(async () => {
    await saveVipGifts(event.id, cambiados.map((t) => ({ gift_type: t, ...borr[t] })));
    await cargar();
  });

  return (
    <PanelSection id="regalos-vip" title="Regalos periódicos para VIP" icon="🎁">
      <div className="pdj-sub">
        Cada cuánto un VIP vuelve a tener disponible cada regalo. El intervalo se cuenta desde
        la última vez que lo usó, por persona.
      </div>

      {TIPOS.map((t) => {
        const v = borr[t.id];
        return (
          <div key={t.id} style={{
            borderRadius: 12, padding: "9px 10px", marginBottom: 8,
            background: v.enabled ? "rgba(155,47,255,.07)" : "rgba(240,232,255,.03)",
            border: `1px solid ${v.enabled ? "rgba(155,47,255,.26)" : "rgba(240,232,255,.08)"}`,
          }}>
            <label style={{
              display: "flex", alignItems: "center", gap: 7, cursor: "pointer", marginBottom: 6,
            }}>
              <input type="checkbox" checked={v.enabled}
                onChange={(e) => set(t.id, { enabled: e.target.checked })}
                style={{ accentColor: "#9B2FFF", cursor: "pointer", flexShrink: 0 }} />
              <span style={{ fontSize: 14 }}>{t.ico}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: P.texto, flex: 1 }}>{t.label}</span>
            </label>

            <div style={{ fontSize: 9.5, color: P.tenue2, lineHeight: 1.5, marginBottom: 7 }}>
              {t.ayuda}
            </div>

            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7,
              opacity: v.enabled ? 1 : .4,
            }}>
              <div>
                <label htmlFor={`int-${t.id}`} style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: .4, textTransform: "uppercase",
                  color: P.tenue2, display: "block", marginBottom: 3,
                }}>Cada (minutos)</label>
                <input id={`int-${t.id}`} className="pdj-input" type="number" min={1} max={1440}
                  value={v.interval_minutes} disabled={!v.enabled}
                  onChange={(e) => set(t.id, { interval_minutes: Number(e.target.value) || 1 })}
                  style={{ padding: "6px 8px", fontSize: 11 }} />
              </div>
              <div>
                <label htmlFor={`cant-${t.id}`} style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: .4, textTransform: "uppercase",
                  color: P.tenue2, display: "block", marginBottom: 3,
                }}>Cantidad</label>
                <input id={`cant-${t.id}`} className="pdj-input" type="number" min={1} max={20}
                  value={v.quantity} disabled={!v.enabled}
                  onChange={(e) => set(t.id, { quantity: Number(e.target.value) || 1 })}
                  style={{ padding: "6px 8px", fontSize: 11 }} />
              </div>
            </div>
          </div>
        );
      })}

      <BotonGuardar estado={estado} mensaje={mensaje}
        disabled={cambiados.length === 0} onClick={guardar} />
    </PanelSection>
  );
}
