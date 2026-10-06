import { fetchItems, fetchLiveEvent } from "../../services/pantallaDj";
import { prefetchClientDesign } from "../../hooks/realtime/useClientDesign";

/**
 * Precarga de Pantalla (DJ Democracy) para que la primera visita no espere.
 *
 * Sólo lecturas: evento en vivo, su playlist y el diseño activo. Nada que
 * escriba (el join al evento lo sigue haciendo la vista al montarse).
 *
 * Es caché de presentación: la vista arranca con esto y su carga normal lo
 * refresca enseguida. Supabase sigue siendo la autoridad.
 */
let snapshot = null;   // { event, items }
let enCurso  = null;

export function prefetchPantalla() {
  prefetchClientDesign("pantalla");
  if (enCurso) return enCurso;
  enCurso = (async () => {
    const event = await fetchLiveEvent();
    const items = event ? await fetchItems(event.id) : [];
    snapshot = { event, items };
  })()
    .catch((e) => console.warn("[prefetchPantalla]", e?.message ?? e))
    .finally(() => { enCurso = null; });
  return enCurso;
}

/** Último snapshot precargado, o null. */
export const pantallaSnapshot = () => snapshot;

/** La vista guarda acá lo último que mostró (mismo formato, sólo datos públicos). */
export function guardarPantallaSnapshot(next) { snapshot = next; }
