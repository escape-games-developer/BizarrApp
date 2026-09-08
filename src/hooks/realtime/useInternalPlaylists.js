import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";

// Slug helper: convierte "Mi Nueva Categoría" → "mi-nueva-categoria"
function slugify(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Extraer yt_id de URL de YouTube
function extractYtId(url) {
  if (!url) return null;
  const u = url.trim();
  const m1 = u.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (m1) return m1[1];
  const m2 = u.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (m2) return m2[1];
  const m3 = u.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (m3) return m3[1];
  const m4 = u.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (m4) return m4[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(u)) return u;
  return null;
}

export function useInternalPlaylists() {
  const [playlists, setPlaylists] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Trae playlists con items + categorías en una sola pasada
  const fetchAll = useCallback(async () => {
    setLoading(true);

    const [playlistsRes, categoriesRes, linksRes] = await Promise.all([
      supabase.from("playlists").select("*").order("position", { ascending: true }).order("created_at", { ascending: true }),
      supabase.from("playlist_categories").select("*").order("position", { ascending: true }).order("name", { ascending: true }),
      supabase.from("playlist_to_category").select("*"),
    ]);

    if (playlistsRes.error) console.error("[useInternalPlaylists] playlists error:", playlistsRes.error);
    if (categoriesRes.error) console.error("[useInternalPlaylists] categories error:", categoriesRes.error);
    if (linksRes.error) console.error("[useInternalPlaylists] links error:", linksRes.error);

    const playlistsData = playlistsRes.data || [];
    const categoriesData = categoriesRes.data || [];
    const linksData = linksRes.data || [];

    // Si no hay playlists, terminamos
    if (playlistsData.length === 0) {
      setCategories(categoriesData);
      setPlaylists([]);
      setLoading(false);
      return;
    }

    // Traer items de todas las playlists
    const playlistIds = playlistsData.map(p => p.id);
    const { data: itemsData } = await supabase
      .from("playlist_items")
      .select("*")
      .in("playlist_id", playlistIds)
      .order("position", { ascending: true })
      .order("added_at", { ascending: true });

    // Agrupar items por playlist
    const itemsByPlaylist = {};
    (itemsData || []).forEach(item => {
      if (!itemsByPlaylist[item.playlist_id]) itemsByPlaylist[item.playlist_id] = [];
      itemsByPlaylist[item.playlist_id].push(item);
    });

    // Agrupar categorías por playlist
    const categoriesByPlaylist = {};
    linksData.forEach(link => {
      if (!categoriesByPlaylist[link.playlist_id]) categoriesByPlaylist[link.playlist_id] = [];
      const cat = categoriesData.find(c => c.id === link.category_id);
      if (cat) categoriesByPlaylist[link.playlist_id].push(cat);
    });

    const enriched = playlistsData.map(p => ({
      ...p,
      items: itemsByPlaylist[p.id] || [],
      itemCount: (itemsByPlaylist[p.id] || []).length,
      categories: categoriesByPlaylist[p.id] || [],
      categoryIds: (categoriesByPlaylist[p.id] || []).map(c => c.id),
    }));

    setCategories(categoriesData);
    setPlaylists(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();

    const channels = [
      supabase.channel("playlists_ch").on("postgres_changes", { event: "*", schema: "public", table: "playlists" }, fetchAll).subscribe(),
      supabase.channel("playlist_items_ch").on("postgres_changes", { event: "*", schema: "public", table: "playlist_items" }, fetchAll).subscribe(),
      supabase.channel("playlist_categories_ch").on("postgres_changes", { event: "*", schema: "public", table: "playlist_categories" }, fetchAll).subscribe(),
      supabase.channel("playlist_to_category_ch").on("postgres_changes", { event: "*", schema: "public", table: "playlist_to_category" }, fetchAll).subscribe(),
    ];

    return () => channels.forEach(ch => supabase.removeChannel(ch));
  }, [fetchAll]);

  // ─── CRUD PLAYLISTS ───

  const createPlaylist = useCallback(async (name, description = null, categoryIds = []) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;

    const maxPos = playlists.reduce((m, p) => Math.max(m, p.position || 0), 0);
    const { data: { user } } = await supabase.auth.getUser();

    const { data: playlist, error } = await supabase
      .from("playlists")
      .insert({
        name: trimmed,
        description: description || null,
        position: maxPos + 1,
        created_by: user?.id || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[createPlaylist] error:", error);
      return null;
    }

    // Vincular categorías iniciales
    if (categoryIds.length > 0) {
      const links = categoryIds.map(catId => ({
        playlist_id: playlist.id,
        category_id: catId,
      }));
      const { error: linkError } = await supabase
        .from("playlist_to_category")
        .insert(links);
      if (linkError) console.error("[createPlaylist] link error:", linkError);
    }

    return playlist;
  }, [playlists]);

  const deletePlaylist = useCallback(async (id) => {
    setPlaylists(prev => prev.filter(p => p.id !== id));
    const { error } = await supabase.from("playlists").delete().eq("id", id);
    if (error) {
      console.error("[deletePlaylist] error:", error);
      fetchAll();
    }
  }, [fetchAll]);

  const renamePlaylist = useCallback(async (id, newName) => {
    const trimmed = (newName || "").trim();
    if (!trimmed) return;

    setPlaylists(prev => prev.map(p => p.id === id ? {...p, name: trimmed} : p));

    const { error } = await supabase.from("playlists").update({ name: trimmed }).eq("id", id);
    if (error) {
      console.error("[renamePlaylist] error:", error);
      fetchAll();
    }
  }, [fetchAll]);

  // Cambiar categorías de una playlist (reemplaza todas las anteriores)
  const setPlaylistCategories = useCallback(async (playlistId, newCategoryIds) => {
    // Borrar todas las relaciones anteriores
    const { error: delError } = await supabase
      .from("playlist_to_category")
      .delete()
      .eq("playlist_id", playlistId);

    if (delError) {
      console.error("[setPlaylistCategories] delete error:", delError);
      return false;
    }

    // Insertar las nuevas
    if (newCategoryIds.length > 0) {
      const links = newCategoryIds.map(catId => ({
        playlist_id: playlistId,
        category_id: catId,
      }));
      const { error: insError } = await supabase
        .from("playlist_to_category")
        .insert(links);

      if (insError) {
        console.error("[setPlaylistCategories] insert error:", insError);
        return false;
      }
    }

    return true;
  }, []);

  // ─── CRUD ITEMS ───

  const addItemToPlaylist = useCallback(async (playlistId, { ytId, title, artist, thumb, duration }) => {
    if (!playlistId || !ytId) return null;

    const playlist = playlists.find(p => p.id === playlistId);
    const maxPos = (playlist?.items || []).reduce((m, i) => Math.max(m, i.position || 0), 0);
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("playlist_items")
      .insert({
        playlist_id: playlistId,
        yt_id: ytId,
        title: title || "Sin título",
        artist: artist || null,
        thumb_url: thumb || null,
        duration_seconds: duration || null,
        position: maxPos + 1,
        added_by: user?.id || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") return { duplicate: true };
      console.error("[addItemToPlaylist] error:", error);
      return null;
    }

    return data;
  }, [playlists]);

  /**
   * Alta en lote — el import de una playlist de YouTube entra por acá.
   *
   * Devuelve { agregadas, omitidas, errores, detalleErrores } para que el panel
   * pueda cantar el resultado real: sin esto, una importación parcial se vería
   * igual que una completa.
   *
   * Los duplicados se filtran ANTES de escribir (por yt_id, contra lo que ya
   * tiene la playlist y contra el propio lote, que puede traer repetidos de
   * YouTube). La base igual los rechazaría — existe UNIQUE (playlist_id, yt_id)
   * —, pero entonces caería el INSERT entero y no habría forma de decir cuáles
   * eran nuevos. El orden de llegada se respeta: es el de YouTube.
   */
  const importItemsToPlaylist = useCallback(async (playlistId, entrantes) => {
    const vacio = { agregadas: 0, omitidas: 0, errores: 0, detalleErrores: [] };
    if (!playlistId || !Array.isArray(entrantes) || !entrantes.length) return vacio;

    // Estado real de la playlist, leído de la base y no del cache local: entre
    // el preview y el import pudo entrar otro tema desde otra pestaña.
    const { data: actuales, error: eLeer } = await supabase
      .from("playlist_items")
      .select("yt_id, position")
      .eq("playlist_id", playlistId);
    if (eLeer) return { ...vacio, errores: entrantes.length, detalleErrores: [eLeer.message] };

    const yaEstan = new Set((actuales || []).map((i) => i.yt_id));
    let pos = (actuales || []).reduce((m, i) => Math.max(m, i.position || 0), 0);

    const { data: { user } } = await supabase.auth.getUser();

    const filas = [];
    let omitidas = 0;
    for (const v of entrantes) {
      if (!v?.ytId) { omitidas += 1; continue; }
      if (yaEstan.has(v.ytId)) { omitidas += 1; continue; }
      yaEstan.add(v.ytId);
      pos += 1;
      filas.push({
        playlist_id: playlistId,
        yt_id:       v.ytId,
        title:       v.title || "Sin título",
        artist:      v.artist || null,
        thumb_url:   v.thumb || null,
        position:    pos,
        added_by:    user?.id || null,
      });
    }
    if (!filas.length) { await fetchAll(); return { ...vacio, omitidas }; }

    // Un solo INSERT en el caso normal. Si algo lo rechaza (una carrera contra
    // otra pestaña, un título imposible), se reintenta fila por fila para saber
    // exactamente cuáles entraron en vez de perder el lote entero.
    const { data, error } = await supabase.from("playlist_items").insert(filas).select("id");
    if (!error) {
      await fetchAll();
      return { agregadas: data?.length ?? filas.length, omitidas, errores: 0, detalleErrores: [] };
    }

    let agregadas = 0, errores = 0;
    const detalleErrores = [];
    for (const fila of filas) {
      const { error: eUna } = await supabase.from("playlist_items").insert(fila);
      if (!eUna) { agregadas += 1; continue; }
      if (eUna.code === "23505") { omitidas += 1; continue; }
      errores += 1;
      if (detalleErrores.length < 3) detalleErrores.push(`${fila.title}: ${eUna.message}`);
    }
    await fetchAll();
    return { agregadas, omitidas, errores, detalleErrores };
  }, [fetchAll]);

  /**
   * Recorte de un tema del catálogo: desde qué segundo arranca y en cuál se da
   * por terminado. Son los mismos nombres que usa `pantalla_playlist_items`,
   * así el puente de FTL los copia sin traducir y el motor de la TV los honra.
   *
   * La base tiene los CHECK (inicio >= 0, fin > inicio), pero se valida acá
   * también para devolver un mensaje legible en vez del texto del constraint.
   */
  const setItemTrims = useCallback(async (itemId, { start, end }) => {
    const ini = Number(start) || 0;
    const fin = end === "" || end === null || end === undefined ? null : Number(end);
    if (!Number.isFinite(ini) || ini < 0) return { error: "El inicio no puede ser negativo." };
    if (fin !== null && (!Number.isFinite(fin) || fin <= ini)) {
      return { error: "El fin tiene que ser mayor que el inicio." };
    }
    const { data, error } = await supabase
      .from("playlist_items")
      .update({ trim_start_seconds: ini, trim_end_seconds: fin })
      .eq("id", itemId)
      .select("id");
    if (error) return { error: error.message };
    // La RLS filtra sin devolver error: 0 filas no es un guardado exitoso.
    if (!data?.length) return { error: "No se pudo guardar (sin permisos sobre este tema)." };
    await fetchAll();
    return { error: null };
  }, [fetchAll]);

  const removeItemFromPlaylist = useCallback(async (itemId) => {
    setPlaylists(prev => prev.map(p => ({
      ...p,
      items: p.items.filter(i => i.id !== itemId),
      itemCount: p.items.filter(i => i.id !== itemId).length,
    })));

    const { error } = await supabase.from("playlist_items").delete().eq("id", itemId);
    if (error) {
      console.error("[removeItemFromPlaylist] error:", error);
      fetchAll();
    }
  }, [fetchAll]);

  const addByUrl = useCallback(async (playlistId, ytUrl) => {
    const ytId = extractYtId(ytUrl);
    if (!ytId) return { error: "URL inválida. Debe ser un link de YouTube." };

    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    let title = `Video ${ytId}`;
    let artist = null;
    let thumb = `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;

    if (apiKey) {
      try {
        const url = new URL("https://www.googleapis.com/youtube/v3/videos");
        url.searchParams.set("part", "snippet");
        url.searchParams.set("id", ytId);
        url.searchParams.set("key", apiKey);

        const res = await fetch(url.toString());
        if (res.ok) {
          const data = await res.json();
          const item = data.items?.[0];
          if (item) {
            title = item.snippet?.title || title;
            artist = item.snippet?.channelTitle || null;
            thumb = item.snippet?.thumbnails?.medium?.url || thumb;
          } else {
            return { error: "Video no encontrado o privado." };
          }
        }
      } catch (err) {
        console.warn("[addByUrl] fallback sin API:", err);
      }
    }

    const result = await addItemToPlaylist(playlistId, { ytId, title, artist, thumb });
    if (result?.duplicate) return { error: "Este tema ya está en la playlist." };
    return { success: true, item: result };
  }, [addItemToPlaylist]);

  // ─── CRUD CATEGORÍAS ───

  const createCategory = useCallback(async (name, color = "#9B2FFF") => {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;

    const slug = slugify(trimmed);
    if (!slug) return null;

    // Verificar duplicado
    if (categories.some(c => c.slug === slug || c.name.toLowerCase() === trimmed.toLowerCase())) {
      return { duplicate: true };
    }

    const maxPos = categories.reduce((m, c) => Math.max(m, c.position || 0), 0);
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("playlist_categories")
      .insert({
        name: trimmed,
        slug,
        color: color || "#9B2FFF",
        is_system: false,
        position: maxPos + 1,
        created_by: user?.id || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[createCategory] error:", error);
      return null;
    }

    return data;
  }, [categories]);

  const deleteCategory = useCallback(async (categoryId) => {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return false;
    if (cat.is_system) {
      console.warn("[deleteCategory] no se puede borrar categoría del sistema");
      return false;
    }

    const { error } = await supabase
      .from("playlist_categories")
      .delete()
      .eq("id", categoryId);

    if (error) {
      console.error("[deleteCategory] error:", error);
      return false;
    }
    return true;
  }, [categories]);

  const renameCategory = useCallback(async (categoryId, newName, newColor = null) => {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return false;

    const trimmed = (newName || "").trim();
    if (!trimmed) return false;

    const updates = { name: trimmed };
    // Si es categoría custom, también actualizamos el slug y color
    if (!cat.is_system) {
      updates.slug = slugify(trimmed);
    }
    if (newColor) {
      updates.color = newColor;
    }

    const { error } = await supabase
      .from("playlist_categories")
      .update(updates)
      .eq("id", categoryId);

    if (error) {
      console.error("[renameCategory] error:", error);
      return false;
    }
    return true;
  }, [categories]);

  return {
    playlists,
    categories,
    loading,
    // Playlists CRUD
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    setPlaylistCategories,
    // Items CRUD
    addItemToPlaylist,
    importItemsToPlaylist,
    setItemTrims,
    removeItemFromPlaylist,
    addByUrl,
    // Categorías CRUD
    createCategory,
    deleteCategory,
    renameCategory,
    // Helpers
    refresh: fetchAll,
  };
}
