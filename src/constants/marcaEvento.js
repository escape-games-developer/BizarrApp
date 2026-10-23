/**
 * Personalización visual del evento de DJ Democracy (Editor → «Personalización
 * visual»): `accent_color`, `text_color`, `background_color`, `logo_url` y
 * `background_image_url` de `pantalla_events`.
 *
 * Es la BASE del evento: la usan /tv y la vista del cliente donde su diseño
 * no fijó otra cosa. Lo diseñado a mano (Diseñador DJ Democracy, temas del
 * Diseñador Cliente) gana. Un campo vacío (o inválido) es null: sin él, cada
 * pantalla queda con su estilo de siempre.
 */

const esHex = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
const texto = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function marcaDelEvento(event) {
  return {
    acento:      esHex(event?.accent_color) ? event.accent_color : null,
    texto:       esHex(event?.text_color) ? event.text_color : null,
    fondo:       esHex(event?.background_color) ? event.background_color : null,
    fondoImagen: texto(event?.background_image_url),
    logo:        texto(event?.logo_url),
  };
}

/** ¿El evento tiene algo personalizado? */
export const hayMarca = (m) => !!(m && (m.acento || m.texto || m.fondo || m.fondoImagen || m.logo));

/**
 * Color de un diseño con la marca como base: si el diseño no lo fijó (vacío,
 * o igual a su valor por defecto) manda la marca; si no, el diseño.
 */
export function colorConMarca(valor, porDefecto, marca) {
  const sinTocar = !valor || (porDefecto && String(valor).toLowerCase() === String(porDefecto).toLowerCase());
  return (sinTocar && marca) || valor || porDefecto;
}

/** "#ff6a00" + .2 → "rgba(255,106,0,.2)" */
export function rgba(hex, alfa) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alfa})`;
}
