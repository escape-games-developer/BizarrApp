import { useState } from "react";
import { normalizeImageConfig, imageLayerStyle } from "../../components/media/imageLayout";
import {
  TYPE_BADGE, CTA_LABEL, ctaModeFor, newsType, newsDate,
  formatDateDMY, truncateText, isHttpUrl,
} from "../../constants/novedades";

// Formato oficial de la imagen de cada novedad: 1440x600 (2.4:1). Va arriba
// de la card, a ancho completo, y abajo el cuerpo con título, tipo, extracto,
// botón y fecha.
const IMG_W = 1440;
const IMG_H = 600;
const IMG_RATIO = `${IMG_W} / ${IMG_H}`;

// Marco sobrio tomado de la estética 4d2c809.
const FRAME = {
  position:     "relative",
  width:        "100%",
  borderRadius: 16,
  overflow:     "hidden",
  background:   "rgba(0,0,0,.42)",
  border:       "1px solid rgba(255,215,0,.14)",
};

/**
 * Una novedad. La imagen sale, en orden de prioridad, de:
 *   1. `image_url`    → pieza gráfica 1440x600
 *   2. `image_asset`  → imagen de la biblioteca, encuadrada con scale / x / y
 *   3. ninguna        → el emoji de la novedad
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
  const hasAsset = !hasImage && Boolean(assetUrl) && !assetFailed;
  const cfg      = normalizeImageConfig(banner);

  const alt = banner.image_alt || banner.image_asset?.name || banner.title || "Novedad";

  const type    = newsType(banner);
  const ctaLink = isHttpUrl(banner.cta_link || "") ? banner.cta_link : null;
  const ctaText = CTA_LABEL[banner.cta_mode] || CTA_LABEL[ctaModeFor(type)];
  const date    = formatDateDMY(newsDate(banner));
  const excerpt = truncateText(banner.body);

  return (
    <div
      className={preview ? undefined : "fade-up"}
      style={{
        ...FRAME,
        marginBottom:      preview ? 0 : 12,
        animationDelay:    preview ? undefined : `${index * .07}s`,
        animationFillMode: preview ? undefined : "both",
      }}
    >
      <div style={{
        position: "relative", width: "100%", aspectRatio: IMG_RATIO,
        overflow: "hidden", background: "rgba(255,255,255,.04)",
      }}>
        {hasImage ? (
          <img
            src={banner.image_url}
            alt={alt}
            width={IMG_W}
            height={IMG_H}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setImgFailed(true)}
            style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : hasAsset ? (
          <img
            src={assetUrl}
            alt={alt}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setAssetFailed(true)}
            style={{ ...imageLayerStyle({ ...cfg, position: "background" }), objectFit: "cover" }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 44, background: "rgba(255,215,0,.05)",
          }}>
            {banner.emoji || "📢"}
          </div>
        )}
      </div>

      <div style={{ padding: "12px 14px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{
            flex: 1, minWidth: 0,
            fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 15,
            color: banner.color || "#FFD700", lineHeight: 1.25,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {banner.title}
          </div>
          <span style={{
            flexShrink: 0, maxWidth: "42%",
            padding: "4px 10px", borderRadius: 999,
            background: "rgba(255,215,0,.1)", border: "1px solid rgba(255,215,0,.18)",
            fontSize: 9.5, fontWeight: 700, letterSpacing: ".5px", color: "rgba(255,215,0,.8)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {TYPE_BADGE[type]}
          </span>
        </div>

        {excerpt && (
          <div style={{
            marginTop: 8, fontSize: 12.5, lineHeight: 1.35,
            color: "rgba(245,230,192,.72)",
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {excerpt}
          </div>
        )}

        <div style={{
          marginTop: 12, display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 10,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {ctaLink && (
              <a
                href={ctaLink}
                target="_blank"
                rel="noopener noreferrer"
                // En el preview del admin el botón se ve pero no navega.
                onClick={preview ? (e) => e.preventDefault() : undefined}
                style={{
                  display: "inline-flex", alignItems: "center", minHeight: 36,
                  padding: "0 16px", borderRadius: 12, maxWidth: "100%",
                  background: "rgba(255,215,0,.12)", border: "1px solid rgba(255,215,0,.45)",
                  color: "#FFF6D6", fontSize: 12.5, fontWeight: 800, letterSpacing: ".4px",
                  textDecoration: "none", whiteSpace: "nowrap",
                }}
              >
                {ctaText}
              </a>
            )}
          </div>
          {date && (
            <span style={{ flexShrink: 0, fontSize: 11, color: "rgba(245,230,192,.5)" }}>
              {date}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Estado vacío: el staff todavía no cargó ninguna novedad.
function EmptyCard() {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "48px 20px", textAlign: "center",
    }}>
      <div style={{ fontSize: 44, marginBottom: 14, opacity: .2 }}>📣</div>
      <div style={{
        fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700,
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
      <div style={{ ...FRAME, opacity: .45 }}>
        <div style={{ aspectRatio: IMG_RATIO, background: "rgba(255,255,255,.04)" }}/>
        <div style={{ height: 92 }}/>
      </div>
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
