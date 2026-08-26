/**
 * Encuadre de la imagen de biblioteca dentro de una card de Novedades.
 *
 * Lo usan tanto la card pública (`NovedadesView`) como el preview del admin,
 * así lo que el staff ve mientras configura es exactamente lo que ve el cliente.
 *
 * Convenciones:
 *   position → left | right | background   (default: right)
 *   scale    → 50 a 180 (%)                (default: 100)
 *   x / y    → -100 a +100                 (default: 0)
 *              El rango completo equivale a ±50% del ancho/alto de la card,
 *              medido siempre sobre la card para que los tres modos se
 *              comporten igual.
 */

export const IMAGE_POSITIONS = [
  { id: "left",       label: "Izquierda" },
  { id: "right",      label: "Derecha"   },
  { id: "background", label: "Fondo"     },
];

export const IMAGE_DEFAULTS = { position: "right", scale: 100, x: 0, y: 0 };

export const SCALE_MIN = 50;
export const SCALE_MAX = 180;
export const OFFSET_MIN = -100;
export const OFFSET_MAX = 100;

/** El desplazamiento -100..100 se traduce a ±50% de la card. */
const OFFSET_FACTOR = 0.5;

const clamp = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

/** Lee la configuración de un banner tolerando columnas ausentes o nulas. */
export function normalizeImageConfig(banner = {}) {
  const position = IMAGE_POSITIONS.some((p) => p.id === banner.image_position)
    ? banner.image_position
    : IMAGE_DEFAULTS.position;

  return {
    position,
    scale: clamp(banner.image_scale, SCALE_MIN,  SCALE_MAX,  IMAGE_DEFAULTS.scale),
    x:     clamp(banner.image_x,     OFFSET_MIN, OFFSET_MAX, IMAGE_DEFAULTS.x),
    y:     clamp(banner.image_y,     OFFSET_MIN, OFFSET_MAX, IMAGE_DEFAULTS.y),
  };
}

/**
 * Estilo del <img> superpuesto. `object-fit: contain` en todos los modos para
 * que la imagen nunca se deforme, y `pointer-events: none` para que no tape
 * clicks sobre la card.
 */
export function imageLayerStyle({ position, scale, x, y }) {
  const dx = x * OFFSET_FACTOR;
  const dy = y * OFFSET_FACTOR;
  const s  = scale / 100;

  const base = {
    position:      "absolute",
    display:       "block",
    objectFit:     "contain",
    pointerEvents: "none",
    userSelect:    "none",
    // La card ya recorta con overflow:hidden, así que escalar no desborda.
    willChange:    "transform",
  };

  if (position === "background") {
    return {
      ...base,
      left:            `${50 + dx}%`,
      top:             `${50 + dy}%`,
      width:           "100%",
      height:          "100%",
      transform:       `translate(-50%, -50%) scale(${s})`,
      transformOrigin: "center center",
      zIndex:          0,
    };
  }

  const isLeft = position === "left";
  return {
    ...base,
    top:             `${50 + dy}%`,
    ...(isLeft
      ? { left:  `${3 + dx}%` }
      : { right: `${3 - dx}%` }),
    width:           "44%",
    height:          "84%",
    objectPosition:  isLeft ? "left center" : "right center",
    transform:       `translateY(-50%) scale(${s})`,
    transformOrigin: isLeft ? "left center" : "right center",
    zIndex:          1,
  };
}

/**
 * Espacio que hay que reservarle al texto para que la imagen no lo pise.
 * En modo "fondo" el texto va por encima y no se recorta nada.
 */
export function contentSpacingFor({ position }) {
  if (position === "left")  return { paddingLeft:  "44%" };
  if (position === "right") return { paddingRight: "44%" };
  return {};
}

/** Velo suave sólo en modo "fondo", para no perder legibilidad del texto. */
export const BACKGROUND_SCRIM = {
  position:      "absolute",
  inset:         0,
  zIndex:        1,
  pointerEvents: "none",
  background:    "linear-gradient(90deg, rgba(13,0,16,.82) 0%, rgba(13,0,16,.55) 55%, rgba(13,0,16,.25) 100%)",
};
