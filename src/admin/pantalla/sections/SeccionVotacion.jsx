import { useState, useEffect } from "react";
import { saveEventFields } from "../../../services/pantallaDj";
import PanelSection from "../PanelSection";
import { BotonGuardar, CampoSelect, useGuardado } from "../panelControls";

/**
 * Cómo vota la gente. `voting_mode` sólo acepta 'best' y 'rank'.
 *
 * En Best cada persona sostiene una sola elección: votar otro tema le saca el
 * voto al anterior. En Rank puede votar todos los que quiera. La regla la
 * aplica el servidor en `pantalla_cast_vote`, no el cliente.
 */

const MODOS = [
  { value: "best", label: "🏆 Best — un 👍 por persona" },
  { value: "rank", label: "📊 Rank — un 👍 por cada tema" },
];

const EXPLICACION = {
  best: "Votar otra canción le mueve el voto: cada persona sostiene una sola elección a la vez.",
  rank: "Cada persona puede votar todas las canciones que quiera; los votos no se pisan entre sí.",
};

export default function SeccionVotacion({ event, refresh }) {
  const [modo, setModo] = useState(event.voting_mode);
  useEffect(() => { setModo(event.voting_mode); }, [event.voting_mode]);

  const { estado, mensaje, guardar } = useGuardado(async (valor) => {
    await saveEventFields(event.id, { voting_mode: valor });
    await refresh();
  });

  return (
    <PanelSection id="modo-votacion" title="Modo de votación" icon="🗳" defaultOpen>
      <CampoSelect label="Cómo vota el público" value={modo} options={MODOS}
        onChange={setModo} hint={EXPLICACION[modo]} />
      <BotonGuardar estado={estado} mensaje={mensaje}
        disabled={modo === event.voting_mode} onClick={() => guardar(modo)} />
    </PanelSection>
  );
}
