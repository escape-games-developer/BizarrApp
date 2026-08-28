import { saveEventFields } from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonGuardar, CampoNumero, CampoSwitch, useBorrador, useGuardado } from "../panelControls";

/**
 * Limpieza automática de invitados.
 *
 * La configuración se guarda de verdad en `pantalla_events`, pero **el trabajo
 * programado que la ejecuta todavía no existe**: la base no tiene `pg_cron`
 * instalado ni ninguna función de limpieza. Se avisa acá para que nadie deje el
 * evento abierto una semana creyendo que se limpia solo.
 */
export default function SeccionLimpieza({ event, refresh }) {
  const [b, set] = useBorrador(
    {
      guest_cleanup_enabled:      !!event.guest_cleanup_enabled,
      guest_max_connection_hours: event.guest_max_connection_hours,
    },
    [event.id, event.guest_cleanup_enabled, event.guest_max_connection_hours],
  );

  const { estado, mensaje, guardar } = useGuardado(async () => {
    await saveEventFields(event.id, {
      guest_cleanup_enabled:      b.guest_cleanup_enabled,
      guest_max_connection_hours: b.guest_max_connection_hours,
    });
    await refresh();
  });

  const cambiado = b.guest_cleanup_enabled !== !!event.guest_cleanup_enabled
    || b.guest_max_connection_hours !== event.guest_max_connection_hours;

  return (
    <PanelSection id="limpieza-invitados" title="Limpieza de invitados" icon="🧹">
      <div className="pdj-sec-aviso">
        <span style={{ flexShrink: 0 }}>🕓</span>
        <span>
          Los valores se guardan, pero el trabajo programado que borra a los invitados vencidos
          todavía no está corriendo. Hasta que exista, sacar gente sigue siendo manual desde
          la sección Invitados.
        </span>
      </div>

      <CampoSwitch label="Limpieza automática habilitada" checked={b.guest_cleanup_enabled}
        onChange={(v) => set("guest_cleanup_enabled", v)} />

      <div style={{ marginTop: 11, opacity: b.guest_cleanup_enabled ? 1 : .5 }}>
        <CampoNumero label="Horas máximas de conexión" min={1} max={168}
          value={b.guest_max_connection_hours} disabled={!b.guest_cleanup_enabled}
          onChange={(v) => set("guest_max_connection_hours", v)}
          hint="Pasadas estas horas desde que entró, el invitado deja de contar como presente. Entre 1 y 168 (una semana)." />
      </div>

      <div className="pdj-campo-hint" style={{ color: P.tenue }}>
        No confundir con la ventana de actividad de Sacar Tema: esa mide quién está mirando
        ahora, esta mide hace cuánto que alguien entró.
      </div>

      <BotonGuardar estado={estado} mensaje={mensaje} disabled={!cambiado} onClick={guardar} />
    </PanelSection>
  );
}
