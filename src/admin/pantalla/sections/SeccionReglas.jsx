import { saveEventFields } from "../../../services/pantallaDj";
import PanelSection from "../PanelSection";
import { BotonGuardar, CampoNumero, useBorrador, useGuardado } from "../panelControls";

/**
 * Reglas del motor de playlist.
 *
 * Los tres rangos son los que la propia tabla impone por CHECK: candidatas
 * entre 3 y 15, rondas de relegación entre 1 y 10. El score de descarte no
 * tiene CHECK, pero por debajo de -50 el tema ya no vuelve nunca: acotarlo acá
 * evita configuraciones que en la práctica son «desactivado».
 */

const CAMPOS = ["active_candidates_count", "relegation_rounds_threshold", "reject_score_threshold"];

export default function SeccionReglas({ event, refresh }) {
  const [b, set] = useBorrador(
    {
      active_candidates_count:     event.active_candidates_count,
      relegation_rounds_threshold: event.relegation_rounds_threshold,
      reject_score_threshold:      event.reject_score_threshold,
    },
    [event.id, event.active_candidates_count, event.relegation_rounds_threshold, event.reject_score_threshold],
  );

  const { estado, mensaje, guardar } = useGuardado(async () => {
    await saveEventFields(event.id, {
      active_candidates_count:     b.active_candidates_count,
      relegation_rounds_threshold: b.relegation_rounds_threshold,
      reject_score_threshold:      b.reject_score_threshold,
    });
    await refresh();
  });

  const cambiado = CAMPOS.some((c) => b[c] !== event[c]);

  return (
    <PanelSection id="reglas-votacion" title="Reglas de votación" icon="⚙️">
      <CampoNumero label="Candidatos visibles" min={3} max={15}
        value={b.active_candidates_count}
        onChange={(v) => set("active_candidates_count", v)}
        hint="La ventana fija que ve el cliente. El servidor la rellena solo desde la playlist." />

      <CampoNumero label="Rondas en último lugar antes de reemplazar" min={1} max={10}
        value={b.relegation_rounds_threshold}
        onChange={(v) => set("relegation_rounds_threshold", v)}
        hint="El tema que queda último esta cantidad de rondas seguidas sale de la ventana y vuelve al fondo de la playlist." />

      <CampoNumero label="Umbral de rechazo (score)" min={-50} max={0}
        value={b.reject_score_threshold}
        onChange={(v) => set("reject_score_threshold", v)}
        hint="Por debajo de este score el tema queda descartado y no vuelve a entrar en la ventana." />

      <BotonGuardar estado={estado} mensaje={mensaje} disabled={!cambiado} onClick={guardar} />
    </PanelSection>
  );
}
