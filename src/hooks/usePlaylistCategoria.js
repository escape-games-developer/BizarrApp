import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Canciones de una categoría del catálogo central (`playlist_categories.slug`).
 *
 * La fuente de verdad es Supabase, no el navegador. Antes, la playlist de cada
 * juego de escenario salía de `localStorage['bizarrapp_yt_config']`: una PC que
 * nunca la había tocado —o un celular, que nunca la toca— veía cero canciones.
 *
 * El catálogo ya existía y no hubo que inventarlo:
 *   playlist_categories  → categorías de sistema con slug ('ftl','pt','karaoke'…)
 *   playlist_to_category → qué playlists cuelgan de cada categoría
 *   playlist_items       → los temas, con yt_id/título/artista
 * Se administra desde Admin › Playlists YouTube. Las cuatro tablas tienen
 * SELECT público en RLS y están en la publicación de Realtime, así que un
 * cambio del staff llega solo a los celulares que ya están mirando la lista.
 *
 * Devuelve las canciones con la forma que espera `VideoRow`
 * ({ id, ytId, title, artist, thumb }); una playlist sin temas devuelve [].
 */
export function usePlaylistCategoria(slug) {
  const [canciones, setCanciones] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const montadoRef = useRef(true);

  const cargar = useCallback(async () => {
    if (!slug) { setCanciones([]); setLoading(false); return; }
    try {
      // 1. La categoría de sistema.
      const { data: cat, error: eCat } = await supabase
        .from("playlist_categories")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (eCat) throw new Error(eCat.message);
      if (!cat) {
        if (montadoRef.current) { setCanciones([]); setError(null); }
        return;
      }

      // 2. Las playlists colgadas de esa categoría.
      const { data: links, error: eLinks } = await supabase
        .from("playlist_to_category")
        .select("playlist_id")
        .eq("category_id", cat.id);
      if (eLinks) throw new Error(eLinks.message);
      const ids = (links || []).map((l) => l.playlist_id);
      if (!ids.length) {
        if (montadoRef.current) { setCanciones([]); setError(null); }
        return;
      }

      // 3. Sus temas. Se piden sólo las columnas que la vista usa.
      const { data: items, error: eItems } = await supabase
        .from("playlist_items")
        .select("id, yt_id, title, artist, thumb_url")
        .in("playlist_id", ids)
        .order("position",  { ascending: true })
        .order("added_at",  { ascending: true });
      if (eItems) throw new Error(eItems.message);

      if (!montadoRef.current) return;
      setError(null);
      setCanciones((items || [])
        .filter((i) => i.yt_id)
        .map((i) => ({
          id:     i.id,
          ytId:   i.yt_id,
          title:  i.title,
          artist: i.artist,
          thumb:  i.thumb_url,
        })));
    } catch (err) {
      if (montadoRef.current) setError(err.message || String(err));
    } finally {
      if (montadoRef.current) setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    montadoRef.current = true;
    setLoading(true);
    cargar();

    // Un tema agregado desde el panel aparece en el celular sin recargar.
    const canal = supabase
      .channel(`playlist-cat-${slug}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "playlist_items" }, cargar)
      .on("postgres_changes", { event: "*", schema: "public", table: "playlist_to_category" }, cargar)
      .subscribe();

    return () => {
      montadoRef.current = false;
      supabase.removeChannel(canal);
    };
  }, [slug, cargar]);

  return { canciones, loading, error, refresh: cargar };
}
