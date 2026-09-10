import { useCallback, useEffect, useState } from "react";
import { fetchVipGifts, saveVipGifts, TIPOS_REGALO } from "../../../services/pantallaConfig";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonGuardar, useGuardado } from "../panelControls";

const TIPOS = [
  { id: "screen_message", ico: "▣", label: "Mensaje en la Pantalla", ayuda: "Cada VIP puede mandar un mensaje corto a la TV." },
  { id: "gif_screen", ico: "▧", label: "GIF a Pantalla", ayuda: "Cada VIP elige un GIF de la galería para mostrar en la TV." },
  { id: "giant_reaction", ico: "🎶", label: "Reacciones Gigantes", ayuda: "Reacciones agrandadas en la pantalla TV." },
  { id: "extra_super_vote", ico: "♨", label: "Súper Voto extra", ayuda: "Suma un Súper Voto adicional al VIP." },
];

const DEFAULTS = {
  screen_message: { enabled: true, interval_minutes: 60, quantity: 1 },
  gif_screen: { enabled: true, interval_minutes: 35, quantity: 1 },
  giant_reaction: { enabled: true, interval_minutes: 40, quantity: 30 },
  extra_super_vote: { enabled: true, interval_minutes: 30, quantity: 1 },
};

const vacio = () => Object.fromEntries(TIPOS_REGALO.map((t) => [t, { ...(DEFAULTS[t] || { enabled: false, interval_minutes: 60, quantity: 1 }) }]));

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
          interval_minutes: f.interval_minutes ?? mapa[f.gift_type].interval_minutes,
          quantity: f.quantity ?? mapa[f.gift_type].quantity,
        };
      }
      setBase(mapa); setBorr(mapa);
    } catch (err) { onError?.(err); }
  }, [event.id, onError]);

  useEffect(() => { cargar(); }, [cargar]);

  const set = (tipo, patch) => setBorr((b) => ({ ...b, [tipo]: { ...b[tipo], ...patch } }));
  const cambiados = TIPOS_REGALO.filter((t) => JSON.stringify(base[t]) !== JSON.stringify(borr[t]));

  const { estado, mensaje, guardar } = useGuardado(async () => {
    await saveVipGifts(event.id, cambiados.map((t) => ({ gift_type: t, ...borr[t] })));
    await cargar();
  });

  return (
    <PanelSection id="regalos-vip" title="Regalos periódicos para VIP"
      status="pendiente"
      aviso="La configuración se guarda, pero todavía falta el motor periódico que otorga estos regalos automáticamente.">
      <div className="pdj-sub" style={{ marginBottom: 12 }}>
        Regalos automáticos y repetidos para cada invitado con rol VIP. El tiempo se cuenta individualmente desde que cada invitado pasó a ser VIP, y después desde su último regalo. Los invitados comunes y los cumpleañeros no reciben estos regalos.
      </div>

      {TIPOS.map((t) => {
        const v = borr[t.id];
        return (
          <div key={t.id} style={{
            borderRadius: 14, padding: 12, marginBottom: 10,
            background: "rgba(240,232,255,.025)", border: "1px solid rgba(240,232,255,.09)",
          }}>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
              <input type="checkbox" checked={v.enabled}
                onChange={(e) => set(t.id, { enabled: e.target.checked })}
                style={{ accentColor: "#ff7a00", marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: P.texto }}>{t.ico} {t.label}</div>
                <div style={{ fontSize: 10.5, color: P.tenue2, marginTop: 2 }}>{t.ayuda}</div>
              </div>
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "10px 0 0 24px", opacity: v.enabled ? 1 : .45 }}>
              <span style={{ fontSize: 10.5, color: P.tenue }}>Cada cuántos minutos</span>
              <input type="number" min={1} max={600} value={v.interval_minutes} disabled={!v.enabled}
                onChange={(e) => set(t.id, { interval_minutes: Number(e.target.value) || 1 })}
                style={{ width: 80, padding: "6px 9px", borderRadius: 10, background: "#07070a", color: P.texto, border: "1px solid rgba(240,232,255,.14)" }} />
              {t.id === "giant_reaction" && (
                <>
                  <span style={{ fontSize: 10.5, color: P.tenue }}>Reacciones gigantes por vez</span>
                  <input type="number" min={1} max={999} value={v.quantity} disabled={!v.enabled}
                    onChange={(e) => set(t.id, { quantity: Number(e.target.value) || 1 })}
                    style={{ width: 80, padding: "6px 9px", borderRadius: 10, background: "#07070a", color: P.texto, border: "1px solid rgba(240,232,255,.14)" }} />
                </>
              )}
            </div>
          </div>
        );
      })}

      <BotonGuardar estado={estado} mensaje={mensaje} disabled={cambiados.length === 0} onClick={guardar} />
    </PanelSection>
  );
}
