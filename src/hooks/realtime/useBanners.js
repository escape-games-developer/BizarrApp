import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Novedades / banners del admin.
 * Trae los banners visibles de la sesión activa + los globales (session_id null)
 * y se mantiene en vivo via postgres_changes.
 */
// Trae la imagen elegida de la biblioteca junto con el banner, en una sola
// consulta (relación banners.image_asset_id → media_assets.id).
const SELECT_WITH_ASSET =
  "*, image_asset:media_assets(id,name,file_url,thumb_url,category)";

export function useBanners(sessionId) {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBanners = useCallback(async () => {
    // Los banners globales (session_id null) se ven siempre, aunque todavía
    // no haya sesión activa.
    const filter = sessionId
      ? `session_id.eq.${sessionId},session_id.is.null`
      : "session_id.is.null";

    const query = (select) => supabase
      .from("banners")
      .select(select)
      .eq("visible", true)
      .or(filter)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    let { data, error } = await query(SELECT_WITH_ASSET);

    // Si la base todavía no tiene la biblioteca de imágenes, se cae al select
    // clásico para no dejar la sección de Novedades vacía.
    if (error) {
      console.warn("[useBanners] join con media_assets no disponible:", error.message);
      ({ data, error } = await query("*"));
    }

    if (error) {
      console.error("[useBanners] fetch error:", error);
      setBanners([]);
    } else {
      setBanners(data || []);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { fetchBanners(); }, [fetchBanners]);

  useEffect(() => {
    const channel = supabase
      .channel(`banners_${sessionId || "global"}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "banners",
      }, fetchBanners)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, fetchBanners]);

  return { banners, loading, refresh: fetchBanners };
}
