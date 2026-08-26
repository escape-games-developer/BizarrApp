import { formatBytes } from "../../services/mediaAssets";

/**
 * Item de la grilla de la biblioteca: thumbnail, nombre y categoría.
 * El thumbnail va sobre un damero para que se note la transparencia de los PNG.
 */
export default function MediaAssetCard({ asset, selected, onSelect, onDelete }) {
  const src = asset.thumb_url || asset.file_url;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      className={`ml-item${selected ? " sel" : ""}`}
      onClick={() => onSelect(asset)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(asset); }
      }}
      title={`${asset.name}${asset.size_bytes ? ` · ${formatBytes(asset.size_bytes)}` : ""}`}
    >
      <div className="ml-thumb">
        <img
          src={src}
          alt={asset.name}
          loading="lazy"
          decoding="async"
          draggable={false}
          // width/height reales evitan que la grilla salte al cargar.
          width={asset.width || undefined}
          height={asset.height || undefined}
        />
      </div>

      <div className="ml-name">{asset.name}</div>
      {asset.category && <span className="ml-cat-chip">{asset.category}</span>}

      {selected && <span className="ml-tick" aria-hidden="true">✓</span>}

      {onDelete && (
        <button
          type="button"
          className="ml-del"
          aria-label={`Eliminar ${asset.name}`}
          title="Eliminar de la biblioteca"
          onClick={(e) => { e.stopPropagation(); onDelete(asset); }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
