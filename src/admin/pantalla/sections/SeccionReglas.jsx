import { saveEventFields } from "../../../services/pantallaDj";
import PanelSection from "../PanelSection";
import { BotonGuardar, CampoNumero, useBorrador, useGuardado } from "../panelControls";

const CAMPOS = ["active_candidates_count", "relegation_rounds_threshold"];

export default function SeccionReglas({ event, refresh }) {
  const [b, set] = useBorrador(
    {
      active_candidates_count: event.active_candidates_count,
      relegation_rounds_threshold: event.relegation_rounds_threshold,
    },
    [event.id, event.active_candidates_count, event.relegation_rounds_threshold],
  );

  const { estado, mensaje, guardar } = useGuardado(async () => {
    await saveEventFields(event.id, {
      active_candidates_count: b.active_candidates_count,
      relegation_rounds_threshold: b.relegation_rounds_threshold,
    });
    await refresh();
  });

  const cambiado = CAMPOS.some((c) => b[c] !== event[c]);

  return (
    <PanelSection id="reglas-votacion" title="Reglas de votación">
      <div className="pdj-sub" style={{ marginBottom: 12 }}>
        El servidor mantiene un grupo fijo de candidatos visibles. Cuando una canción se reproduce
        o es reemplazada, el grupo se completa automáticamente con la siguiente mejor.
      </div>

      <CampoNumero label="Cantidad de candidatos visibles (3–15)" min={3} max={15}
        value={b.active_candidates_count} onChange={(v) => set("active_candidates_count", v)}
        hint="Los invitados y la vista TV solo verán estas canciones para votar." />

      <CampoNumero label="Rondas consecutivas en último lugar antes de reemplazo (1–10)"
        min={1} max={10} value={b.relegation_rounds_threshold}
        onChange={(v) => set("relegation_rounds_threshold", v)}
        hint="Si una canción queda última N veces seguidas, se reemplaza automáticamente por otra de la lista, sin importar los votos que tenga." />

      <BotonGuardar estado={estado} mensaje={mensaje} disabled={!cambiado}
        onClick={guardar} texto="Guardar reglas" />
    </PanelSection>
  );
}
