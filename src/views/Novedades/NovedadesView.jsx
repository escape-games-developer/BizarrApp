import { useState } from "react";
import { normalizeImageConfig, imageLayerStyle } from "../../components/media/imageLayout";
import {
  TYPE_BADGE, CTA_LABEL, ctaModeFor, newsType, newsDate,
  formatDateDMY, truncateText, isHttpUrl,
} from "../../constants/novedades";
import { JORGE_DESIGN } from "./designs/jorgeDesign";

// Formato oficial de la imagen de cada novedad: 1440x600 (2.4:1). Va arriba
// de la card, a ancho completo, y abajo el cuerpo con título, tipo, extracto,
// botón y fecha. La estructura es la misma en todos los diseños; cada diseño
// (src/views/Novedades/designs) sólo pone los estilos.
const IMG_W = 1440;
const IMG_H = 600;
const IMG_RATIO = `${IMG_W} / ${IMG_H}`;

const frameStyle = (design) => ({
  position: "relative",
  width:    "100%",
  overflow: "hidden",
  ...design.frame,
});

/**
 * Una novedad. La imagen sale, en orden de prioridad, de:
 *   1. `image_url`    → pieza gráfica 1440x600
 *   2. `image_asset`  → imagen de la biblioteca, encuadrada con scale / x / y
 *   3. ninguna        → el emoji de la novedad
 *
 * `preview` lo usa el admin para mostrar la card dentro del formulario sin la
 * animación de entrada ni el margen de la lista. `inert` deja el botón sin
 * navegar (va implícito en `preview`; el Diseñador lo usa con la lista).
 */
export function NovedadCard({ banner, index = 0, preview = false, inert = preview, design = JORGE_DESIGN }) {
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
        ...frameStyle(design),
        marginBottom:      preview ? 0 : 12,
        animationDelay:    preview ? undefined : `${index * .07}s`,
        animationFillMode: preview ? undefined : "both",
      }}
    >
      <div style={{
        position: "relative", width: "100%", aspectRatio: IMG_RATIO,
        overflow: "hidden", background: design.imageBg,
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
            fontSize: 44, background: design.fallbackBg,
          }}>
            {banner.emoji || "📢"}
          </div>
        )}
      </div>

      <div style={{ padding: "12px 14px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{
            flex: 1, minWidth: 0, lineHeight: 1.25,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            ...design.title(banner),
          }}>
            {banner.title}
          </div>
          <span style={{
            flexShrink: 0, maxWidth: "42%",
            padding: "4px 10px", borderRadius: 999,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            ...design.badge(type),
          }}>
            {TYPE_BADGE[type]}
          </span>
        </div>

        {excerpt && (
          <div style={{
            marginTop: 8, lineHeight: 1.35,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
            overflow: "hidden",
            ...design.excerpt,
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
                // En los previews (Admin y Diseñador) el botón se ve pero no navega.
                onClick={inert ? (e) => e.preventDefault() : undefined}
                style={{
                  display: "inline-flex", alignItems: "center", minHeight: 36,
                  padding: "0 16px", borderRadius: 12, maxWidth: "100%",
                  letterSpacing: ".4px", textDecoration: "none", whiteSpace: "nowrap",
                  ...design.cta,
                }}
              >
                {ctaText}
              </a>
            )}
          </div>
          {date && <span style={{ flexShrink: 0, ...design.date }}>{date}</span>}
        </div>
      </div>
    </div>
  );
}

/**
 * Fondo, fuentes y franja de TV del diseño. Los diseños sin lienzo propio
 * (Jorge) dibujan directo sobre el fondo de la app.
 */
function Lienzo({ design, children }) {
  if (!design.className) return children;
  return (
    <div className={design.className}>
      {design.fontsCss && <style>{design.fontsCss}</style>}
      {design.css && <style>{design.css}</style>}
      {design.tvStripe && (
        <div className="nov-tv-franja" aria-hidden="true">
          {design.tvStripe.map((c, i) => <span key={i} style={{ background: c }}/>)}
        </div>
      )}
      {children}
    </div>
  );
}

function Header({ design }) {
  if (!design.header) {
    return (
      <div className="sec-hdr">
        <span style={{ fontSize: 20 }}>📣</span>
        <h3>Novedades y Promos</h3>
      </div>
    );
  }
  return (
    <h3 style={{ margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8, ...design.header }}>
      <span style={{ fontSize: 18 }} aria-hidden="true">📣</span>
      Novedades y Promos
    </h3>
  );
}

// Estado vacío: el staff todavía no cargó ninguna novedad.
function EmptyCard({ design }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "48px 20px", textAlign: "center",
    }}>
      <div style={{ fontSize: 44, marginBottom: 14, ...design.empty.icon }}>📣</div>
      <div style={{ marginBottom: 8, ...design.empty.title }}>
        Sin novedades por ahora
      </div>
      <div style={{ lineHeight: 1.5, ...design.empty.text }}>
        El staff publicará las promos y novedades de la noche acá.
      </div>
    </div>
  );
}

/**
 * `design` es el diseño ya resuelto (designs/registry.js). Sin dato se dibuja
 * el Diseño Jorge. `preview` deja las cards inertes (Diseñador Cliente).
 */
export default function NovedadesView({ banners = [], loading = false, design = JORGE_DESIGN, preview = false }) {
  const visible = banners.filter((b) => b.visible !== false);

  let content;
  if (loading) {
    content = (
      <div style={{ ...frameStyle(design), opacity: .45 }}>
        <div style={{ aspectRatio: IMG_RATIO, background: design.imageBg }}/>
        <div style={{ height: 92 }}/>
      </div>
    );
  } else if (visible.length === 0) {
    content = <EmptyCard design={design}/>;
  } else {
    content = (
      <div>
        <Header design={design}/>
        {visible.map((b, i) => (
          <NovedadCard key={b.id || i} banner={b} index={i} design={design} inert={preview}/>
        ))}
      </div>
    );
  }

  return <Lienzo design={design}>{content}</Lienzo>;
}
