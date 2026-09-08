import { supabase } from "../lib/supabase";
import { advanceEvent, fetchLiveEvent } from "./pantallaDj";

/**
 * Recortes del catálogo central para el Escenario.
 *
 * Follow the Leader NO consume la cola de DJ Democracy. La canción del
 * participante es una reproducción TEMPORAL sobre los mismos players A/B: la
 * canción del evento queda congelada como `current_item_id` y vuelve intacta al
 * terminar la performance.
 *
 * Por eso acá ya no hay `pantalla_add_items` ni `pantalla_advance_event`.
 * Forzar la canción del juego como actual la archivaba en `pantalla_play_history`,
 * le sumaba una reproducción, le borraba los votos y movía el ranking — todo por
 * una performance que pertenece a otro juego. Y era la causa de que al cerrar
 * FTL el DJ se quedara con la canción del participante.
 *
 * Lo único que hace falta del catálogo es el recorte: viaja en `escenario_video`
 * y lo aplica la TV al cargar el video.
 */

/**
 * Recorte configurado en el catálogo central para esta canción.
 *
 * `escenario_queue` guarda el yt_id pero no el id de la fila del catálogo, así
 * que se resuelve por categoría 'ftl' + youtube id, que es como está armado el
 * catálogo (playlist_categories → playlist_to_category → playlist_items).
 *
 * Si el mismo video aparece en varias playlists de FTL con recortes DISTINTOS,
 * no se elige ninguno al azar: se corta con un error que nombra el conflicto.
 * Elegir en silencio haría que el mismo tema arranque en un segundo distinto
 * según el orden en que devolvió la consulta, y eso es imposible de depurar
 * desde el escenario. Recortes iguales repetidos no son ambigüedad.
 *
 * Devuelve { trim_start_seconds, trim_end_seconds } o null si no hay recorte.
 */
async function buscarRecorteCentral(ytId) {
  const { data: cat, error: eCat } = await supabase
    .from("playlist_categories").select("id").eq("slug", "ftl").maybeSingle();
  if (eCat) throw new Error(eCat.message);
  if (!cat) return null;

  const { data: links, error: eLinks } = await supabase
    .from("playlist_to_category").select("playlist_id").eq("category_id", cat.id);
  if (eLinks) throw new Error(eLinks.message);
  const ids = (links || []).map((l) => l.playlist_id);
  if (!ids.length) return null;

  const { data: filas, error: eItems } = await supabase
    .from("playlist_items")
    .select("trim_start_seconds, trim_end_seconds")
    .in("playlist_id", ids)
    .eq("yt_id", ytId);
  if (eItems) throw new Error(eItems.message);
  if (!filas?.length) return null;

  const distintos = [...new Set(filas.map(
    (f) => `${f.trim_start_seconds ?? 0}|${f.trim_end_seconds ?? ""}`,
  ))];
  if (distintos.length > 1) {
    throw new Error(
      `La canción está en varias playlists de FTL con recortes distintos (${distintos.join(" / ")}). ` +
      "Dejá un solo recorte para este video en Playlists YouTube y volvé a prepararlo.",
    );
  }

  return {
    trim_start_seconds: Number(filas[0].trim_start_seconds) || 0,
    trim_end_seconds:   filas[0].trim_end_seconds ?? null,
  };
}

/**
 * Recorte a usar para la canción que eligió el participante.
 *
 * Devuelve { trimStart, trimEnd }, listo para guardar en `escenario_video` para
 * que la TV lo aplique al cargar el video. Sin recorte configurado devuelve
 * { trimStart: 0, trimEnd: null }, que es "el video entero".
 */
export async function recorteDeEscenario(ytId) {
  if (!ytId) return { trimStart: 0, trimEnd: null };
  const recorte = await buscarRecorteCentral(ytId);
  return {
    trimStart: recorte?.trim_start_seconds ?? 0,
    trimEnd:   recorte?.trim_end_seconds ?? null,
  };
}

/**
 * Al cerrar el Escenario, el DJ pasa a su canción siguiente.
 *
 * Durante todo Follow the Leader `current_item_id` siguió siendo la canción del
 * DJ (A): la performance fue una fuente temporal que nunca entró a la cola. Al
 * soltar el juego se hace UN avance normal —el mismo del botón "▶|" de la
 * consola— con `expected_current_id = A`, y el motor elige la siguiente por
 * ranking (C). No se vuelve a A y B jamás fue del DJ.
 *
 * Es un solo avance sin importar cuántos participantes pasaron por el escenario:
 * finalizar un turno no avanza nada, sólo el cierre del juego.
 *
 * @returns {{avanzado: boolean, motivo?: string}}
 */
export async function avanzarDjAlSiguiente() {
  const event = await fetchLiveEvent();
  if (!event) return { avanzado: false, motivo: "no hay evento de DJ en vivo" };
  if (event.status !== "live") return { avanzado: false, motivo: "el evento no está en vivo" };
  if (!event.current_item_id) return { avanzado: false, motivo: "el DJ no tenía ninguna canción puesta" };

  try {
    await advanceEvent(event.id, null, event.current_item_id);
  } catch (err) {
    // `expected_current_id` rebotado: alguien ya avanzó (otro operador, el fin
    // natural del tema). El objetivo ya está cumplido, no es un fallo.
    if (String(err?.message || "").includes("stale advance")) {
      return { avanzado: false, motivo: "el DJ ya había avanzado por su cuenta" };
    }
    throw err;
  }
  return { avanzado: true };
}
