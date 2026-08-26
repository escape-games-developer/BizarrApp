import { useCallback, useEffect, useMemo, useState } from "react";
import { useMediaAssets } from "../../hooks/useMediaAssets";
import { filterAssets } from "../../services/mediaAssets";
import MediaAssetCard from "./MediaAssetCard";
import MediaUploader from "./MediaUploader";
import mediaCss from "./mediaStyles";

/**
 * Modal reutilizable de biblioteca de imágenes.
 * Buscador por nombre, filtro por categoría, subida de archivos nuevos y
 * confirmación explícita de la selección.
 *
 * @param {boolean}  open
 * @param {function} onClose
 * @param {function} onSelect      recibe el asset elegido al confirmar
 * @param {string}   selectedId    id preseleccionado (la imagen actual)
 * @param {string}   title
 */
export default function MediaLibraryModal({
  open,
  onClose,
  onSelect,
  selectedId = null,
  title = "Biblioteca de imágenes",
}) {
  const { assets, categories, loading, error, refresh, upload, remove } =
    useMediaAssets({ enabled: open });

  const [search,      setSearch]      = useState("");
  const [category,    setCategory]    = useState("");
  const [pickedId,    setPickedId]    = useState(selectedId);
  const [uploaderOn,  setUploaderOn]  = useState(false);
  const [actionError, setActionError] = useState(null);

  // Al abrir, arranca posicionado sobre la imagen que la novedad ya usa.
  // Se guarda el id (no el objeto) para que la selección sobreviva a los
  // refrescos de la lista, por ejemplo después de subir un archivo nuevo.
  useEffect(() => {
    if (!open) return;
    setPickedId(selectedId);
    setActionError(null);
    setUploaderOn(false);
  }, [open, selectedId]);

  const picked = useMemo(
    () => assets.find((a) => a.id === pickedId) || null,
    [assets, pickedId],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    // Evita que el panel de atrás scrollee mientras el modal está abierto.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const visible = useMemo(
    () => filterAssets(assets, { search, category }),
    [assets, search, category],
  );

  const handleDelete = useCallback(async (asset) => {
    const ok = window.confirm(
      `¿Eliminar "${asset.name}" de la biblioteca?\n\n` +
      "Las novedades que la estén usando vuelven a mostrar su emoji.",
    );
    if (!ok) return;
    setActionError(null);
    try {
      await remove(asset);
      setPickedId((id) => (id === asset.id ? null : id));
    } catch (err) {
      setActionError(err.message);
    }
  }, [remove]);

  if (!open) return null;

  return (
    <>
      <style>{mediaCss}</style>
      <div className="ml-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
        <div className="ml-modal" role="dialog" aria-modal="true" aria-label={title}>

          <div className="ml-head">
            <div className="ml-title">
              {title}
              <div className="ml-count">
                {loading ? "Cargando…" : `${visible.length} de ${assets.length} imágenes`}
              </div>
            </div>
            <button type="button" className="ml-x" aria-label="Cerrar" onClick={onClose}>✕</button>
          </div>

          <div className="ml-tools">
            <input
              className="ml-field ml-search"
              type="search"
              placeholder="Buscar por nombre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="ml-field ml-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              type="button"
              className={`ml-btn ${uploaderOn ? "ml-btn-g" : "ml-btn-a"}`}
              onClick={() => setUploaderOn((v) => !v)}
            >
              {uploaderOn ? "Cerrar subida" : "+ Subir nueva imagen"}
            </button>
          </div>

          <div className="ml-body">
            {uploaderOn && (
              <MediaUploader
                categories={categories}
                onUpload={upload}
                onUploaded={(last) => { setPickedId(last.id); setUploaderOn(false); }}
                onClose={() => setUploaderOn(false)}
              />
            )}

            {(error || actionError) && (
              <div className="ml-err">
                {error || actionError}
                {error && (
                  <button type="button" className="ml-btn ml-btn-g"
                    style={{ marginTop: 8, display: "block" }} onClick={refresh}>
                    Reintentar
                  </button>
                )}
              </div>
            )}

            {loading && assets.length === 0 && (
              <div className="ml-empty">Cargando biblioteca…</div>
            )}

            {!loading && assets.length === 0 && !error && (
              <div className="ml-empty">
                Todavía no hay imágenes en la biblioteca.<br />
                Usá <strong>+ Subir nueva imagen</strong> para cargar las primeras.
              </div>
            )}

            {assets.length > 0 && visible.length === 0 && (
              <div className="ml-empty">
                Ninguna imagen coincide con la búsqueda.
              </div>
            )}

            {visible.length > 0 && (
              <div className="ml-grid">
                {visible.map((asset) => (
                  <MediaAssetCard
                    key={asset.id}
                    asset={asset}
                    selected={picked?.id === asset.id}
                    onSelect={(a) => setPickedId(a.id)}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="ml-foot">
            <span style={{ fontSize: 10.5, color: "rgba(240,232,255,.4)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "45%" }}>
              {picked ? `Seleccionada: ${picked.name}` : "Ninguna imagen seleccionada"}
            </span>
            <span className="ml-spacer" />
            <button type="button" className="ml-btn ml-btn-g" onClick={onClose}>Cancelar</button>
            <button
              type="button"
              className="ml-btn ml-btn-p"
              disabled={!picked}
              onClick={() => { onSelect?.(picked); onClose?.(); }}
            >
              Usar esta imagen
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
