import { useEffect, useState } from "react";
import { segundosRestantes } from "../lib/cierreVotacion";

/**
 * Cierre automático de la votación (ver lib/cierreVotacion.js), al día cada
 * medio segundo: `{ cerrada, restante }` — `restante` = segundos que le quedan
 * a la canción (null si no se sabe). Sin evento o con el cierre en 0: abierta.
 */
export function useCierreVotacion(event) {
  const [ahora, setAhora] = useState(() => Date.now());
  const activo = (Number(event?.vote_close_seconds) || 0) > 0 && !!event?.current_item_id;
  useEffect(() => {
    if (!activo) return undefined;
    const id = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(id);
  }, [activo]);
  const restante = activo ? segundosRestantes(event, ahora) : null;
  return { cerrada: restante !== null && restante <= Number(event.vote_close_seconds), restante };
}
