import { saveEventFields } from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonGuardar, CampoNumero, CampoSwitch, useBorrador, useGuardado } from "../panelControls";

/**
 * Limpieza automática de invitados.
 *
 * La configuración se guarda de verdad en `pantalla_events`, pero **el trabajo
 * programado que la ejecuta todavía no existe**: se verificó contra la base y
 * `pg_cron` no está ni instalado. Se avisa acá para que nadie deje el evento
 * abierto una semana creyendo que se limpia solo.
 *
 * La función y el job están escritos en la migración
 * `20260909130000_pantalla_limpieza_y_reset.sql`, sin aplicar. Cuando se
 * apliquen, esta sección funciona tal cual está: lee y escribe las dos columnas
 * que el job consulta, así que no hay nada que cambiar acá.
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
    <PanelSection id="limpieza-invitados" title="Limpieza automática de invitados" icon="🧹"
      status="pendiente"
      aviso={"Los valores se guardan, pero el trabajo programado que borra a los invitados "
        + "vencidos todavía no está corriendo: la base no tiene pg_cron instalado. La función "
        + "y el job están en la migración 20260909130000_pantalla_limpieza_y_reset.sql, sin "
        + "aplicar. Hasta entonces, sacar gente sigue siendo manual desde «Invitados», en la "
        + "consola en vivo."}>
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

      <div className="pdj-campo-hint" style={{ color: P.tenue }}>
        Los roles <strong>VIP</strong>, <strong>Staff</strong> y <strong>DJ</strong> nunca se
        eliminan automáticamente. El cumpleañero sí: es un invitado con una etiqueta de la
        noche, no gente del local.
      </div>

      <BotonGuardar estado={estado} mensaje={mensaje} disabled={!cambiado} onClick={guardar} />
    </PanelSection>
  );
}
