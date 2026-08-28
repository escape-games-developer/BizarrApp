import { saveEventFields } from "../../../services/pantallaDj";
import PanelSection from "../PanelSection";
import {
  BotonGuardar, CampoNumero, CampoSwitch, CampoTexto, useBorrador, useGuardado,
} from "../panelControls";

/**
 * Sacar Tema — la votación para voltear la canción que está sonando.
 *
 * El porcentaje se mide sobre los participantes activos, sin contar al Staff, y
 * la ventana de actividad define quién cuenta como activo. Al alcanzarse el
 * umbral el servidor saltea la canción solo: el panel sólo fija las reglas.
 */

const CAMPOS = ["kick_enabled", "kick_button_text", "kick_threshold_pct", "kick_activity_minutes"];

export default function SeccionKick({ event, refresh }) {
  const [b, set] = useBorrador(
    {
      kick_enabled:          event.kick_enabled,
      kick_button_text:      event.kick_button_text || "",
      kick_threshold_pct:    event.kick_threshold_pct,
      kick_activity_minutes: event.kick_activity_minutes,
    },
    [event.id, event.kick_enabled, event.kick_button_text, event.kick_threshold_pct, event.kick_activity_minutes],
  );

  const { estado, mensaje, guardar } = useGuardado(async () => {
    await saveEventFields(event.id, {
      kick_enabled:          b.kick_enabled,
      kick_button_text:      b.kick_button_text.trim() || "Voltear este tema",
      kick_threshold_pct:    b.kick_threshold_pct,
      kick_activity_minutes: b.kick_activity_minutes,
    });
    await refresh();
  });

  const cambiado = CAMPOS.some((c) => b[c] !== (event[c] ?? ""));
  const off = !b.kick_enabled;

  return (
    <PanelSection id="sacar-tema" title="Sacar Tema" icon="👎">
      <CampoSwitch label="Sacar Tema habilitado" checked={b.kick_enabled}
        onChange={(v) => set("kick_enabled", v)} />

      <div style={{ marginTop: 11, opacity: off ? .5 : 1 }}>
        <CampoTexto label="Texto del botón en el cliente" value={b.kick_button_text}
          disabled={off} maxLength={40} placeholder="Voltear este tema"
          onChange={(v) => set("kick_button_text", v)}
          hint="Lo que lee el invitado en su celular. Si queda vacío vuelve a «Voltear este tema»." />

        <CampoNumero label="Porcentaje necesario (%)" min={1} max={100} disabled={off}
          value={b.kick_threshold_pct} onChange={(v) => set("kick_threshold_pct", v)}
          hint="Se calcula sobre los participantes activos, sin contar al Staff." />

        <CampoNumero label="Ventana de actividad (minutos)" min={1} max={480} disabled={off}
          value={b.kick_activity_minutes} onChange={(v) => set("kick_activity_minutes", v)}
          hint="Alguien cuenta como activo si su último heartbeat entra en esta ventana." />
      </div>

      <BotonGuardar estado={estado} mensaje={mensaje} disabled={!cambiado} onClick={guardar} />
    </PanelSection>
  );
}
