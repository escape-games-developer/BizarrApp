import { CANTONI_TOKENS as T, CANTONI_TV_STRIPE } from "../../Pantalla/themes/cantoniTheme";

/**
 * Pieles de "Mi Perfil". La estructura y el comportamiento son los de
 * ProfileDesignOriginal; una piel sólo cambia colores y tipografías.
 *
 *   inline    colores de lo que el diseño dibuja con estilos inline
 *   className lienzo propio + `css`, que adapta las clases globales (.card,
 *             .input-field, .btn-primary…) de las piezas compartidas: editar
 *             perfil, cambiar contraseña y eliminar cuenta.
 */

const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** Diseño Jorge — la paleta dorada original del bar. */
export const JORGE_PROFILE_SKIN = Object.freeze({
  id:        "original",
  className: null,
  fontsCss:  null,
  css:       null,
  tvStripe:  null,

  accent:     "#FFD700",
  titleFont:  "'DM Sans',sans-serif",
  titleWeight: 700,
  uiFont:     "'DM Sans',sans-serif",
  muted:      (a) => `rgba(245,230,192,${a})`,
  ok:         "#86EFAC",
  surface:    "#000000",
  border:     "rgba(255,215,0,.1)",
  menuBorder: "rgba(255,215,0,.18)",
  kebab:      { bg: "rgba(255,255,255,.04)", bgOn: "rgba(255,215,0,.12)", border: "rgba(255,215,0,.15)" },
  logout:     { bg: "rgba(255,45,120,.1)", border: "rgba(255,45,120,.3)", color: "#FF2D78" },
});

// Lienzo: cubre el padding de .app-content (14 16 16), como en Pantalla.
const cantoniCss = `
  .prf-cantoni{margin:-14px -16px -16px;padding:14px 16px 16px;height:calc(100% + 30px);
    display:flex;flex-direction:column;background:${T.bg};color:${T.text};font-family:${T.ui};}
  .prf-cantoni .prf-tv-franja{flex-shrink:0;display:flex;height:6px;margin:-14px -16px 12px;}
  .prf-cantoni .prf-tv-franja span{flex:1;}
  .prf-cantoni .prf-cuerpo{flex:1;min-height:0;}
  .prf-cantoni button{font-family:${T.ui};}

  .prf-cantoni .card{background:${T.surface};border-color:${T.border};}
  .prf-cantoni .card-title{font-family:${T.display};font-weight:400;letter-spacing:.8px;color:${T.yellow};}
  .prf-cantoni .input-field{background:${rgba("#000000", .25)};border-color:${T.border};color:${T.text};font-family:${T.ui};}
  .prf-cantoni .input-field:focus{border-color:${T.cyan};}
  .prf-cantoni .input-field::placeholder{color:${rgba("#B3ADC9", .45)};}
  .prf-cantoni .btn-primary{background:${T.yellow};color:${T.bg};font-family:${T.ui};font-weight:800;box-shadow:none;}
  .prf-cantoni .btn-ghost{background:${rgba("#F8F5FF", .04)};border-color:${T.border};color:${T.text2};font-family:${T.ui};}
`;

// Va en un <style> propio: @import tiene que ser la primera regla de la hoja.
const cantoniFonts = `@import url('https://fonts.googleapis.com/css2?family=Bungee&family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&display=swap');`;

/** Diseño Cantoni — estética Talento Bizarren (mismos tokens que Pantalla). */
export const CANTONI_PROFILE_SKIN = Object.freeze({
  id:        "cantoni",
  className: "prf-cantoni",
  fontsCss:  cantoniFonts,
  css:       cantoniCss,
  tvStripe:  CANTONI_TV_STRIPE.map((k) => T[k]),

  accent:     T.yellow,
  titleFont:  T.display,
  titleWeight: 400,
  uiFont:     T.ui,
  muted:      (a) => rgba(T.text, a),
  ok:         T.green,
  surface:    T.surface,
  border:     T.border,
  menuBorder: T.border,
  kebab:      { bg: rgba(T.text, .04), bgOn: rgba(T.yellow, .14), border: T.border },
  logout:     { bg: rgba(T.pink, .12), border: rgba(T.pink, .5), color: T.pink },
});
