import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listMediaAssets,
  uploadMediaAsset,
  deleteMediaAsset,
  updateMediaAsset,
  categoriesOf,
  filterAssets,
} from "../services/mediaAssets";

/**
 * Estado de la biblioteca de imágenes para el admin.
 * `enabled` evita pegarle a la base hasta que el modal se abre por primera vez.
 */
export function useMediaAssets({ enabled = true } = {}) {
  const [assets,  setAssets]  = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error,   setError]   = useState(null);
  const [loaded,  setLoaded]  = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAssets(await listMediaAssets());
      setLoaded(true);
    } catch (err) {
      console.error("[useMediaAssets] fetch error:", err);
      setError(err.message || "No se pudo cargar la biblioteca.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled && !loaded) refresh();
  }, [enabled, loaded, refresh]);

  /** Sube un archivo y lo deja disponible al instante, sin recargar la lista. */
  const upload = useCallback(async (file, meta) => {
    const created = await uploadMediaAsset(file, meta);
    setAssets((prev) => [created, ...prev]);
    return created;
  }, []);

  const remove = useCallback(async (asset) => {
    await deleteMediaAsset(asset);
    setAssets((prev) => prev.filter((a) => a.id !== asset.id));
  }, []);

  const update = useCallback(async (id, patch) => {
    const updated = await updateMediaAsset(id, patch);
    setAssets((prev) => prev.map((a) => (a.id === id ? updated : a)));
    return updated;
  }, []);

  const categories = useMemo(() => categoriesOf(assets), [assets]);

  return { assets, categories, loading, error, refresh, upload, remove, update, filterAssets };
}
