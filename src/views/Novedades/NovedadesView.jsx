import { useState } from "react";
import {
  normalizeImageConfig,
  imageLayerStyle,
  contentSpacingFor,
  BACKGROUND_SCRIM,
} from "../../components/media/imageLayout";

// Formato oficial de cada card de novedades: pieza gráfica de 1440x600 (12:5).
// Las cards se apilan una debajo de la otra, cada una a ancho completo y
// manteniendo la relación de aspecto, así la imagen se ve como fue diseñada.
const CARD_W = 1440;
const CARD_H = 600;
const CARD_RATIO = `${CARD_W} / ${CARD_H}`;

// Marco sobrio tomado de la estética 4d2c809. La imagen sigue siendo dinámica.
const FRAME = {
  position:     "relative",
  width:        "100%",
  borderRadius: 14,
  overflow:     "hidden",
  background:   "rgba(255,215,0,.04)",
  border:       "1px solid rgba(255,215,0,.14)",
};

/**
 * Una novedad. Tres modos, en orden de prioridad:
 *   1. `image_url`      → pieza gráfica completa 1440x600 (comportamiento previo)
 *   2. `image_asset`    → imagen de la biblioteca superpuesta al layout de texto,
 *                         encuadrada con image_position / scale / x / y
 *   3. ninguna de las dos → emoji + texto, como siempre
 *
 * `preview` lo usa el admin para mostrar la card dentro del formulario sin la
 * animación de entrada ni el margen de la lista.
 */
export function NovedadCard({ banner, index = 0, preview = false }) {
  const [imgFailed,   setImgFailed]   = useState(false);
  const [assetFailed, setAssetFailed] = useState(false);

  const hasImage = Boolean(banner.image_url) && !imgFailed;

  // El asset llega embebido desde useBanners (join con media_assets). Si la
  // novedad es vieja o el recurso fue borrado, simplemente no está.
  const assetUrl = banner.image_asset?.file_url || null;
  const hasAsset = Boolean(assetUrl) && !assetFailed;
  const cfg      = normalizeImageConfig(banner);
  const hasVisual = hasImage || hasAsset;

  const assetAlt = banner.image_alt || banner.image_asset?.name || banner.title || "";

  return (
    <div
      className={preview ? undefined : "fade-up"}
      style={{
        ...FRAME,
        minHeight:         hasVisual ? undefined : 104,
        aspectRatio:       hasVisual ? CARD_RATIO : undefined,
        marginBottom:      preview ? 0 : 10,
        animationDelay:    preview ? undefined : `${index * .07}s`,
        animationFillMode: preview ? undefined : "both",
      }}
    >
      {hasImage ? (
        <img
          src={banner.image_url}
          alt={banner.image_alt || banner.title || "Novedad"}
          width={CARD_W}
          height={CARD_H}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setImgFailed(true)}
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        // Fallback: si el banner todavía no tiene pieza cargada (o falló),
        // se arma el contenido con el texto, dentro del mismo 1440x600.
        <>
          {/* Imagen de biblioteca en modo fondo: va detrás del texto, con un
              velo suave para no perder legibilidad. */}
          {hasAsset && cfg.position === "background" && (
            <>
              <img
                src={assetUrl}
                alt={assetAlt}
                loading="lazy"
                decoding="async"
                draggable={false}
                aria-hidden={assetAlt ? undefined : "true"}
                onError={() => setAssetFailed(true)}
                style={imageLayerStyle(cfg)}
              />
              <div style={BACKGROUND_SCRIM} aria-hidden="true" />
            </>
          )}

          <div style={{
            position: "relative", zIndex: 2,
            width: "100%", height: "100%",
            padding: hasVisual ? "3.5% 5%" : "14px 16px",
            display: "flex", alignItems: "center", gap: "4%",
            boxSizing: "border-box",
            // Le reserva lugar al texto cuando la imagen va a un costado.
            ...(hasAsset ? contentSpacingFor(cfg) : null),
          }}>
            {/* El emoji es el icono del sistema anterior: sólo aparece cuando
                la novedad todavía no tiene imagen de biblioteca. */}
            {!hasAsset && (
              <div style={{ fontSize: 28, flexShrink: 0 }}>{banner.emoji || "📢"}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 15,
                color: banner.color || "#FFD700", marginBottom: 4, lineHeight: 1.2,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {banner.title}
              </div>
              {banner.body && (
                <div style={{
                  fontSize: 12, color: "rgba(245,230,192,.65)",
                  lineHeight: 1.4, marginBottom: 6,
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>
                  {banner.body}
                </div>
              )}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "2px 9px", borderRadius: 10,
                background: "rgba(255,215,0,.08)", border: "1px solid rgba(255,215,0,.15)",
                fontSize: 9, fontWeight: 700, color: "rgba(255,215,0,.5)", letterSpacing: ".5px",
              }}>
                {banner.tag || "NOVEDAD"}
              </span>
            </div>
          </div>

          {/* Imagen de biblioteca a izquierda o derecha, por encima del fondo
              pero sin bloquear clicks (pointer-events:none en imageLayerStyle). */}
          {hasAsset && cfg.position !== "background" && (
            <img
              src={assetUrl}
              alt={assetAlt}
              loading="lazy"
              decoding="async"
              draggable={false}
              aria-hidden={assetAlt ? undefined : "true"}
              onError={() => setAssetFailed(true)}
              style={imageLayerStyle(cfg)}
            />
          )}
        </>
      )}
    </div>
  );
}

// Estado vacío: mismo marco y mismo formato que una card, para que la sección
// no cambie de altura cuando el staff carga la primera novedad.
function EmptyCard() {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "48px 20px", textAlign: "center",
    }}>
      <div style={{ fontSize: 44, marginBottom: 14, opacity: .2 }}>📣</div>
      <div style={{
        fontFamily: "Syne, sans-serif", fontSize: 15, fontWeight: 800,
        color: "rgba(255,215,0,.25)", marginBottom: 8,
      }}>
        Sin novedades por ahora
      </div>
      <div style={{ fontSize: 12, color: "rgba(245,230,192,.22)", lineHeight: 1.5 }}>
        El staff publicará las promos y novedades de la noche acá.
      </div>
    </div>
  );
}

export default function NovedadesView({ banners = [], loading = false }) {
  const visible = banners.filter((b) => b.visible !== false);

  if (loading) {
    return (
      <div style={{ ...FRAME, height: 104, opacity: .45 }}/>
    );
  }

  if (visible.length === 0) return <EmptyCard/>;

  return (
    <div>
      <div className="sec-hdr">
        <span style={{ fontSize: 20 }}>📣</span>
        <h3>Novedades y Promos</h3>
      </div>
      {visible.map((b, i) => (
        <NovedadCard key={b.id || i} banner={b} index={i}/>
      ))}
    </div>
  );
}
