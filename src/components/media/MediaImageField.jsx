import { useState } from "react";
import MediaLibraryModal from "./MediaLibraryModal";
import {
  IMAGE_DEFAULTS,
  SCALE_MIN, SCALE_MAX, OFFSET_MIN, OFFSET_MAX,
} from "./imageLayout";
import mediaCss from "./mediaStyles";
import { NovedadCard } from "../../views/Novedades/NovedadesView";

/** Control numérico + slider. Fuera del componente para no remontar al arrastrar. */
function Slider({ label, val, min, max, suffix = "", onSet }) {
  return (
    <div className="mf-slider">
      <label>{label}</label>
      <input
        type="range" min={min} max={max} value={val}
        onChange={(e) => onSet(Number(e.target.value))}
        aria-label={label}
      />
      <input
        className="mf-num" type="number" min={min} max={max} value={val}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onSet(Math.min(max, Math.max(min, Math.round(n))));
        }}
        aria-label={`${label} (valor)`}
      />
      <span style={{ fontSize: 10, color: "rgba(240,232,255,.28)", width: 10 }}>{suffix}</span>
    </div>
  );
}

/**
 * Sección "Imagen de la novedad" del formulario del admin.
 *
 * Preview + elegir de biblioteca + quitar imagen + encuadre (escala y
 * desplazamiento X/Y). El preview usa el mismo componente de card que la web
 * app del cliente, así lo que el staff acomoda es literalmente lo que se ve.
 *
 * @param {object}   value     { asset, position, scale, x, y }
 * @param {function} onChange  recibe el value completo actualizado
 * @param {object}   preview   campos del banner (title, body, type, …) para el preview
 * @param {object}   design    diseño de Novedades a usar en el preview (default: Jorge)
 */
export default function MediaImageField({ value, onChange, preview = {}, design }) {
  const [libOpen, setLibOpen] = useState(false);

  const asset    = value?.asset ?? null;
  const position = value?.position ?? IMAGE_DEFAULTS.position;
  const scale    = value?.scale    ?? IMAGE_DEFAULTS.scale;
  const x        = value?.x        ?? IMAGE_DEFAULTS.x;
  const y        = value?.y        ?? IMAGE_DEFAULTS.y;

  const patch = (next) => onChange({ asset, position, scale, x, y, ...next });

  const previewBanner = {
    ...preview,
    image_asset:    asset,
    image_position: position,
    image_scale:    scale,
    image_x:        x,
    image_y:        y,
  };

  return (
    <>
      <style>{mediaCss}</style>

      <div className="ctitle">Imagen de la novedad</div>

      {/* Sin imagen, la franja de la card muestra el emoji de la novedad. */}
      {design?.fontsCss && <style>{design.fontsCss}</style>}
      <NovedadCard banner={previewBanner} design={design} preview />

      <div className="mf-row">
        <button type="button" className="ml-btn ml-btn-p" onClick={() => setLibOpen(true)}>
          {asset ? "Cambiar imagen" : "Elegir de biblioteca"}
        </button>
        <button
          type="button"
          className="ml-btn ml-btn-r"
          disabled={!asset}
          onClick={() => patch({ asset: null, ...IMAGE_DEFAULTS })}
        >
          Quitar imagen
        </button>
      </div>

      {asset && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10.5, color: "rgba(240,232,255,.42)", marginBottom: 8 }}>
            {asset.name}{asset.category ? ` · ${asset.category}` : ""}
          </div>

          {/* La imagen ocupa la franja 2.4:1 de arriba de la card: sólo se
              ajusta el encuadre (escala y desplazamiento). */}
          <Slider label="Escala"     val={scale} min={SCALE_MIN}  max={SCALE_MAX}  suffix="%"
            onSet={(v) => patch({ scale: v })} />
          <Slider label="Posición X" val={x}     min={OFFSET_MIN} max={OFFSET_MAX}
            onSet={(v) => patch({ x: v })} />
          <Slider label="Posición Y" val={y}     min={OFFSET_MIN} max={OFFSET_MAX}
            onSet={(v) => patch({ y: v })} />

          <button
            type="button"
            className="ml-btn ml-btn-g"
            style={{ marginTop: 9 }}
            onClick={() => patch({ ...IMAGE_DEFAULTS })}
          >
            Restablecer encuadre
          </button>
        </div>
      )}

      <MediaLibraryModal
        open={libOpen}
        selectedId={asset?.id ?? null}
        onClose={() => setLibOpen(false)}
        onSelect={(picked) => patch({ asset: picked })}
      />
    </>
  );
}
